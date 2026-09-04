/**
 * delete-flow tests: user-facing error copy branches.
 * Pure module — no React/DOM, runs under Node.
 */
import { describe, expect, it } from 'vitest'
import { describeFailure, currentSessionRefusal } from '../../src/client/delete-flow.ts'
import { RpcBusinessError } from '../../src/client/rpc.ts'
import type { Translate } from '../../src/client/types.ts'

/** Captures the requested key so a test can assert which copy was chosen. */
function translator(): { t: Translate; keys: string[] } {
  const keys: string[] = []
  const t: Translate = (key) => {
    keys.push(key)
    return `<${key}>`
  }
  return { t, keys }
}

function businessError(code: string, details: Record<string, unknown> = {}): RpcBusinessError {
  return new RpcBusinessError(code, `${code} message`, details)
}

describe('describeFailure', () => {
  it('maps agent-busy running to the running copy', () => {
    const { t, keys } = translator()
    const text = describeFailure(
      businessError('agent-busy', { reason: 'running', sessionId: 'session-1' }),
      t,
      'Alpha',
    )
    expect(keys).toContain('error.running')
    expect(text).toBe('<error.running>')
  })

  it('maps agent-busy idle to the retained copy with the host session id', () => {
    const { t, keys } = translator()
    describeFailure(
      businessError('agent-busy', { reason: 'idle', sessionId: 'session-1', retained: 'session' }),
      t,
      'Alpha',
    )
    expect(keys).toContain('error.retained')
  })

  it('maps agent-busy with a session-store retention marker to the retained copy', () => {
    const { t, keys } = translator()
    describeFailure(
      businessError('agent-busy', { retained: 'session' }),
      t,
      'Alpha',
    )
    expect(keys).toContain('error.retained')
  })

  it('falls back to the generic agent-busy copy for an unknown refusal reason', () => {
    const { t, keys } = translator()
    describeFailure(businessError('agent-busy', {}), t, 'Alpha')
    expect(keys).toContain('error.agent-busy')
  })

  it('maps known non-agent-busy codes to their localized keys', () => {
    const { t, keys } = translator()
    for (const code of ['session-not-found', 'title-invalid', 'service-unavailable', 'bad-request', 'internal']) {
      describeFailure(businessError(code), t, 'Alpha')
      expect(keys).toContain(`error.${code}`)
    }
  })

  it('shows the host message for unknown codes and non-business errors', () => {
    const { t } = translator()
    expect(describeFailure(businessError('mystery', {}), t, 'Alpha')).toBe('mystery message')
    expect(describeFailure(new Error('boom'), t, 'Alpha')).toBe('boom')
    expect(describeFailure('naked string', t, 'Alpha')).toBe('naked string')
  })
})

describe('currentSessionRefusal', () => {
  it('returns the current-session copy', () => {
    const { t, keys } = translator()
    currentSessionRefusal(t, 'Alpha')
    expect(keys).toContain('error.current-session')
  })
})
