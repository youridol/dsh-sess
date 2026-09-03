/**
 * Session-id resolution from a sidebar session row element.
 *
 * The native sidebar (ui-workspace) renders each session row as a
 * `role="treeitem"` element whose `SessionNodeItem` React fiber carries the
 * authoritative session id in `memoizedProps.node.id`. dsh-sess resolves the
 * id by walking that fiber chain instead of trusting visible text (titles are
 * not unique and must never drive a destructive action).
 *
 * This walks React's internal fiber tree, so it is deliberately defensive:
 * when the chain shape changes (or the id fails validation) the caller skips
 * the feature rather than risking the wrong session.
 */

/** Ids accepted for deletion mirror the host validation charset. */
const SESSION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

function isSessionId(value: unknown): value is string {
  return typeof value === 'string'
    && value !== '.' && value !== '..' && !value.includes('..')
    && SESSION_ID_PATTERN.test(value)
}

/** Read a DOM node's React fiber (React 18 property naming). */
function fiberOf(element: Element): object | undefined {
  const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'))
  if (key === undefined) return undefined
  return (element as unknown as Record<string, object>)[key]
}

/**
 * Resolve the session id of a session row.
 * @param row - the `role="treeitem"` session row element.
 * @returns the validated session id, or `undefined` when it cannot be proven.
 */
export function resolveRowSessionId(row: Element): string | undefined {
  let fiber: object | null = fiberOf(row) ?? null
  let depth = 0
  while (fiber !== null && depth < 100) {
    const props = (fiber as { memoizedProps?: unknown }).memoizedProps as
      | { node?: { id?: unknown; sessionId?: unknown }; sessionId?: unknown }
      | undefined
    if (props !== undefined) {
      const node = props.node
      if (node !== undefined && isSessionId(node.id)) return node.id
      if (node !== undefined && isSessionId(node.sessionId)) return node.sessionId
      if (isSessionId(props.sessionId)) return props.sessionId
    }
    fiber = (fiber as { return?: object | null }).return ?? null
    depth += 1
  }
  return undefined
}
