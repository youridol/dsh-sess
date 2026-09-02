/**
 * dsh-sess browser entry.
 *
 * Registers the plugin's zh/en dictionaries and contributes a Settings
 * section ("Session Manager") through the official client slots system. The
 * section renders the session manager; destructive operations (permanent
 * deletion, rename) are performed by the host half over the `/dsh-sess`
 * channel. All registrations are fiber-scoped through `ctx.effect` /
 * `ctx.slots.inject`, so they unwind with the plugin.
 *
 * The client bundle only requires baseline platform modules at runtime
 * (react / jsx-runtime and the ui-primitives module); every other dependency
 * is type-only or inlined by the build.
 */
import { dictionaries } from './locales.ts'
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
}
