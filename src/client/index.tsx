/**
 * dsh-sess browser entry.
 *
 * Registers the plugin's zh/en dictionaries and contributes a Settings
 * section ("Session Manager") through the official client slots system, and —
 * for the sidebar — extends each session row's ellipsis menu with a "Delete
 * session" entry below the native archive item (see `row-menu.ts`). The row
 * menu has no third-party slot, so the extension is a defensive DOM-level
 * addition guarded by structural matching and fiber-resolved session ids;
 * the confirmation modal is plugin-owned and uses the same host delete path
 * as the Settings page.
 *
 * All registrations are fiber-scoped through `ctx.effect` / `ctx.slots.inject`
 * and unwind with the plugin. The client bundle only requires baseline
 * platform modules at runtime (react / jsx-runtime / react-dom client and the
 * ui-primitives module); every other dependency is type-only or inlined.
 */
import { createRoot, type Root } from 'react-dom/client'
import { dictionaries } from './locales.ts'
import { installRowDeleteMenu } from './row-menu.ts'
import { requestRowDelete } from './row-store.ts'
import { RowDeleteHost } from './row-delete.tsx'
import { SessionManagerPage } from './session-manager.tsx'
import { injectStyles } from './styles.ts'
import type { DshSessClientContext, Translate } from './types.ts'

/** Plugin copy namespace. */
export const NS = 'dsh-sess'

/** Cordis plugin identity (matches the profile bundle row). */
export const name = 'dsh-sess'

/** Official client services this plugin consumes. */
export const inject = ['slots', 'locale', 'connection', 'sessions', 'workspaces']

/**
 * Mount the browser half.
 * @param ctx - client context carrying the injected services.
 */
export function apply(ctx: DshSessClientContext): void {
  const dictionaries_ = dictionaries()
  ctx.effect(() => ctx.locale.register(NS, 'zh', dictionaries_.zh), 'dsh-sess: zh dictionary')
  ctx.effect(() => ctx.locale.register(NS, 'en', dictionaries_.en), 'dsh-sess: en dictionary')
  ctx.effect(() => injectStyles(), 'dsh-sess: manager styles')

  const t = ctx.locale.bind(NS) as Translate

  // Contribute the Settings section. `slots.inject` waits for the settings
  // shell to declare the slot and rides its lifetime, so the registration
  // never races the shell and is removed with the plugin.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-sess',
    order: 60,
    label: () => t('nav.label'),
    locale: NS,
    inject: () => ({ t }),
  }, () => <SessionManagerPage ctx={ctx} t={t} />))

  // Sidebar row-menu extension + its confirmation host (own React root).
  let host: HTMLElement | null = null
  let root: Root | null = null
  const mountRowHost = (): void => {
    if (host !== null || typeof document === 'undefined') return
    if (document.body === null) return
    host = document.createElement('div')
    host.id = 'dsh-sess-row-host'
    document.body.appendChild(host)
    root = createRoot(host)
    root.render(<RowDeleteHost ctx={ctx} t={t} />)
  }
  ctx.effect(() => {
    mountRowHost()
    return () => {
      root?.unmount()
      host?.remove()
      host = null
      root = null
    }
  }, 'dsh-sess: row delete host')

  ctx.effect(() => installRowDeleteMenu({
    onRequest: requestRowDelete,
    deleteLabel: () => t('row.delete'),
  }), 'dsh-sess: row menu injector')
}
