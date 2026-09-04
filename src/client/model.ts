/**
 * Row derivation over the client session/workspace snapshots.
 *
 * Pure data logic (no React, no DOM) so it can be unit-tested under Node.
 * Mirrors the sidebar projection: workspace membership and archive markers
 * come from the workspace store, titles/activity from the session store, and
 * subagent-child sessions (fork lineage) are excluded — they belong to their
 * parent session and are not independently manageable from this surface.
 */
import type { SessionListState, WorkspaceListState, WorkspaceViewFace } from './types.ts'

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
  /** Owning workspace id when the session is accounted to one. */
  readonly workspaceId?: string
  /** Owning workspace display title when the session is accounted to one. */
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
  // Workspaces are keyed by their stable id; a title is display-only and not
  // unique, so membership lookup must never collapse two same-titled
  // workspaces together. One reverse pass builds the session→workspace map.
  const workspaceBySession = new Map<string, WorkspaceViewFace>()
  for (const workspace of workspaces.items) {
    for (const sessionId of workspace.sessionIds) {
      workspaceBySession.set(sessionId, workspace)
    }
  }
  const archived = new Set(workspaces.archivedSessionIds)
  const rows: SessionRowView[] = []
  for (const id of sessions.ids) {
    const summary = sessions.byId[id]
    if (summary === undefined) continue
    // Subagent children are managed through their parent session.
    if (summary.parentId !== undefined || summary.origin === 'subagent') continue
    const owner = workspaceBySession.get(id)
    rows.push({
      sessionId: id,
      title: summary.displayTitle ?? summary.title ?? id,
      updatedAt: summary.updatedAt,
      running: summary.running === true,
      blank: summary.blank === true,
      archived: archived.has(id),
      ...(owner !== undefined
        ? { workspaceId: owner.workspaceId, workspaceTitle: owner.title }
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
  /** Stable group key: owning workspace id, or the ungrouped sentinel. */
  readonly key: string
  /** Display title: workspace title, or the localized ungrouped label. */
  readonly title: string
  readonly rows: readonly SessionRowView[]
}

/** Group key for sessions that belong to no workspace. */
export const UNGROUPED_GROUP_KEY = '\u0000'

/**
 * Group visible rows by workspace; the ungrouped bucket sorts last.
 * Grouping keys on the stable workspace id so two same-titled workspaces
 * never merge; the title is display-only.
 * @param rows - rows to group (already activity-sorted within groups).
 * @param ungroupedLabel - localized label for sessions without a workspace.
 */
export function groupByWorkspace(
  rows: readonly SessionRowView[],
  ungroupedLabel: string,
): SessionGroup[] {
  const buckets = new Map<string, SessionRowView[]>()
  for (const row of rows) {
    const key = row.workspaceId ?? UNGROUPED_GROUP_KEY
    const bucket = buckets.get(key)
    if (bucket === undefined) buckets.set(key, [row])
    else bucket.push(row)
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      title: key === UNGROUPED_GROUP_KEY ? ungroupedLabel : (bucket[0]?.workspaceTitle ?? key),
      rows: bucket,
    }))
    .sort((left, right) => {
      if (left.key === UNGROUPED_GROUP_KEY) return 1
      if (right.key === UNGROUPED_GROUP_KEY) return -1
      return left.title.localeCompare(right.title)
    })
}
