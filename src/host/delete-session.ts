/**
 * Permanent cold-session deletion.
 *
 * Deleting a session is intentionally destructive and the harness core offers
 * no such operation (workspaces never delete session histories and archiving
 * is hiding-only), so dsh-sess implements it as a plugin operation built
 * exclusively from official read services plus one guarded file removal:
 *
 * 1. **Refuse live sessions.** A session bound to the in-process session store
 *    (`ctx.sessions.get(id)`) is open here: its agent fiber and UI state are
 *    live, and deleting its durable artifact underneath them would leave
 *    inconsistent state (the old plugin's `agent-busy` boundary). Deleting is
 *    only offered for cold sessions; a live one is refused with `agent-busy`
 *    and a hint to close/restart first.
 * 2. **Verify the session exists durably** via the official
 *    `ctx.sessionPersistence.list()` listing.
 * 3. **Remove the durable artifact** located through the official
 *    `ctx.sessionPersistence.locate(header)` hint under structural guards
 *    (`artifact.ts`). No workspace domain-global state is ever written.
 * 4. **Release workspace accounting** through the official registry entity
 *    `detachSession` API when the session is a member of a workspace, so the
 *    row disappears from grouping on the next projection refresh.
 *
 * A session that is still listed in the durable archive set keeps its (now
 * orphaned) archive marker: the official workspace API has no way to remove a
 * marker without writing domain state directly, and orphan markers are inert —
 * list surfaces join archive ids against real sessions before rendering.
 */
import type { SessionHeader, SessionId } from '@deepseek-ai/dsh-session/types'
import { removeSessionArtifact, type SessionArtifactLocation } from './artifact.ts'
import { SessionOpError } from './errors.ts'
import { assertSessionId } from './session-id.ts'

/** The official in-process session store surface dsh-sess reads. */
export interface LiveSessionFace {
  /** Live sessions by id; presence means the session is open in this process. */
  get(id: SessionId): { readonly header: SessionHeader } | undefined
}

/** The official session-persistence surface dsh-sess reads. */
export interface PersistenceFace {
  /** Every durably stored session header. */
  list(): Promise<readonly SessionHeader[]>
  /** Official per-session artifact location hint. */
  locate(header: SessionHeader): SessionArtifactLocation | undefined
}

/** One workspace registry entity as dsh-sess consumes it. */
export interface WorkspaceMembershipFace {
  readonly sessionIds: readonly SessionId[]
  detachSession(sessionId: SessionId): Promise<void>
}

/** The official workspace registry surface dsh-sess reads. */
export interface WorkspaceRegistryFace {
  list(): readonly WorkspaceMembershipFace[]
}

/** Minimal official-service faces the delete operation needs. */
export interface DeleteSessionHost {
  readonly sessions: LiveSessionFace
  readonly persistence: PersistenceFace
  readonly workspaceRegistry: WorkspaceRegistryFace
}

/** Result of a successful deletion. */
export interface DeleteSessionResult {
  readonly deleted: SessionId
}

/**
 * Permanently delete one cold session.
 * @param host - structural faces over the official session services.
 * @param rawSessionId - raw wire value; validated by {@link assertSessionId}.
 * @returns the deleted session id.
 * @throws {@link SessionOpError} with a stable code on any refusal or failure.
 */
export async function deleteSession(
  host: DeleteSessionHost,
  rawSessionId: unknown,
): Promise<DeleteSessionResult> {
  const sessionId = assertSessionId(rawSessionId)

  // 1) Live sessions are refused: their in-memory agent and UI state would
  // outlive the removed artifact. Closing DSH (or navigating every open
  // session away) makes the session cold and deletion possible.
  if (host.sessions.get(sessionId) !== undefined) {
    throw new SessionOpError(
      'agent-busy',
      `session "${String(sessionId)}" is still open in this process; close it (or restart DSH) before deleting`,
      { sessionId: String(sessionId) },
    )
  }

  // 2) The session must exist in durable persistence.
  const headers = await host.persistence.list()
  const header = headers.find(candidate => String(candidate.id) === String(sessionId))
  if (header === undefined) {
    throw new SessionOpError(
      'session-not-found',
      `no stored session "${String(sessionId)}"`,
      { sessionId: String(sessionId) },
    )
  }

  // 3) Remove the durable artifact (guarded; no workspace domain writes).
  try {
    await removeSessionArtifact(sessionId, host.persistence.locate(header))
  } catch (error) {
    if (error instanceof SessionOpError) throw error
    throw new SessionOpError(
      'internal',
      `failed to remove the stored session "${String(sessionId)}": ${error instanceof Error ? error.message : String(error)}`,
      { sessionId: String(sessionId) },
    )
  }

  // 4) Release workspace accounting through the official detach API.
  for (const entity of host.workspaceRegistry.list()) {
    if (entity.sessionIds.some(id => String(id) === String(sessionId))) {
      await entity.detachSession(sessionId)
    }
  }

  return { deleted: sessionId }
}
