/**
 * Host operation tests: permanent deletion, artifact removal guards, rename,
 * id validation and the RPC handler. Tests run without a DSH host — the
 * official-service faces are faked and real temp directories stand in for the
 * persistence tree.
 */
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import type { SessionHeader, SessionId } from '@deepseek-ai/dsh-session/types'
import { removeSessionArtifact } from '../../src/host/artifact.ts'
import { deleteSession } from '../../src/host/delete-session.ts'
import { SessionOpError } from '../../src/host/errors.ts'
import { renameSession } from '../../src/host/rename-session.ts'
import { assertSessionId } from '../../src/host/session-id.ts'
import { createChannelHandler, Endpoints, SESS_CHANNEL } from '../../src/host/rpc.ts'
import type { SessionControllerFace } from '../../src/host/rename-session.ts'

/** Track temp roots for cleanup. */
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-sess-test-'))
  roots.push(root)
  return root
}

/** Materialize one JSONL-style artifact directory under a project dir. */
async function writeArtifact(
  root: string,
  project: string,
  id: string,
  files: readonly string[] = ['session.jsonl.zstd'],
): Promise<void> {
  const dir = join(root, project, id)
  await mkdir(dir, { recursive: true })
  for (const file of files) await writeFile(join(dir, file), '[]\n')
}

function header(id: string, cwd: string | undefined = '/workspace'): SessionHeader {
  return {
    version: 0,
    id: id as SessionId,
    createdAt: 1_700_000_000_000,
    ...(cwd === undefined ? {} : { cwd }),
    isSeeded: false,
  }
}

/** A controllable fake of the official service faces deleteSession reads. */
function fakeDeleteHost(options: {
  persisted?: SessionHeader[]
  liveIds?: string[]
  memberships?: Array<{ workspaceId: string; sessionIds: string[] }>
  locate?: (sessionId: string) => { kind: string; path: string } | undefined
}): {
  run: (rawId: unknown) => Promise<{ deleted: SessionId }>
  detachCalls: Array<{ workspaceId: string; sessionId: string }>
} {
  const memberships = (options.memberships ?? []).map(membership => ({
    workspaceId: membership.workspaceId,
    sessionIds: [...membership.sessionIds],
  }))
  const detachCalls: Array<{ workspaceId: string; sessionId: string }> = []
  const entities = memberships.map(membership => ({
    workspaceId: membership.workspaceId,
    get sessionIds(): readonly SessionId[] {
      return membership.sessionIds as SessionId[]
    },
    async detachSession(sessionId: SessionId): Promise<void> {
      const index = membership.sessionIds.indexOf(String(sessionId))
      if (index !== -1) membership.sessionIds.splice(index, 1)
      detachCalls.push({ workspaceId: membership.workspaceId, sessionId: String(sessionId) })
    },
  }))
  const host = {
    sessions: {
      get(id: SessionId) {
        return (options.liveIds ?? []).includes(String(id))
          ? { header: header(String(id)) }
          : undefined
      },
    },
    persistence: {
      async list(): Promise<SessionHeader[]> {
        return [...(options.persisted ?? [])]
      },
      locate(input: SessionHeader) {
        return options.locate !== undefined
          ? options.locate(String(input.id))
          : { kind: 'jsonl', path: join('/sessions', 'p', String(input.id), 'session.jsonl.zstd') }
      },
    },
    workspaceRegistry: {
      list() {
        return entities
      },
    },
  }
  return {
    run: (rawId: unknown) => deleteSession(host, rawId),
    detachCalls,
  }
}

describe('assertSessionId', () => {
  it('accepts harness-style ids', () => {
    expect(assertSessionId('session-1')).toBe('session-1')
    expect(assertSessionId('session-42')).toBe('session-42')
  })

  it('rejects malformed values with bad-request', () => {
    for (const bad of [undefined, null, 42, '', 'a/b', '..', '.', 'a..b', 'x'.repeat(129), 'a~b', 'a b']) {
      expect(() => assertSessionId(bad), `should reject ${JSON.stringify(bad)}`).toThrow(SessionOpError)
    }
    try {
      assertSessionId('a/b')
      throw new Error('unreachable')
    } catch (error) {
      expect(error).toBeInstanceOf(SessionOpError)
      expect((error as SessionOpError).code).toBe('bad-request')
    }
  })
})

