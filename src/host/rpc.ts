/**
 * dsh-sess host RPC surface.
 *
 * The plugin serves its own operations on the private `/dsh-sess` channel
 * (`ctx.connection.rpc.handle`) rather than the shared `/api` channel, which
 * the official api gateway owns. The channel is an ordinary prefix route on
 * the web server and inherits the connection layer's trust fence; the browser
 * half calls back through the same public `ctx.connection.rpc` API.
 *
 * Endpoints are versioned under the `dshSess.*` namespace and return the
 * standard RPC envelope `{ ok: true, value } | { ok: false, error: { code,
 * message, details } }`. All business failures fold to stable codes defined in
 * `errors.ts`.
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  deleteSession,
  type DeleteSessionHost,
  type LiveSessionFace,
  type PersistenceFace,
  type WorkspaceRegistryFace,
} from './delete-session.ts'
import { SessionOpError, toSessionOpError, toWireError, type WireError } from './errors.ts'
import {
  renameSession,
  type RenameSessionHost,
  type SessionControllerFace,
} from './rename-session.ts'

/** dsh-sess private RPC channel (not `/api`, which the gateway owns). */
export const SESS_CHANNEL = '/dsh-sess'

/** Endpoint names served on {@link SESS_CHANNEL}. */
export const Endpoints = {
  deleteSession: 'dshSess.deleteSession',
  renameSession: 'dshSess.renameSession',
} as const

type WireResult =
  | { ok: true; value: unknown }
  | { ok: false; error: WireError }

/** Response builders shared by every endpoint. */
function ok(value: unknown): WireResult {
  return { ok: true, value }
}

function fail(error: SessionOpError): WireResult {
  return { ok: false, error: toWireError(error) }
}

/** Read a required string field from a request payload. */
function stringField(payload: unknown, field: string): unknown {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return undefined
  return (payload as Record<string, unknown>)[field]
}

/** dsh-sess service faces resolved from a host context. */
export interface SessHost extends DeleteSessionHost, RenameSessionHost {
  readonly sessionController?: SessionControllerFace | undefined
}

/**
 * Resolve the official service faces the plugin reads from a host context.
 * Deletion faces are mandatory: without them the operations cannot run
 * safely. The session controller (rename) is optional and degrades with a
 * clear error when absent.
 * @param ctx - host context whose services are available (plugin `inject`).
 */
export function resolveSessHost(ctx: Context): SessHost {
  // SAFETY: the official packages register these services on the host context
  // under these exact keys (see the package READMEs / Context merges); the
  // faces above are the narrow public surface dsh-sess consumes.
  const sessions = ctx.get('sessions') as LiveSessionFace | undefined
  const persistence = ctx.get('sessionPersistence') as PersistenceFace | undefined
  const workspaceRegistry = ctx.get('workspaceRegistry') as WorkspaceRegistryFace | undefined
  const sessionController = ctx.get('sessionController') as SessionControllerFace | undefined
  if (sessions === undefined || persistence === undefined || workspaceRegistry === undefined) {
    const missing = [
      sessions === undefined ? 'sessions' : null,
      persistence === undefined ? 'sessionPersistence' : null,
      workspaceRegistry === undefined ? 'workspaceRegistry' : null,
    ].filter((name): name is string => name !== null)
    throw new SessionOpError(
      'service-unavailable',
      `dsh-sess requires official services that are not mounted: ${missing.join(', ')}`,
      { reason: missing.join(',') },
    )
  }
  return { sessions, persistence, workspaceRegistry, sessionController }
}

/**
 * Build the channel handler bound to official service faces.
 * @param host - official session-service faces.
 */
export function createChannelHandler(host: SessHost) {
  return async (endpoint: string, payload: unknown): Promise<WireResult> => {
    switch (endpoint) {
      case Endpoints.deleteSession: {
        try {
          const result = await deleteSession(host, stringField(payload, 'sessionId'))
          return ok({ deleted: String(result.deleted) })
        } catch (error) {
          return fail(toSessionOpError(error))
        }
      }
      case Endpoints.renameSession: {
        try {
          const result = await renameSession(
            host,
            stringField(payload, 'sessionId'),
            stringField(payload, 'title'),
          )
          return ok({ title: result.title })
        } catch (error) {
          return fail(toSessionOpError(error))
        }
      }
      default:
        return {
          ok: false,
          error: { code: 'bad-request', message: `unknown dsh-sess endpoint: ${endpoint}`, details: {} },
        }
    }
  }
}

/**
 * Install the `/dsh-sess` channel on a host context.
 *
 * `ctx.connection.rpc.handle` binds the route and its disposer to the caller
 * fiber, so calling this inside a plugin effect keeps the channel alive
 * exactly as long as the plugin.
 *
 * @param ctx - host context with connection and the official session services.
 * @returns the channel disposer.
 */
export function installSessChannel(ctx: Context): () => Promise<void> {
  const connection = ctx.get('connection') as {
    rpc: {
      handle(channel: string, handler: (endpoint: string, payload: unknown) => Promise<WireResult>): () => Promise<void>
    }
  } | undefined
  if (connection === undefined) {
    throw new SessionOpError('service-unavailable', 'the official connection service is not mounted')
  }
  const host = resolveSessHost(ctx)
  return connection.rpc.handle(SESS_CHANNEL, createChannelHandler(host))
}
