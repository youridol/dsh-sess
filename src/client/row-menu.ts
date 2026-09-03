/**
 * Session-row menu integration.
 *
 * The native session-row ellipsis menu (ui-workspace, portaled by
 * ui-primitives Menu) is a closed component list — rename/fork/archive with no
 * third-party slot — so dsh-sess adds its "Delete session" entry at the DOM
 * level, directly below the **archive** row:
 *
 * 1. A capture-phase document click listener records when the ellipsis button
 *    of a session row (`role="treeitem"` with a `sessionRow` class) is used.
 * 2. A body MutationObserver notices the portaled `role="menu"` that opens
 *    right afterwards.
 * 3. The menu is only extended when it actually carries an archive item (the
 *    session-row menu); the new entry is cloned from the archive row (same
 *    hashed classes → identical look) and inserted after it.
 * 4. Selecting the entry closes the native menu and raises a delete request
 *    carrying the session id resolved from the row's React fiber (see
 *    `fiber-id.ts`) — never from visible text.
 *
 * All matching is structural and bilingual (`归档`/`archive`), and every
 * failure path degrades to "no entry added" — the feature never guesses a
 * session id.
 */
import { resolveRowSessionId } from './fiber-id.ts'
import type { RowDeleteRequest } from './row-store.ts'

/** Session-row ellipsis inside a workspace tree. */
function findSessionRow(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const button = target.closest('button')
  if (button === null) return null
  const aria = button.getAttribute('aria-label') ?? ''
  const isEllipsis = /操作|actions/i.test(aria)
  if (!isEllipsis) return null
  const row = button.closest('[role="treeitem"]') as HTMLElement | null
  if (row === null || !String(row.className).includes('sessionRow')) return null
  return row
}

/** Visible session title from the row text (fallback: first title-ish cell). */
function rowTitle(row: HTMLElement): string {
  const titleCell = [...row.querySelectorAll('*')]
    .find(el => /title/i.test(String(el.className)) && (el.textContent ?? '').trim().length > 0)
  const text = (titleCell?.textContent ?? row.textContent ?? '').trim()
  return text.length > 0 ? text : ''
}

/** Archive label matching across the shipped zh/en locales. */
const ARCHIVE_LABEL = /归档|archive/i

/** Find the archive entry among menu buttons; returns its row wrapper. */
function archiveRow(menu: HTMLElement): { wrap: HTMLElement; button: HTMLElement; iconClass: string; labelClass: string } | undefined {
  const viewport = menu.querySelector('[role="presentation"]') as HTMLElement | null
  const root = viewport ?? menu
  const buttons = [...root.querySelectorAll('button[role="menuitem"]')] as HTMLElement[]
  let anchor: HTMLElement | undefined
  for (const button of buttons) {
    if (ARCHIVE_LABEL.test(button.textContent ?? '')) anchor = button
  }
  if (anchor === undefined) return undefined
  const wrap = anchor.parentElement
  if (wrap === null) return undefined
  const iconSpan = anchor.querySelector('span')
  const labelSpan = [...anchor.querySelectorAll('span')].pop()
  return {
    wrap,
    button: anchor,
    iconClass: iconSpan?.className ?? '',
    labelClass: labelSpan?.className ?? '',
  }
}

