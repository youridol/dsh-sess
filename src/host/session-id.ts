/**
 * Session id validation.
 *
 * A session id arrives over the wire as an untrusted string. It is later used
 * to resolve a session header (persistence lookup) and to build/compare the
 * artifact directory path the JSONL backend owns — therefore it must be one
 * clean path segment that can never escape the session store tree.
 *
 * The accepted set is deliberately narrower than the harness's own
 * `[A-Za-z0-9._~-]` mint charset: the JSONL backend's path encoder
 * (`encodeSegment`) keeps `A-Za-z0-9._-` literal and escapes everything else
 * (`~` becomes `~007E`, `.`/`..` get special-cased), so forbidding `~` and
 * dot-only values guarantees the on-disk session directory name equals the id
 * verbatim. That equality is what the artifact removal guard relies on — no
 * private path-encoding knowledge is duplicated.
 */
import type { SessionId as SessionIdBrand } from '@deepseek-ai/dsh-session/types'
import { SessionOpError } from './errors.ts'

/** Session ids the JSONL backend stores verbatim as one directory segment. */
const SESSION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

/**
 * Validate and normalize a wire session id.
 * @param value - raw value from the request payload.
 * @returns the branded session id.
 * @throws {@link SessionOpError} with `bad-request` when the value is not a
 * valid session id.
 */
export function assertSessionId(value: unknown): SessionIdBrand {
  if (
    typeof value !== 'string'
    || !SESSION_ID_PATTERN.test(value)
    || value === '.' || value === '..'
    || value.includes('..')
  ) {
    throw new SessionOpError('bad-request', `invalid session id: ${JSON.stringify(value)}`)
  }
  // SessionId is a compile-time brand; the runtime value is the string itself.
  return value as SessionIdBrand
}
