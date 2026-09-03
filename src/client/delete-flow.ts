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
    return t(`error.${error.code}`, { title, message: error.message })
  }
  if (error instanceof RpcBusinessError) return error.message
  return error instanceof Error ? error.message : String(error)
}
