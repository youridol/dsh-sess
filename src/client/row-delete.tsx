/**
 * Confirmation host for the sidebar row-menu "Delete session" action.
 *
 * The DOM-level menu integration raises delete requests into the module store;
 * this component — rendered in a plugin-owned React root, independent of the
 * Settings dialog — subscribes and shows the native confirmation modal for the
 * same guarded delete path the Session Manager page uses.
 */
import { useEffect, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { currentSessionRefusal, describeFailure } from './delete-flow.ts'
import { deleteSessionRpc } from './rpc.ts'
import {
  clearRowDelete,
  getRowDeleteRequest,
  subscribeRowDelete,
} from './row-store.ts'
import type { DshSessClientContext, Translate } from './types.ts'

/** Modal host mounted once by the plugin entry. */
export function RowDeleteHost({
  ctx,
  t,
}: {
  ctx: DshSessClientContext
  t: Translate
}) {
  const request = useRowDeleteRequest()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset transient state whenever the target session changes.
  useEffect(() => {
    setBusy(false)
    setError(null)
  }, [request?.sessionId])

  if (request === null) return null

  const close = (): void => {
    if (busy) return
    clearRowDelete()
  }

  const confirm = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      // The currently viewed session cannot be deleted from under the UI.
      if (ctx.sessions.list.getSnapshot().current === request.sessionId) {
        setError(currentSessionRefusal(t, request.title))
        setBusy(false)
        return
      }
      await deleteSessionRpc(ctx.connection.rpc, request.sessionId)
      clearRowDelete()
      await ctx.sessions.refresh()
    } catch (caught) {
      setError(describeFailure(caught, t, request.title))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={t('delete.prompt.title', { title: request.title })}
      closeLabel={t('delete.cancel')}
      description={t('delete.prompt.warning')}
      className="dsh-sess-row-confirm"
      contentClassName="dsh-sess-row-confirm-content"
      footer={(
        <>
          <Button variant="outline" disabled={busy} onClick={close}>
            {t('delete.cancel')}
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => { void confirm() }}>
            {busy ? t('delete.busyHint') : t('delete.confirm')}
          </Button>
        </>
      )}
    >
      {error !== null && <div className="dsh-sess-row-confirm-error">{error}</div>}
    </Modal>
  )
}

/** Subscribe to the module-level delete request store. */
function useRowDeleteRequest(): ReturnType<typeof getRowDeleteRequest> {
  const [request, setRequest] = useState(getRowDeleteRequest)
  // Return the unsubscribe so a plugin teardown (root unmount) never leaks
  // this listener into the module-level set.
  useEffect(() => subscribeRowDelete(() => { setRequest(getRowDeleteRequest()) }), [])
  return request
}
