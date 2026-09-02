/**
 * dsh-sess business errors.
 *
 * Every host-side operation reports failures through {@link SessionOpError} —
 * a stable `code` plus a diagnostic `message` and optional machine-readable
 * details. The RPC layer folds any thrown value into a wire error of the same
 * shape (`{ code, message, details }`), so the browser half can map codes to
 * user-facing copy without parsing messages.
 */

/** Stable failure categories surfaced to clients. */
export type SessionOpErrorCode =
  /** The request payload failed validation (for example an ill-formed session id). */
  | 'bad-request'
  /** No such session exists in the session store or in persistence. */
  | 'session-not-found'
  /** The session is still open in this process; deletion is refused. */
  | 'agent-busy'
  /** An official rename rejected the requested title. */
  | 'title-invalid'
  /** A required official service is not mounted in this deployment. */
  | 'service-unavailable'
  /** Unanticipated internal failure. */
  | 'internal'

/** Optional machine-readable context attached to an error. */
export interface SessionOpErrorDetails {
  /** The affected session id, when one is known. */
  readonly sessionId?: string
  /** Human-readable reason supplementing the message. */
  readonly reason?: string
}

/** One failed session operation. */
export class SessionOpError extends Error {
  override readonly name = 'SessionOpError'

  constructor(
    readonly code: SessionOpErrorCode,
    message: string,
    readonly details: SessionOpErrorDetails = {},
  ) {
    super(message)
  }
}

/** Fold any thrown value into a known business error (unknown → `internal`). */
export function toSessionOpError(error: unknown): SessionOpError {
  if (error instanceof SessionOpError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new SessionOpError('internal', message)
}

/** Serialized error body returned over the RPC channel. */
export interface WireError {
  readonly code: string
  readonly message: string
  readonly details: Readonly<Record<string, unknown>>
}

/** Serialize a business error for the wire. */
export function toWireError(error: SessionOpError): WireError {
  return {
    code: error.code,
    message: error.message,
    details: error.details as Readonly<Record<string, unknown>>,
  }
}

/** Message used when a required official service is absent. */
export function serviceUnavailable(service: string): SessionOpError {
  return new SessionOpError(
    'service-unavailable',
    `the official ${service} service is not mounted in this deployment`,
    { reason: service },
  )
}
