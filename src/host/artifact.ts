/**
 * Persisted session artifact removal.
 *
 * dsh-sess permanently deletes a cold session by removing the durable artifact
 * the official JSONL persistence backend owns for it. Nothing in the harness
 * core offers artifact deletion (workspaces never delete session histories and
 * archiving is hiding-only), so the plugin performs the removal itself — but
 * strictly through the official location hint (`ctx.sessionPersistence.locate`)
 * and only after structural guards make the resolved path provably safe to
 * delete:
 *
 * - the backend kind must be the per-session `jsonl` backend;
 * - the artifact must carry the backend's fixed base name
 *   (`session.jsonl[.zstd]`);
 * - the path must be absolute;
 * - the containing directory must be one clean path segment named exactly
 *   after the validated session id (the JSONL layout is
 *   `<root>/<projectKey>/<id>/session.jsonl[.zstd]`, and validated ids are
 *   stored verbatim — see `session-id.ts`).
 *
 * The guards never guess a root or walk upward; they only assert the shape of
 * the path the backend itself derived for the resolved header. Removal is
 * directory-scoped (the backend may hold compressed and plaintext artifacts
 * side by side), recursive, and idempotent.
 */
import { rm } from 'node:fs/promises'
import { basename, dirname, isAbsolute } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { SessionOpError } from './errors.ts'

/** One clean path segment: the character set validated ids are restricted to. */
const SESSION_DIR_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

/** Official base names of the jsonl artifact. */
const JSONL_ARTIFACT_NAMES = new Set(['session.jsonl', 'session.jsonl.zstd'])

/** A backend-resolved per-session artifact location (official shape). */
export interface SessionArtifactLocation {
  /** Backend-specific artifact kind, for example `jsonl`. */
  readonly kind: string
  /** Absolute path to the backend-owned artifact. */
  readonly path: string
}

/**
 * Remove a session's durable artifacts.
 *
 * When the backend reports no per-session artifact the removal is a no-op:
 * there is nothing durable left to delete (custom backends may own no single
 * file per session; the caller decides how to surface that).
 *
 * @param sessionId - validated session id whose artifacts are removed.
 * @param location - official location hint for the session's artifact.
 * @throws {@link SessionOpError} when the resolved path fails a structural
 * guard or the backend kind is not removable.
 */
export async function removeSessionArtifact(
  sessionId: SessionId,
  location: SessionArtifactLocation | undefined,
): Promise<void> {
  if (location === undefined) return
  if (location.kind !== 'jsonl') {
    throw new SessionOpError(
      'service-unavailable',
      `permanent deletion is unavailable: persistence backend kind "${location.kind}" owns no removable per-session artifact`,
      { sessionId: String(sessionId), reason: location.kind },
    )
  }
  const { path } = location
  if (!isAbsolute(path)) {
    throw new SessionOpError(
      'internal',
      `refusing to delete a session artifact at a non-absolute path: ${JSON.stringify(path)}`,
      { sessionId: String(sessionId) },
    )
  }
  const artifact = basename(path)
  if (!JSONL_ARTIFACT_NAMES.has(artifact)) {
    throw new SessionOpError(
      'internal',
      `refusing to delete an unexpected session artifact name: ${JSON.stringify(artifact)}`,
      { sessionId: String(sessionId) },
    )
  }
  const directory = dirname(path)
  const directoryName = basename(directory)
  if (!SESSION_DIR_PATTERN.test(directoryName)
    || directoryName === '.'
    || directoryName === '..'
    || directoryName !== String(sessionId)) {
    throw new SessionOpError(
      'internal',
      `refusing to delete a session directory that does not match the requested session: ${JSON.stringify(directoryName)}`,
      { sessionId: String(sessionId) },
    )
  }
  await rm(directory, { recursive: true, force: true })
}
