/**
 * Client-side structural faces of the official services dsh-sess consumes.
 *
 * The browser half intentionally types the service surfaces it touches with
 * narrow local interfaces instead of importing the full client packages: the
 * client bundle may only require baseline platform modules at runtime, and
 * structural typing keeps the plugin compatible across dsh client versions
 * that expose the same service shapes.
 */

/** RPC result envelope (mirrors the official connection service). */
export type RpcResultWire<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: Readonly<Record<string, unknown>> } }

/** The connection service's RPC caller. */
export interface RpcCaller {
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<RpcResultWire<unknown>>
}

/** One session summary row (client `sessions` store). */
export interface SessionSummaryView {
  readonly id: string
  /** Durable user title when present. */
  readonly title?: string | null
  /** Title or a derived display fallback. */
  readonly displayTitle?: string
  /** Working directory the session ran in. */
  readonly cwd?: string | null
  /** Fork parent (subagent children carry one and are hidden). */
  readonly parentId?: string
  /** Session created as a subagent child. */
  readonly origin?: 'subagent'
  /** Agent currently running a turn. */
  readonly running?: boolean
  /** Session with no committed turn yet. */
  readonly blank?: boolean
  /** Last-activity epoch milliseconds (host-computed). */
  readonly updatedAt: number
}

/** Session list snapshot (client `sessions` store). */
export interface SessionListState {
  readonly ids: readonly string[]
  readonly byId: Readonly<Record<string, SessionSummaryView>>
  readonly current?: string
  readonly phase: 'pending' | 'ready'
}

/** The `sessions` service surface dsh-sess reads. */
export interface SessionsFace {
  readonly list: {
    getSnapshot(): SessionListState
    subscribe(listener: () => void): () => void
  }
  refresh(): Promise<void>
}

/** One workspace view (client `workspaces` store). */
export interface WorkspaceViewFace {
  readonly workspaceId: string
  readonly path: string
  readonly title: string
  readonly sessionIds: readonly string[]
}

/** Workspace list snapshot (client `workspaces` store). */
export interface WorkspaceListState {
  readonly items: readonly WorkspaceViewFace[]
  readonly archivedSessionIds: readonly string[]
  readonly phase: 'pending' | 'ready'
}

/** The `workspaces` service surface dsh-sess reads. */
export interface WorkspacesFace {
  readonly list: {
    getSnapshot(): WorkspaceListState
    subscribe(listener: () => void): () => void
  }
}

/** Locale snapshot surface. */
export interface LocaleSnapshotFace {
  readonly active: string
}

/** The `locale` service surface dsh-sess reads. */
export interface LocaleFace {
  register(namespace: string, locale: string, dictionary: Record<string, string>): () => void
  bind(namespace: string): (key: string, params?: Record<string, string | number>) => string
  getLocale(): LocaleSnapshotFace
}

/** The `slots` service surface dsh-sess reads (register/inject). */
export interface SlotsFace {
  inject(slot: string, register: () => unknown): unknown
  register(options: Record<string, unknown>, component: (owner: Record<string, unknown>) => unknown): unknown
}

/** The `connection` service surface dsh-sess reads. */
export interface ConnectionFace {
  readonly rpc: RpcCaller
}

/** Client context surface used by the plugin. */
export interface DshSessClientContext {
  effect(callback: () => unknown, label?: string): unknown
  locale: LocaleFace
  slots: SlotsFace
  connection: ConnectionFace
  sessions: SessionsFace
  workspaces: WorkspacesFace
}

/** Translate bound to the dsh-sess namespace. */
export type Translate = (key: string, params?: Record<string, string | number>) => string
