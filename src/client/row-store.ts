/**
 * Row-delete request store.
 *
 * The DOM-level row-menu integration (see `row-menu.ts`) cannot render React
 * components itself, so it hands a pending delete request to this tiny module
 * store; the plugin-owned {@link RowDeleteHost} (rendered in its own React
 * root) subscribes and shows the native confirmation modal.
 */

/** One delete request raised from a session row menu. */
export interface RowDeleteRequest {
  readonly sessionId: string
  /** Display title shown in the confirmation copy. */
  readonly title: string
}

type Listener = () => void

let current: RowDeleteRequest | null = null
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) listener()
}

/** Raise a delete request (replaces any pending one). */
export function requestRowDelete(request: RowDeleteRequest): void {
  current = request
  emit()
}

/** Withdraw the pending request (cancel). */
export function clearRowDelete(): void {
  if (current === null) return
  current = null
  emit()
}

/**
 * Reset the module store: drop any pending request and all subscribers.
 * Called when the plugin is torn down so a later remount never resurfaces a
 * stale confirmation or a leaked listener closure.
 */
export function resetRowDelete(): void {
  current = null
  listeners.clear()
}

/** Read the current pending request. */
export function getRowDeleteRequest(): RowDeleteRequest | null {
  return current
}

/** Subscribe to request changes; returns an unsubscribe function. */
export function subscribeRowDelete(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
