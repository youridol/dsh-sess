/**
 * dsh-sess host entry.
 *
 * A cordis plugin mounted through the profile bundle patch (`cordis.patch.yml`
 * inserts the `dsh-sess` row). It exposes the session-management operations
 * the web UI calls on the private `/dsh-sess` RPC channel. Every operation is
 * built from the official dsh host services (`sessions`, `sessionPersistence`,
 * `workspaceRegistry`, `sessionController`) — no harness source is modified.
 */

import type { Context } from '@deepseek-ai/cordis'
import { installSessChannel } from './host/rpc.ts'

/** Cordis plugin identity. */
export const name = 'dsh-sess'

/** Official services this plugin requires; Cordis holds it pending until ready. */
export const inject = [
  'connection',
  'webServer',
  'sessions',
  'sessionPersistence',
  'workspaceRegistry',
]

/**
 * Install the plugin: serve the session RPC surface for the plugin lifetime.
 * @param ctx - host context with the injected services.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => installSessChannel(ctx), 'dsh-sess: session RPC channel')
}