describe('removeSessionArtifact', () => {
  it('removes the owning directory when the path shape is valid', async () => {
    const root = await tempRoot()
    await writeArtifact(root, '--workspace--', 'session-1', ['session.jsonl.zstd', 'session.jsonl'])
    await removeSessionArtifact('session-1' as SessionId, {
      kind: 'jsonl',
      path: join(root, '--workspace--', 'session-1', 'session.jsonl.zstd'),
    })
    await expect(readdir(root)).resolves.toEqual(['--workspace--'])
    await expect(readdir(join(root, '--workspace--'))).resolves.toEqual([])
  })

  it('is a no-op without a location', async () => {
    await expect(removeSessionArtifact('session-1' as SessionId, undefined)).resolves.toBeUndefined()
  })

  it('refuses non-jsonl backends', async () => {
    const root = await tempRoot()
    await writeArtifact(root, 'p', 'session-1')
    await expect(removeSessionArtifact('session-1' as SessionId, {
      kind: 'sqlite',
      path: join(root, 'p', 'session-1', 'session.db'),
    })).rejects.toMatchObject({ code: 'service-unavailable' })
  })

  it('refuses paths whose directory does not match the session id', async () => {
    const root = await tempRoot()
    await writeArtifact(root, 'p', 'session-other')
    await expect(removeSessionArtifact('session-1' as SessionId, {
      kind: 'jsonl',
      path: join(root, 'p', 'session-other', 'session.jsonl.zstd'),
    })).rejects.toMatchObject({ code: 'internal' })
    await expect(readdir(join(root, 'p', 'session-other'))).resolves.toEqual(['session.jsonl.zstd'])
  })

  it('refuses unexpected artifact base names', async () => {
    const root = await tempRoot()
    await writeArtifact(root, 'p', 'session-1', ['other.txt'])
    await expect(removeSessionArtifact('session-1' as SessionId, {
      kind: 'jsonl',
      path: join(root, 'p', 'session-1', 'other.txt'),
    })).rejects.toMatchObject({ code: 'internal' })
  })

  it('refuses non-absolute paths', async () => {
    await expect(removeSessionArtifact('session-1' as SessionId, {
      kind: 'jsonl',
      path: 'relative/session-1/session.jsonl.zstd',
    })).rejects.toMatchObject({ code: 'internal' })
  })
})