/** Close the open native menu (Escape reaches its document keydown listener). */
function closeMenu(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

/** Trash glyph matching ui-primitives IconTrashOutline16. */
const TRASH_PATH = 'M14.4782 4.84067L14.2138 10.1152C14.1102 12.1872 14.067 13.0115 13.3866 13.9607C13.1044 14.3546 12.7498 14.6912 12.3424 14.9535C11.8239 15.2872 11.2415 15.4316 10.5585 15.4998C9.88727 15.5668 9.04946 15.5656 7.99998 15.5656C6.95051 15.5656 6.1127 15.5668 5.44142 15.4998C4.75851 15.4316 4.17602 15.2872 3.65753 14.9535C3.25012 14.6912 2.89559 14.3546 2.61332 13.9607C1.93296 13.0115 1.88979 12.1872 1.78619 10.1152L1.52179 4.84067L2.89006 4.77277L3.15343 10.0463C3.26221 12.2218 3.32452 12.6015 3.72646 13.1624C3.90825 13.4161 4.13686 13.6334 4.39927 13.8023C4.66204 13.9714 5.00263 14.0792 5.57825 14.1367C6.16562 14.1953 6.92298 14.1963 7.99998 14.1963C9.07699 14.1963 9.83434 14.1953 10.4217 14.1367C10.9973 14.0792 11.3379 13.9714 11.6007 13.8023C11.8631 13.6334 12.0917 13.4161 12.2735 13.1624C12.6755 12.6015 12.7378 12.2218 12.8465 10.0463L13.1099 4.77277L14.4782 4.84067ZM5.43011 6.22849H6.7994V11.3909H5.43011V6.22849ZM9.20056 6.22849H10.5699V11.3909H9.20056V6.22849ZM8.53597 0.434431C9.17976 0.434431 9.6522 0.426926 10.0966 0.571258C10.2357 0.616451 10.3717 0.672554 10.502 0.738948C10.9182 0.951107 11.2464 1.29099 11.7015 1.74612L12.4978 2.54136H15.3742V3.91169H0.625732V2.54136H3.50218L4.29845 1.74612C4.75358 1.29099 5.08174 0.951107 5.49801 0.738948C5.62831 0.672554 5.76425 0.616451 5.90334 0.571258C6.34776 0.426926 6.82021 0.434431 7.46399 0.434431H8.53597ZM7.46399 1.80476C6.73208 1.80476 6.51641 1.81187 6.32617 1.87369C6.25545 1.89667 6.18668 1.92533 6.12041 1.95907C5.96398 2.03878 5.82348 2.16253 5.44142 2.54136H10.5585C10.1765 2.16253 10.036 2.03878 9.87955 1.95907C9.81329 1.92533 9.74452 1.89667 9.6738 1.87369C9.48356 1.81187 9.26789 1.80476 8.53597 1.80476H7.46399Z'

/** Menu-injection marker (per open menu). */
const INJECTED_ATTR = 'data-dsh-sess-menu-injected'

/** Maximum age of a recorded ellipsis click before a menu is no longer its own. */
const PENDING_WINDOW_MS = 600

/** Options for {@link installRowDeleteMenu}. */
export interface RowDeleteMenuOptions {
  /** Raise a delete request (opens the confirm modal). */
  onRequest(request: RowDeleteRequest): void
  /** Current delete label (localized copy). */
  deleteLabel(): string
}

/**
 * Install the row-menu extension.
 * @param options - request sink and copy source.
 * @returns a disposer removing all listeners.
 */
export function installRowDeleteMenu(options: RowDeleteMenuOptions): () => void {
  let pending: { row: HTMLElement; title: string; at: number } | null = null
  let expiry: number | undefined

  const clearPending = (): void => {
    pending = null
    if (expiry !== undefined) window.clearTimeout(expiry)
    expiry = undefined
  }

  const onCaptureClick = (event: MouseEvent): void => {
    const row = findSessionRow(event.target)
    if (row === null) return
    // Ellipsis toggles; record the row and let the observer do the rest.
    pending = { row, title: rowTitle(row), at: Date.now() }
    if (expiry !== undefined) window.clearTimeout(expiry)
    expiry = window.setTimeout(clearPending, PENDING_WINDOW_MS + 200)
  }

  const consumeMenu = (menu: HTMLElement): void => {
    const recorded = pending
    if (recorded === null || Date.now() - recorded.at > PENDING_WINDOW_MS) return
    pending = null
    if (expiry !== undefined) window.clearTimeout(expiry)
    expiry = undefined

    const template = archiveRow(menu)
    if (template === undefined) return
    const viewport = (menu.querySelector('[role="presentation"]') as HTMLElement | null) ?? menu
    if (viewport.hasAttribute(INJECTED_ATTR)) return
    viewport.setAttribute(INJECTED_ATTR, 'true')

    const wrap = template.wrap.cloneNode(true) as HTMLElement
    const button = wrap.querySelector('button[role="menuitem"]') as HTMLElement | null
    if (button === null) return
    button.innerHTML = ''
    const icon = document.createElement('span')
    icon.className = template.iconClass
    icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${TRASH_PATH}" fill="currentColor"/></svg>`
    const label = document.createElement('span')
    label.className = template.labelClass
    label.textContent = options.deleteLabel()
    button.appendChild(icon)
    button.appendChild(label)
    button.classList.add('dsh-sess-menu-danger')
    button.setAttribute('aria-label', options.deleteLabel())

    const onPick = (event: MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      const row = recorded.row
      closeMenu()
      const sessionId = resolveRowSessionId(row)
      if (sessionId === undefined) return // never guess; feature silently skips
      options.onRequest({ sessionId, title: recorded.title || sessionId })
    }
    button.addEventListener('click', onPick, { once: true })
    template.wrap.insertAdjacentElement('afterend', wrap)
  }

  const onMutation = (mutations: MutationRecord[]): void => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue
        if (node.matches('[role="menu"]')) consumeMenu(node)
        node.querySelectorAll?.('[role="menu"]').forEach(menu => consumeMenu(menu as HTMLElement))
      }
    }
  }

  document.addEventListener('click', onCaptureClick, true)
  const observer = new MutationObserver(onMutation)
  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    document.removeEventListener('click', onCaptureClick, true)
    observer.disconnect()
    clearPending()
  }
}
