/**
 * dsh-sess manager styles (injected into the settings surface).
 *
 * Scoped under the `dsh-sess-` prefix and tolerant: color/label tokens come
 * from the theme's `--dsw-*` aliases where available with neutral fallbacks,
 * so the surface stays readable in any deployment.
 */
export const STYLE_ID = 'dsh-sess-styles'

const CSS = `
.dsh-sess-manager { display: flex; flex-direction: column; gap: 10px; min-height: 120px; }
.dsh-sess-manager-tabs { display: flex; gap: 6px; }
.dsh-sess-manager-summary { font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-tertiary, rgba(120,120,120,0.9)); }
.dsh-sess-notice { font-size: 12px; line-height: 16px; border-radius: 6px; padding: 6px 8px; }
.dsh-sess-notice-ok { color: var(--dsw-alias-state-success-primary, #2e7d32); }
.dsh-sess-notice-error { color: var(--dsw-alias-state-danger-primary, #c62828); background: rgba(198,40,40,0.06); }
.dsh-sess-manager-empty { display: flex; flex-direction: column; gap: 4px; color: var(--dsw-alias-label-tertiary, rgba(120,120,120,0.9)); font-size: 13px; padding: 18px 2px; }
.dsh-sess-manager-empty-hint { font-size: 12px; opacity: 0.85; }
.dsh-sess-manager-list { display: flex; flex-direction: column; max-height: min(46vh, 480px); overflow-y: auto; gap: 4px; }
.dsh-sess-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px; border-radius: 8px; }
.dsh-sess-row:hover { background: var(--dsw-alias-surface-hover, rgba(128,128,128,0.08)); }
.dsh-sess-row-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dsh-sess-row-title { font-size: 13px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-sess-row-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; line-height: 14px; color: var(--dsw-alias-label-tertiary, rgba(120,120,120,0.9)); }
.dsh-sess-row-actions { display: flex; gap: 6px; flex: none; }
.dsh-sess-row-rename, .dsh-sess-row-confirm { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.dsh-sess-row-rename { flex-direction: row; align-items: center; }
.dsh-sess-row-confirm-title { font-size: 13px; font-weight: 600; }
.dsh-sess-row-confirm-note { font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-secondary, rgba(100,100,100,0.9)); }
.dsh-sess-row-confirm-actions { display: flex; justify-content: flex-end; gap: 6px; }
.dsh-sess-row-confirm-error { font-size: 12px; line-height: 16px; color: var(--dsw-alias-state-danger-primary, #c62828); }
/* Injected session-row menu entry (danger affordance). */
.dsh-sess-menu-danger { color: var(--dsw-alias-state-danger-primary, #c62828); }
.dsh-sess-menu-danger:hover { color: var(--dsw-alias-state-danger-primary, #c62828); }
`

/** Inject the stylesheet once; returns a disposer that removes the tag. */
export function injectStyles(): () => void {
  if (typeof document === 'undefined') return () => undefined
  let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (tag === null) {
    tag = document.createElement('style')
    tag.id = STYLE_ID
    tag.textContent = CSS
    document.head.appendChild(tag)
  }
  return () => {
    tag?.remove()
  }
}
