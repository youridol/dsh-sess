/**
 * dsh-sess browser copy (zh / en).
 *
 * The dictionaries are plain string tables keyed by a shared union
 * ({@link DshSessKey}); `en` is checked to carry exactly the `zh` keys so the
 * two languages can never drift apart (see the locale test).
 */

/** zh source of truth. */
const zh = {
  'nav.label': '会话管理',

  'tabs.all': '全部会话',
  'tabs.archived': '归档会话',

  'summary.count': '共 {count} 条',
  'summary.archivedCount': '归档 {count} 条',
  'list.emptyAll': '还没有会话。',
  'list.emptyArchived': '没有归档会话。',
  'list.emptyAllHint': '会话列表与侧边栏一致；删除仅对冷会话生效（重启 dsh 后所有会话都会变冷）。',

  'row.archived': '已归档',
  'row.running': '运行中',
  'row.cold': '冷会话',
  'row.ungrouped': '未分组',
  'row.delete': '删除会话',
  'row.rename': '重命名',
  'row.renaming': '重命名…',
  'row.deleting': '删除中…',
  'row.deleteRunningDisabled': '会话正在运行，请等待完成后再删除。',

  'delete.prompt.title': '确认删除「{title}」？',
  'delete.prompt.warning': '将永久删除该会话的完整日志（含压缩产物）与工作区记账，且不可恢复。',
  'delete.prompt.note': '仅冷会话可删除；若会话仍在本进程打开，请先关闭或重启 dsh。',
  'delete.confirm': '永久删除',
  'delete.cancel': '取消',
  'delete.busyHint': '正在删除…',

  'rename.input.placeholder': '输入新标题',
  'rename.save': '保存',
  'rename.cancel': '取消',

  'status.deletedOk': '已删除会话「{title}」。',
  'status.renamedOk': '已重命名为「{title}」。',

  'error.agent-busy': '会话「{title}」仍在本进程打开，暂不能删除。请关闭该会话或重启 dsh（重启后所有会话变为冷会话）再删除。',
  'error.running': '会话「{title}」正在运行中，请等它结束后再删除。',
  'error.retained': '会话「{title}」（{sessionId}）仍被本进程保留（曾打开过）。官方当前不提供关闭会话的接口，重启 dsh 后即可删除。',
  'error.current-session': '「{title}」是当前正在查看的会话，不能删除。请先切换到其它会话并重启 dsh 后再删除。',
  'error.session-not-found': '找不到会话「{title}」：它可能已经被删除。',
  'error.title-invalid': '标题不被接受：{message}',
  'error.service-unavailable': '当前部署缺少所需服务：{message}',
  'error.bad-request': '请求无效：{message}',
  'error.internal': '操作失败：{message}',
} as const

/** Dictionary type for one namespace: every zh key. */
export type DshSessKey = keyof typeof zh

/** en mirror — structurally required to carry exactly the zh keys. */
const en: Record<DshSessKey, string> = {
  'nav.label': 'Session Manager',

  'tabs.all': 'All sessions',
  'tabs.archived': 'Archived',

  'summary.count': '{count} total',
  'summary.archivedCount': '{count} archived',
  'list.emptyAll': 'No sessions yet.',
  'list.emptyArchived': 'No archived sessions.',
  'list.emptyAllHint': 'This list mirrors the sidebar. Deletion applies to cold sessions only (restarting DSH makes every session cold).',

  'row.archived': 'Archived',
  'row.running': 'Running',
  'row.cold': 'Cold',
  'row.ungrouped': 'Ungrouped',
  'row.delete': 'Delete session',
  'row.rename': 'Rename',
  'row.renaming': 'Renaming…',
  'row.deleting': 'Deleting…',
  'row.deleteRunningDisabled': 'This session is running; wait for it to finish before deleting.',

  'delete.prompt.title': 'Delete "{title}"?',
  'delete.prompt.warning': 'This permanently removes the session log (including compressed artifacts) and its workspace accounting. It cannot be undone.',
  'delete.prompt.note': 'Only cold sessions can be deleted. If the session is still open in this process, close it or restart DSH first.',
  'delete.confirm': 'Delete permanently',
  'delete.cancel': 'Cancel',
  'delete.busyHint': 'Deleting…',

  'rename.input.placeholder': 'Enter a new title',
  'rename.save': 'Save',
  'rename.cancel': 'Cancel',

  'status.deletedOk': 'Deleted session "{title}".',
  'status.renamedOk': 'Renamed to "{title}".',

  'error.agent-busy': 'Session "{title}" is still open in this process and cannot be deleted. Close it or restart DSH (which makes every session cold) and try again.',
  'error.running': 'Session "{title}" is running; wait for it to finish before deleting.',
  'error.retained': 'Session "{title}" ({sessionId}) is still retained by this process (opened before). DSH currently provides no session-close API; restart DSH and delete again.',
  'error.current-session': '"{title}" is the session you are currently viewing and cannot be deleted. Switch to another session, restart DSH, and delete again.',
  'error.session-not-found': 'Session "{title}" was not found; it may already be deleted.',
  'error.title-invalid': 'Title rejected: {message}',
  'error.service-unavailable': 'A required service is missing in this deployment: {message}',
  'error.bad-request': 'Invalid request: {message}',
  'error.internal': 'Operation failed: {message}',
}

export type DshSessDicts = {
  readonly zh: typeof zh
  readonly en: typeof en
}

/** Both dictionaries (used at registration time). */
export function dictionaries(): DshSessDicts {
  return { zh, en }
}
