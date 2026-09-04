/**
 * The dsh-sess manager surface rendered inside the Settings "Session Manager"
 * section: every session with permanent delete for cold sessions, and the
 * archived subset with inline rename. All data derives from the client session
 * and workspace stores (the same projections the sidebar renders); destructive
 * operations go to the host channel.
 */
import { useEffect, useMemo, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { describeFailure, currentSessionRefusal } from './delete-flow.ts'
import {
  archivedRows,
  deriveSessionRows,
  groupByWorkspace,
  relativeTime,
  type SessionRowView,
} from './model.ts'
import { deleteSessionRpc, renameSessionRpc } from './rpc.ts'
import type { DshSessClientContext, Translate } from './types.ts'

/** Manager tab. */
type Mode = 'all' | 'archived'

/** One transient operation outcome shown under the list. */
interface Notice {
  readonly kind: 'ok' | 'error'
  readonly text: string
}

/** Main settings-section component. */
export function SessionManagerPage({
  ctx,
  t,
}: {
  ctx: DshSessClientContext
  t: Translate
}) {
  const [mode, setMode] = useState<Mode>('all')
  const [rows, setRows] = useState<SessionRowView[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const language = useMemo(
    () => (ctx.locale.getLocale()?.active ?? 'en'),
    [ctx],
  )

  // Re-derive rows whenever either store publishes a new snapshot.
  useEffect(() => {
    const refresh = (): void => {
      setRows(deriveSessionRows(
        ctx.sessions.list.getSnapshot(),
        ctx.workspaces.list.getSnapshot(),
      ))
      setNow(Date.now())
    }
    refresh()
    const offSessions = ctx.sessions.list.subscribe(refresh)
    const offWorkspaces = ctx.workspaces.list.subscribe(refresh)
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      offSessions()
      offWorkspaces()
      window.clearInterval(timer)
    }
  }, [ctx])

  // Collapse pending inline flows when the tab or rows change identity.
  useEffect(() => {
    setConfirmId(null)
    setRenameId(null)
    setNotice(null)
  }, [mode])

  const visible = mode === 'archived' ? archivedRows(rows) : rows
  const busy = busyId !== null

  const titleOf = (row: SessionRowView): string => row.title

  // Group rows by workspace (ungrouped last), rows newest-first inside a group.
  const groups = groupByWorkspace(visible, t('row.ungrouped'))

  const runDelete = async (row: SessionRowView): Promise<void> => {
    if (busyId !== null) return
    // The currently viewed session cannot be deleted from under the UI.
    if (ctx.sessions.list.getSnapshot().current === row.sessionId) {
      setNotice({ kind: 'error', text: currentSessionRefusal(t, titleOf(row)) })
      setConfirmId(null)
      return
    }
    setBusyId(row.sessionId)
    setNotice(null)
    try {
      await deleteSessionRpc(ctx.connection.rpc, row.sessionId)
      setConfirmId(null)
      setNotice({ kind: 'ok', text: t('status.deletedOk', { title: titleOf(row) }) })
      await ctx.sessions.refresh()
    } catch (error) {
      setNotice({ kind: 'error', text: describeFailure(error, t, titleOf(row)) })
    } finally {
      setBusyId(null)
    }
  }

  const beginRename = (row: SessionRowView): void => {
    setRenameId(row.sessionId)
    setDraft(row.title)
    setNotice(null)
  }

  const cancelRename = (): void => {
    setRenameId(null)
    setDraft('')
  }

  /** Render one session row (idle, confirming, or renaming). */
  const renderRow = (row: SessionRowView) => (
    <div className="dsh-sess-row" role="listitem" key={row.sessionId}>
      {renameId === row.sessionId ? (
        <div className="dsh-sess-row-rename">
          <Input
            autoFocus
            disabled={busy}
            value={draft}
            placeholder={t('rename.input.placeholder')}
            onChange={event => { setDraft(event.currentTarget.value) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void saveRename(row)
              if (event.key === 'Escape') cancelRename()
            }}
          />
          <Button size="sm" variant="primary" disabled={busy} onClick={() => { void saveRename(row) }}>
            {t('rename.save')}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={cancelRename}>
            {t('rename.cancel')}
          </Button>
        </div>
      ) : confirmId === row.sessionId ? (
        <div className="dsh-sess-row-confirm">
          <div className="dsh-sess-row-confirm-title">
            {t('delete.prompt.title', { title: row.title })}
          </div>
          <div className="dsh-sess-row-confirm-note">
            {t('delete.prompt.warning')} {t('delete.prompt.note')}
          </div>
          <div className="dsh-sess-row-confirm-actions">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setConfirmId(null) }}>
              {t('delete.cancel')}
            </Button>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => { void runDelete(row) }}>
              {busyId === row.sessionId ? t('delete.busyHint') : t('delete.confirm')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="dsh-sess-row-main">
            <div className="dsh-sess-row-title" title={row.sessionId}>{row.title}</div>
            <div className="dsh-sess-row-meta">
              {row.workspaceTitle !== undefined
                ? <span className="dsh-sess-row-meta-workspace">{row.workspaceTitle}</span>
                : <span className="dsh-sess-row-meta-ungrouped">{t('row.ungrouped')}</span>}
              <span>{relativeTime(row.updatedAt, now, language)}</span>
              {row.archived && <span>{t('row.archived')}</span>}
              {row.blank && <span>{t('row.cold')}</span>}
              {row.running && <span>{t('row.running')}</span>}
            </div>
          </div>
          <div className="dsh-sess-row-actions">
            {row.archived && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                title={t('row.rename')}
                onClick={() => { beginRename(row) }}
              >
                {t('row.rename')}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy || row.running}
              title={row.running ? t('row.deleteRunningDisabled') : t('row.delete')}
              onClick={() => { setConfirmId(row.sessionId) }}
            >
              {t('row.delete')}
            </Button>
          </div>
        </>
      )}
    </div>
  )

  const saveRename = async (row: SessionRowView): Promise<void> => {
    const title = draft.trim()
    if (title.length === 0 || title === row.title) {
      cancelRename()
      return
    }
    if (busyId !== null) return
    setBusyId(row.sessionId)
    setNotice(null)
    try {
      const accepted = await renameSessionRpc(ctx.connection.rpc, row.sessionId, title)
      cancelRename()
      setNotice({ kind: 'ok', text: t('status.renamedOk', { title: accepted }) })
      await ctx.sessions.refresh()
    } catch (error) {
      setNotice({ kind: 'error', text: describeFailure(error, t, titleOf(row)) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="dsh-sess-manager">
      <div className="dsh-sess-manager-tabs">
        <Button
          size="sm"
          variant={mode === 'all' ? 'primary' : 'outline'}
          onClick={() => { setMode('all') }}
        >
          {t('tabs.all')}
        </Button>
        <Button
          size="sm"
          variant={mode === 'archived' ? 'primary' : 'outline'}
          onClick={() => { setMode('archived') }}
        >
          {t('tabs.archived')}
        </Button>
      </div>

      <div className="dsh-sess-manager-summary">
        {mode === 'all'
          ? t('summary.count', { count: visible.length })
          : t('summary.archivedCount', { count: visible.length })}
      </div>

      {notice !== null && (
        <div className={`dsh-sess-notice dsh-sess-notice-${notice.kind}`} role="status">
          {notice.text}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="dsh-sess-manager-empty">
          <div>{mode === 'all' ? t('list.emptyAll') : t('list.emptyArchived')}</div>
          {mode === 'all' && (
            <div className="dsh-sess-manager-empty-hint">{t('list.emptyAllHint')}</div>
          )}
        </div>
      ) : (
        <div className="dsh-sess-manager-list" role="list">
          {groups.map(group => (
            <div className="dsh-sess-manager-group" key={group.key}>
              <div className="dsh-sess-manager-group-header" role="presentation">
                {group.title}
                <span className="dsh-sess-manager-group-count">{group.rows.length}</span>
              </div>
              {group.rows.map(row => renderRow(row))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

