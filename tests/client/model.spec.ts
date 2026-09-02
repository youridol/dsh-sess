/**
 * Pure client-model tests: locale dictionary parity and row derivation.
 * These modules have no React/DOM dependency, so they run under Node.
 */
import { describe, expect, it } from 'vitest'
import { dictionaries } from '../../src/client/locales.ts'
import { archivedRows, deriveSessionRows, relativeTime } from '../../src/client/model.ts'
import type { SessionListState, SessionSummaryView, WorkspaceListState } from '../../src/client/types.ts'

describe('locale dictionaries', () => {
  it('carries identical zh/en key sets', () => {
    const { zh, en } = dictionaries()
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    expect(Object.keys(zh).length).toBeGreaterThan(10)
  })

  it('contains no empty or placeholder copy', () => {
    const { zh, en } = dictionaries()
    for (const [key, value] of Object.entries(zh)) {
      expect(value.trim().length, `zh:${key}`).toBeGreaterThan(0)
      expect(value, `zh:${key}`).not.toContain('TODO')
    }
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim().length, `en:${key}`).toBeGreaterThan(0)
      expect(value, `en:${key}`).not.toContain('TODO')
    }
  })
})

function snapshot(options: {
  sessions?: Array<SessionSummaryView & { id: string; updatedAt: number }>
  archived?: string[]
  memberships?: Array<{ workspaceId: string; title: string; sessionIds: string[] }>
}): { sessions: SessionListState; workspaces: WorkspaceListState } {
  const ids: string[] = []
  const byId: Record<string, SessionSummaryView> = {}
  for (const session of options.sessions ?? []) {
    ids.push(session.id)
    byId[session.id] = session
  }
  return {
    sessions: { ids, byId, phase: 'ready' },
    workspaces: {
      items: (options.memberships ?? []).map(membership => ({
        workspaceId: membership.workspaceId,
        path: `/dir/${membership.workspaceId}`,
        title: membership.title,
        sessionIds: membership.sessionIds,
      })),
      archivedSessionIds: options.archived ?? [],
      phase: 'ready',
    },
  }
}

describe('deriveSessionRows', () => {
  it('derives rows with titles, workspaces, archive and activity flags', () => {
    const { sessions, workspaces } = snapshot({
      sessions: [
        { id: 'session-a', displayTitle: 'Alpha', updatedAt: 100 },
        { id: 'session-b', title: null, displayTitle: 'session-b', updatedAt: 300, blank: true },
        { id: 'session-child', displayTitle: 'Child', updatedAt: 50, parentId: 'session-a' },
        { id: 'session-sub', displayTitle: 'Sub', updatedAt: 40, origin: 'subagent' },
      ],
      archived: ['session-b'],
      memberships: [{ workspaceId: 'ws-1', title: 'Project One', sessionIds: ['session-a'] }],
    })
    const rows = deriveSessionRows(sessions, workspaces)
    expect(rows.map(row => row.sessionId)).toEqual(['session-b', 'session-a'])
    const a = rows[1] as NonNullable<typeof rows[1]>
    expect(a.workspaceTitle).toBe('Project One')
    expect(a.archived).toBe(false)
    expect(rows[0]?.archived).toBe(true)
    expect(rows[0]?.blank).toBe(true)
    expect(rows.every(row => row.sessionId !== 'session-child' && row.sessionId !== 'session-sub')).toBe(true)
  })

  it('falls back to the session id when no title exists', () => {
    const { sessions, workspaces } = snapshot({
      sessions: [{ id: 'session-x', updatedAt: 1 }],
    })
    const rows = deriveSessionRows(sessions, workspaces)
    expect(rows[0]?.title).toBe('session-x')
  })

  it('marks running sessions', () => {
    const { sessions, workspaces } = snapshot({
      sessions: [
        { id: 'session-a', displayTitle: 'A', updatedAt: 1, running: true },
        { id: 'session-b', displayTitle: 'B', updatedAt: 2 },
      ],
    })
    const rows = deriveSessionRows(sessions, workspaces)
    expect(rows.find(row => row.sessionId === 'session-a')?.running).toBe(true)
    expect(rows.find(row => row.sessionId === 'session-b')?.running).toBe(false)
  })
})

describe('archivedRows', () => {
  it('keeps only archived rows in original order', () => {
    const { sessions, workspaces } = snapshot({
      sessions: [
        { id: 'session-a', displayTitle: 'A', updatedAt: 1 },
        { id: 'session-b', displayTitle: 'B', updatedAt: 2 },
        { id: 'session-c', displayTitle: 'C', updatedAt: 3 },
      ],
      archived: ['session-b', 'session-c'],
    })
    const rows = deriveSessionRows(sessions, workspaces)
    const archived = archivedRows(rows)
    expect(archived.map(row => row.sessionId)).toEqual(['session-c', 'session-b'])
  })
})

describe('relativeTime', () => {
  it('formats through Intl.RelativeTimeFormat', () => {
    const now = 1_700_000_000_000
    expect(relativeTime(now - 30_000, now, 'en')).toBe('30 seconds ago')
    expect(relativeTime(now - 3 * 60_000, now, 'en')).toBe('3 minutes ago')
    expect(relativeTime(now - 2 * 3_600_000, now, 'en')).toBe('2 hours ago')
    expect(relativeTime(now - 3 * 86_400_000, now, 'en')).toBe('3 days ago')
    expect(relativeTime(now, now, 'zh-CN')).toBe('现在')
  })
})
