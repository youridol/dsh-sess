/**
 * Row derivation over the client session/workspace snapshots.
 *
 * Pure data logic (no React, no DOM) so it can be unit-tested under Node.
 * Mirrors the sidebar projection: workspace membership and archive markers
 * come from the workspace store, titles/activity from the session store, and
 * subagent-child sessions (fork lineage) are excluded — they belong to their
 * parent session and are not independently manageable from this surface.
 */
import type { SessionListState, WorkspaceListState } from './types.ts'

/** One rendered session row in the manager. */
export interface SessionRowView {
  readonly sessionId: string
  /** Display title (durable title or a display fallback from the store). */
  readonly title: string
  /** Last-activity epoch milliseconds. */
  readonly updatedAt: number
  /** Agent is running a turn right now. */
  readonly running: boolean
  /** Session has no committed turn yet. */
  readonly blank: boolean
  /** Session is in the registry archive set. */
  readonly archived: boolean
  /** Workspace display title when the session is accounted to one. */
  readonly workspaceTitle?: string
}

/**
 * Build the manager rows from the two client snapshots.
 * @param sessions - session store snapshot.
 * @param workspaces - workspace store snapshot.
 * @returns rows ordered by activity (newest first).
 */
export function deriveSessionRows(
  sessions: SessionListState,
  workspaces: WorkspaceListState,
): SessionRowView[] {
  const workspaceTitleBySession = new Map<string, string>()
  for (const workspace of workspaces.items) {
    for (const sessionId of workspace.sessionIds) {
      workspaceTitleBySession.set(sessionId, workspace.title)
    }
  }
  const archived = new Set(workspaces.archivedSessionIds)
  const rows: SessionRowView[] = []
  for (const id of sessions.ids) {
    const summary = sessions.byId[id]
    if (summary === undefined) continue
    // Subagent children are managed through their parent session.
    if (summary.parentId !== undefined || summary.origin === 'subagent') continue
    rows.push({
      sessionId: id,
      title: summary.displayTitle ?? summary.title ?? id,
      updatedAt: summary.updatedAt,
      running: summary.running === true,
      blank: summary.blank === true,
      archived: archived.has(id),
      ...(workspaceTitleBySession.has(id)
        ? { workspaceTitle: workspaceTitleBySession.get(id) }
        : {}),
    })
  }
  rows.sort((left, right) => right.updatedAt - left.updatedAt)
  return rows
}

/** Filter a row set down to archived sessions (archive order preserved). */
export function archivedRows(rows: readonly SessionRowView[]): SessionRowView[] {
  return rows.filter(row => row.archived)
}

/**
 * Compact relative time (e.g. "just now", "3 min ago") via Intl.
 * @param updatedAt - epoch milliseconds of last activity.
 * @param now - current epoch milliseconds.
 * @param language - BCP 47 language tag for the active UI locale.
 */
export function relativeTime(updatedAt: number, now: number, language: string): string {
  const deltaSeconds = Math.round((now - updatedAt) / 1000)
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  if (deltaSeconds < 60) return format.format(-deltaSeconds, 'second')
  if (deltaSeconds < 3600) return format.format(-Math.floor(deltaSeconds / 60), 'minute')
  if (deltaSeconds < 86400) return format.format(-Math.floor(deltaSeconds / 3600), 'hour')
  return format.format(-Math.floor(deltaSeconds / 86400), 'day')
}

/** One workspace group of visible rows. */
export interface SessionGroup {
  readonly key: string
  readonly title: string
  readonly rows: readonly SessionRowView[]
}

/**
 * Group visible rows by workspace; the ungrouped bucket sorts last.
 * @param rows - rows to group (already activity-sorted within groups).
 * @param ungroupedLabel - localized label for sessions without a workspace.
 */
export function groupByWorkspace(
  rows: readonly SessionRowView[],
  ungroupedLabel: string,
): SessionGroup[] {
  const buckets = new Map<string, SessionRowView[]>()
  for (const row of rows) {
    const key = row.workspaceTitle ?? '\u0000'
    const bucket = buckets.get(key)
    if (bucket === undefined) buckets.set(key, [row])
    else bucket.push(row)
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      title: key === '\u0000' ? ungroupedLabel : key,
      rows: bucket,
    }))
    .sort((left, right) => {
      if (left.key === '\u0000') return 1
      if (right.key === '\u0000') return -1
      return left.title.localeCompare(right.title)
    })
}
