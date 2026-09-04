/**
 * Row-delete store tests: request lifecycle and plugin-teardown reset.
 * Pure module — no React/DOM, runs under Node.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearRowDelete,
  getRowDeleteRequest,
  requestRowDelete,
  resetRowDelete,
  subscribeRowDelete,
} from '../../src/client/row-store.ts'

describe('row-delete store', () => {
  // The store is a module singleton; reset between cases so subscribers and
  // the pending request never leak across assertions.
  beforeEach(() => { resetRowDelete() })

  it('raises, reads, and clears a pending request', () => {
    expect(getRowDeleteRequest()).toBeNull()
    requestRowDelete({ sessionId: 'session-1', title: 'One' })
    expect(getRowDeleteRequest()).toEqual({ sessionId: 'session-1', title: 'One' })
    clearRowDelete()
    expect(getRowDeleteRequest()).toBeNull()
  })

  it('notifies subscribers on raise and clear', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeRowDelete(listener)
    requestRowDelete({ sessionId: 'session-1', title: 'One' })
    expect(listener).toHaveBeenCalledTimes(1)
    clearRowDelete()
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    requestRowDelete({ sessionId: 'session-2', title: 'Two' })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('replaces a pending request rather than stacking', () => {
    requestRowDelete({ sessionId: 'session-1', title: 'One' })
    requestRowDelete({ sessionId: 'session-2', title: 'Two' })
    expect(getRowDeleteRequest()?.sessionId).toBe('session-2')
  })

  it('resetRowDelete drops the request and every subscriber', () => {
    const listener = vi.fn()
    subscribeRowDelete(listener)
    requestRowDelete({ sessionId: 'session-1', title: 'One' })
    const callsBeforeReset = listener.mock.calls.length
    expect(callsBeforeReset).toBeGreaterThan(0)
    resetRowDelete()
    expect(getRowDeleteRequest()).toBeNull()
    // The reset cleared the subscriber set, so later requests add no calls.
    requestRowDelete({ sessionId: 'session-2', title: 'Two' })
    expect(listener.mock.calls.length).toBe(callsBeforeReset)
  })

  it('clearRowDelete on an empty store is a no-op', () => {
    resetRowDelete()
    expect(() => clearRowDelete()).not.toThrow()
    expect(getRowDeleteRequest()).toBeNull()
  })
})