describe('deleteSession', () => {
  it('refuses a live session without touching accounting', async () => {
    const host = fakeDeleteHost({ liveIds: ['session-1'] })
    await expect(host.run('session-1')).rejects.toMatchObject({ code: 'agent-busy' })
    expect(host.detachCalls).toEqual([])
  })

  it('fails with session-not-found when the session is not persisted', async () => {
    const host = fakeDeleteHost({})
    await expect(host.run('session-1')).rejects.toMatchObject({ code: 'session-not-found' })
  })

  it('deletes a cold session artifact and releases workspace accounting', async () => {
    const root = await tempRoot()
    const persisted = [header('session-1')]
    await writeArtifact(root, '--project--', 'session-1')
    await writeArtifact(root, '--project--', 'session-2')
    const host = fakeDeleteHost({
      persisted,
      locate: id => ({ kind: 'jsonl', path: join(root, '--project--', id, 'session.jsonl.zstd') }),
      memberships: [
        { workspaceId: 'ws-1', sessionIds: ['session-1', 'session-2'] },
        { workspaceId: 'ws-2', sessionIds: ['session-2'] },
      ],
    })

    const result = await host.run('session-1')
    expect(result).toEqual({ deleted: 'session-1' })
    await expect(readdir(join(root, '--project--'))).resolves.toEqual(['session-2'])
    await expect(readdir(join(root, '--project--', 'session-2'))).resolves.toEqual(['session.jsonl.zstd'])
    expect(host.detachCalls).toEqual([{ workspaceId: 'ws-1', sessionId: 'session-1' }])
  })

  it('deletes without detaching when the session is not a member', async () => {
    const root = await tempRoot()
    const persisted = [header('session-1')]
    await writeArtifact(root, 'p', 'session-1')
    const host = fakeDeleteHost({
      persisted,
      locate: id => ({ kind: 'jsonl', path: join(root, 'p', id, 'session.jsonl.zstd') }),
      memberships: [{ workspaceId: 'ws-2', sessionIds: ['session-2'] }],
    })
    await expect(host.run('session-1')).resolves.toEqual({ deleted: 'session-1' })
    expect(host.detachCalls).toEqual([])
  })

  it('deletes when the backend reports no per-session artifact', async () => {
    const persisted = [header('session-1')]
    const host = fakeDeleteHost({ persisted, locate: () => undefined })
    await expect(host.run('session-1')).resolves.toEqual({ deleted: 'session-1' })
    expect(host.detachCalls).toEqual([])
  })

  it('refuses a non-jsonl backend location', async () => {
    const persisted = [header('session-1')]
    const host = fakeDeleteHost({ persisted, locate: () => ({ kind: 'other', path: '/x/session-1/y' }) })
    await expect(host.run('session-1')).rejects.toMatchObject({ code: 'service-unavailable' })
  })

  it('rejects malformed session ids before touching services', async () => {
    const host = fakeDeleteHost({})
    await expect(host.run('not/valid')).rejects.toMatchObject({ code: 'bad-request' })
  })
})

function controller(behavior: 'ok' | 'missing' | 'title-invalid'): SessionControllerFace | undefined {
  if (behavior === 'missing') return undefined
  return {
    async rename(request) {
      if (behavior === 'title-invalid') {
        throw Object.assign(new Error('title too long'), { code: 'session/title-invalid' })
      }
      return { title: request.title, seq: 7 }
    },
  }
}

describe('renameSession', () => {
  it('renames through the controller', async () => {
    await expect(renameSession({ sessionController: controller('ok') }, 'session-1', '  New name '))
      .resolves.toEqual({ title: 'New name' })
  })

  it('maps controller title rejections', async () => {
    await expect(renameSession({ sessionController: controller('title-invalid') }, 'session-1', 'x'.repeat(200)))
      .rejects.toMatchObject({ code: 'title-invalid' })
  })

  it('fails clearly when the controller is not mounted', async () => {
    await expect(renameSession({ sessionController: controller('missing') }, 'session-1', 'New'))
      .rejects.toMatchObject({ code: 'service-unavailable' })
  })

  it('rejects empty and non-string titles', async () => {
    await expect(renameSession({ sessionController: controller('ok') }, 'session-1', '   '))
      .rejects.toMatchObject({ code: 'bad-request' })
    await expect(renameSession({ sessionController: controller('ok') }, 'session-1', 42))
      .rejects.toMatchObject({ code: 'bad-request' })
  })
})

describe('channel handler', () => {
  const stubHost = (): Parameters<typeof createChannelHandler>[0] => ({
    sessions: { get: () => undefined },
    persistence: {
      list: async () => [],
      locate: () => undefined,
    },
    workspaceRegistry: { list: () => [] },
    sessionController: undefined,
  })

  it('wraps business failures in the standard envelope', async () => {
    const handler = createChannelHandler(stubHost())
    const result = await handler(Endpoints.deleteSession, { sessionId: 'session-missing' })
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'session-not-found', details: expect.any(Object) }),
    })
  })

  it('answers unknown endpoints with bad-request', async () => {
    const handler = createChannelHandler(stubHost())
    const result = await handler('dshSess.unknown', {})
    expect(result).toMatchObject({ ok: false, error: { code: 'bad-request' } })
  })

  it('exposes a stable channel name', () => {
    expect(SESS_CHANNEL).toBe('/dsh-sess')
  })
})
