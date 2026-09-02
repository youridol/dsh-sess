/**
 * Archived-session rename (through the official session controller).
 *
 * The official controller (`ctx.sessionController`, namespace `session`)
 * exposes `rename({ sessionId, title })` — the same host operation the native
 * UI row menu uses. It resolves (or resumes) the session and writes a durable
 * title event through the session-title service, so cold archived sessions are
 * supported exactly like the native flow. dsh-sess reuses it rather than
 * implementing title writing itself.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { SessionOpError } from './errors.ts'
import { assertSessionId } from './session-id.ts'

/** The official session-controller surface dsh-sess reads. */
export interface SessionControllerFace {
  rename(request: { sessionId: SessionId; title: string }): Promise<{ title: string; seq: number }>
}

/** Minimal official-service faces the rename operation needs. */
export interface RenameSessionHost {
  readonly sessionController?: SessionControllerFace | undefined
}

/** Result of a successful rename. */
export interface RenameSessionResult {
  readonly title: string
}

/** Upper bound applied before delegating to the official validation. */
export const MAX_TITLE_LENGTH = 512

/**
 * Rename one (optionally archived/cold) session through the official
 * controller.
 * @param host - structural face over the official session controller.
 * @param rawSessionId - raw wire value; validated by {@link assertSessionId}.
 * @param rawTitle - raw wire title value.
 * @returns the accepted title.
 * @throws {@link SessionOpError} with a stable code on any refusal or failure.
 */
export async function renameSession(
  host: RenameSessionHost,
  rawSessionId: unknown,
  rawTitle: unknown,
): Promise<RenameSessionResult> {
  const sessionId = assertSessionId(rawSessionId)
  const controller = host.sessionController
  if (controller === undefined) {
    throw new SessionOpError(
      'service-unavailable',
      'renaming is unavailable: the official sessionController service is not mounted',
      { sessionId: String(sessionId) },
    )
  }
  if (typeof rawTitle !== 'string') {
    throw new SessionOpError('bad-request', 'session title must be a string', { sessionId: String(sessionId) })
  }
  const title = rawTitle.trim()
  if (title.length === 0) {
    throw new SessionOpError('bad-request', 'session title must not be empty', { sessionId: String(sessionId) })
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new SessionOpError(
      'bad-request',
      `session title must be at most ${MAX_TITLE_LENGTH} characters`,
      { sessionId: String(sessionId) },
    )
  }
  try {
    const accepted = await controller.rename({ sessionId, title })
    return { title: accepted.title }
  } catch (error) {
    throw mapRenameError(sessionId, error)
  }
}

/** Fold a controller rejection into a dsh-sess business error. */
function mapRenameError(sessionId: SessionId, error: unknown): SessionOpError {
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string') {
    if (code === 'session/title-invalid') {
      const message = error instanceof Error ? error.message : String(error)
      return new SessionOpError('title-invalid', message, { sessionId: String(sessionId) })
    }
    if (code === 'session/not-found') {
      return new SessionOpError(
        'session-not-found',
        `no stored session "${String(sessionId)}"`,
        { sessionId: String(sessionId) },
      )
    }
  }
  const message = error instanceof Error ? error.message : String(error)
  return new SessionOpError(
    'internal',
    `failed to rename session "${String(sessionId)}": ${message}`,
    { sessionId: String(sessionId) },
  )
}
