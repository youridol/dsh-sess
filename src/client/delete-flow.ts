/**
 * Shared user-facing error copy for delete/rename failures.
 */
import { RpcBusinessError } from './rpc.ts'
import type { Translate } from './types.ts'

/** Codes with dedicated localized copy; anything else shows the host message. */
const KNOWN_ERROR_CODES = new Set([
  'agent-busy',
  'session-not-found',
  'title-invalid',
  'service-unavailable',
  'bad-request',
  'internal',
])

/**
 * Map a failed operation to localized copy.
 *
 * `agent-busy` failures are refined using the host diagnostics carried in
 * `details`: a running agent, or a retained (opened-before, idle) session,
 * each get their own message that includes the exact session id the host saw.
 *
 * @param error - thrown value (usually an {@link RpcBusinessError}).
 * @param t - bound dsh-sess translate.
 * @param title - display title of the affected session.
 */
export function describeFailure(
  error: unknown,
  t: Translate,
  title: string,
): string {
  if (error instanceof RpcBusinessError && KNOWN_ERROR_CODES.has(error.code)) {
    if (error.code === 'agent-busy') {
      const details = error.details as { reason?: string; sessionId?: string; retained?: string }
      if (details.reason === 'running') {
        return t('error.running', { title })
      }
      if (details.reason === 'idle' || details.retained === 'session') {
        return t('error.retained', {
          title,
          sessionId: details.sessionId ?? title,
        })
      }
      // Unknown refusal reason: fall back to the generic in-process copy so a
      // future host diagnostic never regresses to a raw message.
      return t('error.agent-busy', { title })
    }
    return t(`error.${error.code}`, { title, message: error.message })
  }
  if (error instanceof RpcBusinessError) return error.message
  return error instanceof Error ? error.message : String(error)
}

/**
 * Localized refusal used before any RPC when the target is the session the
 * user is currently viewing (the client knows this; the host cannot).
 * @param t - bound dsh-sess translate.
 * @param title - display title of the current session.
 */
export function currentSessionRefusal(t: Translate, title: string): string {
  return t('error.current-session', { title })
}
