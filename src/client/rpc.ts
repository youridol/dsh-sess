/**
 * Client-side RPC access to the dsh-sess host channel.
 *
 * All plugin operations travel over the private `/dsh-sess` channel (the
 * shared `/api` channel is owned by the official api gateway). Failures come
 * back as the standard envelope and surface as {@link RpcBusinessError} with a
 * stable code; the UI maps codes to localized copy.
 */
import type { RpcCaller } from './types.ts'

/** The dsh-sess channel (must match the host `SESS_CHANNEL`). */
export const SESS_CHANNEL = '/dsh-sess'

/** Host endpoint names. */
export const Endpoints = {
  deleteSession: 'dshSess.deleteSession',
  renameSession: 'dshSess.renameSession',
} as const

/** A business failure returned by the host. */
export class RpcBusinessError extends Error {
  override readonly name = 'RpcBusinessError'

  constructor(
    readonly code: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message)
  }
}

/** Invoke one dsh-sess endpoint and unwrap the envelope. */
export async function callSessionEndpoint<T>(
  rpc: RpcCaller,
  endpoint: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const result = await rpc.call(SESS_CHANNEL, endpoint, payload, signal)
  if (!result.ok) {
    throw new RpcBusinessError(result.error.code, result.error.message, result.error.details)
  }
  return result.value as T
}

/** Wire value returned by a successful permanent deletion. */
export interface DeleteSessionValue {
  readonly deleted: string
  /** Diagnostic workspace-accounting refusals that will self-heal. */
  readonly detachWarnings?: readonly string[]
}

/** Permanently delete one session; resolves to the deletion result. */
export async function deleteSessionRpc(rpc: RpcCaller, sessionId: string): Promise<DeleteSessionValue> {
  return callSessionEndpoint<DeleteSessionValue>(rpc, Endpoints.deleteSession, { sessionId })
}

/** Rename one session through the host; resolves to the accepted title. */
export async function renameSessionRpc(rpc: RpcCaller, sessionId: string, title: string): Promise<string> {
  const value = await callSessionEndpoint<{ title: string }>(rpc, Endpoints.renameSession, { sessionId, title })
  return value.title
}
