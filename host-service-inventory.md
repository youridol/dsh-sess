# HOST-Side Service Inventory for a cordis Host Plugin (verbatim, from read-only checkout `C:\Users\Administrator\AppData\Local\dsh-launcher\github-dsh\deepseek-harness`)

All citations are exact `path:line`. Paths below are relative to the checkout root.

**How a host plugin reaches each service.** Each package `declare module '@deepseek-ai/cordis'`-augments `Context` with its key and default-exports a class `extends Service` whose constructor calls `super(ctx, '<key>')`. Cordis then provides `ctx.<key>` once that class is mounted as a plugin. In the real host (apps/cli boot over bundle patches) the classes are mounted as **bundle rows** in `packages/bundle/base/cordis.patch.yml` / `packages/bundle/web-app/cordis.patch.yml` (row `id`/`name` quoted per service below). A third-party cordis plugin therefore injects `ctx.<key>` when those rows are present.

---

## 1. `ctx.sessions` — `packages/core/session` (npm `@deepseek-ai/dsh-session`)

**(1) npm name:** `@deepseek-ai/dsh-session` (`packages/core/session/package.json:2`).

**(2) cordis key + class.** Context-key declaration (`packages/core/session/src/index.ts:35-38`):
```ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    sessions: SessionStore
  }
```
Service class (`packages/core/session/src/index.ts:856-861`):
```ts
export class SessionStore extends Service {
  private store = new Map<SessionId, SessionEntry>()
  private counter = 0

  constructor(ctx: Context) {
    super(ctx, 'sessions')
```
Default export: `export default SessionStore` (`index.ts:1223`).

**Registering file / host row:** package default export mounted by host row `- id: session` / `name: '@deepseek-ai/dsh-session'` at `packages/bundle/base/cordis.patch.yml:33-34`. Tests equivalently do `await ctx.plugin(SessionStore)`.

**Events it exposes (for persistence plugins):** `session/created`, `session/disposed`, `session/event`, `session/flush` — declarations at `packages/core/session/src/index.ts:52,62,74,83`.

**(3) Public methods of `SessionStore`** (doc+signature at file:line):
- `create(id?, options?): Session` — prepare + enter + announce in one effect owned by the calling fiber (`index.ts:894`).
- `prepare(id?, options?): Session` — build session WITHOUT entering the store (validate id/cwd, construct `Session`); pairs with `enter`+`announce` (`index.ts:927`).
- `enter(session): () => void` — install publication hooks and add to store; returns the DETACH disposer; does not emit `session/created` (`index.ts:977`).
- `announce(session): void` — emit `session/created` exactly once for an entered session (`index.ts:1032`).
- `flush(session): Promise<boolean>` — dispatch the awaited `session/flush` durability checkpoint; returns whether ≥1 listener participated (`index.ts:1086`).
- `get(id): Session | undefined` — look up a live session (`index.ts:1119`).
- `list(): Session[]` — all live sessions, in creation order (`index.ts:1127`).
- `fork(source, boundary?, childSessionId?): Session` — live child from a stable prefix of a live source (`index.ts:1145`).

(The `Session` object itself is append-only in memory: `eventAt` `index.ts:588`, `snapshotEvents` `index.ts:600`, `ownEvents` `index.ts:615`, `isOwnSeq` `index.ts:624`, `append` `index.ts:668`, `requestHeader` `index.ts:734`, `requestContext` `index.ts:755`, `deriveMessages` `index.ts:790`. Persistence is deliberately NOT here — see module doc `index.ts:1-7`, class doc `index.ts:850-855`.)

**(5) Deletion audit:** No method deletes or touches persisted data. Store removal is in-memory only: `detachEntered` (`index.ts:1013-1023`) `this.store.delete(entry.id); attachments.delete(entry.session)` then emits `session/disposed`. No fs operations exist in this package. **No delete method found.**

---

## 2. `ctx.sessionPersistence` — `packages/session/session-persistence` (npm `@deepseek-ai/dsh-session-persistence`)

**(1) npm name:** `@deepseek-ai/dsh-session-persistence` (`packages/session/session-persistence/package.json:2`). This is the abstract **Service Definition**; a concrete backend subclass (e.g. the JSONL one, §3) provides it.

**(2) cordis key + class.** Context-key declaration (`packages/session/session-persistence/src/index.ts:98-102`):
```ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionPersistence: SessionPersistence
  }
}
```
Abstract service class (`index.ts:122-125`):
```ts
export abstract class SessionPersistence extends Service {
  constructor(ctx: Context) {
    super(ctx, 'sessionPersistence')
```

**Registering file / host row:** nothing in this package mounts it; the concrete backend class is mounted. Host row `- id: session-persistence-jsonl` / `name: '@deepseek-ai/dsh-session-persistence-jsonl'` with `config: root: !!js dshHomePath('sessions')` at `packages/bundle/base/cordis.patch.yml:110-113`. (Web/sdk layers mount the same backend at `packages/bundle/sdk-minimal/cordis.patch.yml:165`.)

**(3) Full public method list** (this file read in full; doc+signature at file:line):
- `abstract locate(meta: SessionHeader): SessionLocation | undefined` — resolve the backend's per-session absolute artifact path without reading/creating (`index.ts:134`).
- `abstract readonly supportsRawArtifacts: boolean` (`index.ts:140`).
- `readRaw(_id, signal?): Promise<SessionRawArtifact | undefined>` — verbatim artifact text; default rejects ("does not expose raw artifacts") (`index.ts:157`).
- `abstract create(meta: SessionHeader, inheritedEventCount?): Promise<void>` — register new session metadata; backend MAY defer the physical write to first `append` (`index.ts:173`).
- `ensureMaterialized(_session: Session): Promise<void>` — durable header even with zero events; default rejects (`index.ts:181`).
- `abstract append(id: SessionId, events: readonly SessionEvent[]): Promise<void>` — durably persist a contiguous batch (`index.ts:195`).
- `async prepare(id, signal?): Promise<SessionPreparation>` — prepare the exact unpublished Session used by resume (`index.ts:207`).
- `abstract load(id): Promise<SessionInspection>` — immutable balanced view + commit cold recovery (`index.ts:236`).
- `abstract inspect(id, signal?): Promise<SessionInspection>` — inspect without committing recovery (`index.ts:253`).
- `abstract borrowSession(id, signal?): Promise<BorrowedSessionSource>` — disposable exact inspection retaining reusable prepared source (`index.ts:264`).
- `abstract readFrom(id, fromSeq, signal?): Promise<SessionEventSuffix>` — read stored events from a seq onward (`index.ts:284`).
- `abstract list(signal?): Promise<SessionHeader[]>` — lightweight header listing (`index.ts:292`).
- `abstract listSnapshots(signal?): Promise<SessionPersistenceSnapshot[]>` — headers + per-log revision tokens (`index.ts:304`).

**Backend contract interface** — `PersistenceBackend<TornMarker>` at `packages/session/session-persistence/src/coordinator.ts:141` (head):
```ts
export interface PersistenceBackend<TornMarker = unknown> {
  /** Human-readable backend name, used in the dispose-failure AggregateError. */
  readonly name: string
  loadStored(id: SessionId, signal?: AbortSignal): Promise<StoredPrefix<TornMarker> | undefined>   // coordinator.ts:158
  readStoredRevision(id: SessionId, signal?: AbortSignal): Promise<SessionPersistenceRevision | undefined> // :166
  loadStoredFrom?(...)                                                            // optional seek read :190
  materializeHeader?(storage: SessionStorageMetadata): Promise<void>               // :193
  appendBatch(storage, events, isMaterialized): Promise<void>                      // :203
  commitRepair(storage, tornMarker, closers): Promise<void>                        // :216
  list(signal?): Promise<SessionHeader[]>                                          // :226
  locate?(meta): SessionLocation | undefined                                       // :234
  close?(): Promise<void>                                                          // :241
```
It is the minimal durable-primitives set; the `PersistenceCoordinator` supplies orchestration and installs the live write path (`coordinator.ts:1273-1323`): `ctx.on('session/created'|'session/event'|'session/flush'|'session/disposed')` → init/enqueue/flush/**retire**. Coordinator `create` is lazy ("Pure lazy: record intent only. No artifact until the first append." `coordinator.ts:738`); `ensureMaterialized` (`coordinator.ts:710`) materializes via `backend.materializeHeader`.

**Location/location-hint types:** `SessionLocation` (`index.ts:109-114`, fields `kind: string`, `path: string`, "absolute target path … never an authorization token"); `SessionRawArtifact` (`index.ts:74-79`, `filename` = "base filename on disk, without any physical encoding suffix").

**(5) Deletion audit:** No remove/delete exists anywhere in the service API or backend contract — the word "discard" appears only in docs about a torn *record* tail, and all `discard`/`delete`/`remove` hits in `coordinator.ts`/`preparations.ts` operate on in-memory caches (e.g. `preparations.ts:209,251`; `coordinator.ts:1217,1331,1345,1460`). **No delete method found.**

---

## 3. JSONL backend — `packages/session/session-persistence-jsonl` (npm `@deepseek-ai/dsh-session-persistence-jsonl`)

**(1) npm name:** `@deepseek-ai/dsh-session-persistence-jsonl` (`packages/session/session-persistence-jsonl/package.json:2`).

**(2) cordis key + class:** subclass of §2; class decl (`src/index.ts:131`):
```ts
export class JsonlSessionPersistence extends SessionPersistence implements PersistenceBackend<JsonlTornMarker> {
  override readonly supportsRawArtifacts = true
  static inject = ['sessions']
```
`override readonly name = 'session-persistence-jsonl'` (`index.ts:150`); base `super(ctx)` reuses service key `sessionPersistence`. Default export `JsonlSessionPersistence` (`index.ts:1012`). Config: `root` (required), `packChunks`, `compression` (`'zstd'` default — `index.ts:48`), `preparedSessionCacheSize`, `writeBatchMaxDelayMs` (`index.ts:70-93,136-143`).

**(3)/(4) On-disk artifact layout** — quoted from `src/format.ts` (path builders) and `src/index.ts`:
- Root: configured `root` (host default `$DSH_HOME/sessions` via `dshHomePath('sessions')`, `packages/bundle/base/cordis.patch.yml:113`), resolved once at construct (`index.ts:161`).
- Per-session **log file suffix** (`format.ts:37-39`): `.jsonl.zstd` for zstd, `.jsonl` for plaintext.
- **Project dir** (`format.ts:209-212`): `projectDir(root, cwd)` → `join(root, projectKey(cwd))` or `join(root, '_no-cwd')` when `cwd === undefined`.
- **Project key** (`format.ts:180-200`): lossy human-readable slug — separators `/\:` → `-`, unsafe units `~XXXX`, truncated to `--<251 chars>--`, `'root'` fallback.
- **Session dir** (`format.ts:222-224`): `sessionDir(root, cwd, id)` → `join(projectDir(root, cwd), encodeSegment(id))` — "The directory owned by one session and available for future session-local artifacts."
- **Session-id segment encoding** (`format.ts:154-169`): injective `~XXXX` escaping (neutralizes `../`, NUL, separators).
- **Log path** (`format.ts:234-241`):
```ts
export function logPath(
  root: string, cwd: string | undefined, id: SessionId, compression: JsonlCompression,
): string {
  return join(sessionDir(root, cwd, id), `session${logSuffix(compression)}`)
}
```
So the durable artifact is: `<root>/<projectKey(cwd)>/<encodeSegment(sessionId)>/session.jsonl` (plaintext) or `session.jsonl.zstd` (compressed). First line is one JSON header record (`type:'session'` … `format.ts:46-57,66-89`); events append as later JSONL lines (`eventLines` `format.ts:254-257`; optional packed chunk rows).
- Side-effect-free locator exposed on the service (`index.ts:181-184`): `locate(meta)` → `{ kind: 'jsonl', path: logPath(this.root, meta.cwd, meta.id, this.compression) }`.
- `readRaw` reports the logical artifact name `filename: 'session.jsonl'` regardless of compression suffix (`index.ts:297-299`).
- Discovery: `listArtifacts` walks `<root>/*/<session dirs>` reading only header lines (`index.ts:507-544`); `findLog` searches every project dir for the id's unique log and rejects duplicates / legacy flat layout (`index.ts:816-837`); identity/cwd sanity via `assertStoredIdentity` (`index.ts:850-870`).

**Write path / durability notes for a plugin reasoning about artifacts:** materialize publishes atomically (temp file + `link`/`publishNewFileWin32`), `appendLines` appends+fsyncs (`index.ts:549-743`); crash repair only ever **truncates a torn tail** (`repair` `index.ts:734-743`, coordinator `commitRepair`). Lazy creation means a session created but never appended has NO file on disk ("abandoned sessions leave nothing behind", service doc `index.ts:164-172`).

**(5) Deletion audit:** `rm()` calls exist ONLY for temp-file/staging cleanup during atomic publish (`index.ts:591,601,624`; `win32.ts:151` removes a staging dir); `truncate` only discards an incomplete torn tail during repair. There is **no method that deletes a session artifact, session dir, or project dir** — no remove/delete/erase of any persisted session log. **No delete method found** (a plugin that must erase a session's log has no official API; `locate`/`logPath`-equivalent layout above is the safe basis for reasoning about the file to remove).

---

## 4. `ctx.workspaceRegistry` — `packages/workspace/workspace` (npm `@deepseek-ai/dsh-workspace`)

**(1) npm name:** `@deepseek-ai/dsh-workspace` (`packages/workspace/workspace/package.json:2`).

**(2) cordis key + class.** Context-key declaration (`src/index.ts:67-71`):
```ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    workspaceRegistry: WorkspaceRegistry
  }
}
```
Class (`src/index.ts:92-93,114-116`):
```ts
export class WorkspaceRegistry extends Service {
  static inject = ['storageDomain', 'sessionPersistence']
  ...
  constructor(ctx: Context) {
    super(ctx, 'workspaceRegistry')
```
Default export `WorkspaceRegistry` (`index.ts:663`). Durability is NOT in session persistence: it stores domain records via `ctx.storageDomain` (host: `dsh-storage` stack, domain `workspace`, `$DSH_HOME/storages` — see `spec.ts:68-76`, base patch rows `storage`/`storage-json`/`storage-domain` at `packages/bundle/base/cordis.patch.yml:145-156`).

**Registering file / host row:** `- id: workspace` / `name: '@deepseek-ai/dsh-workspace'` at `packages/bundle/web-app/cordis.patch.yml:61-62` (web host layer; the workspace API controller row follows at `:100-101`).

**(3) Registry public API** (doc+signature at file:line):
- `create(path, title?): Promise<Workspace>` — create-or-reuse for an existing directory (realpath canonicalized); new workspace prepended to durable order (`index.ts:158`).
- `get(id): Workspace | undefined` (`index.ts:171`).
- `list(): Workspace[]` — sync projection in durable registry order (`index.ts:181`).
- `delete(id): Promise<boolean>` — delete a workspace **registration only** (`index.ts:199`); see quote below.
- `insertBefore(id, beforeId?): Promise<readonly WorkspaceId[]>` — move within durable display order (`index.ts:210`).
- `get archivedSessionIds(): readonly SessionId[]` — registry-global archive set ("sessions hidden from every grouping surface"; `index.ts:233`).
- `archiveSession(sessionId): Promise<void>` — archive durably (`index.ts:244`); quote below.
- `resolveByPath(path): Promise<Workspace | undefined>` — resolve by canonical directory path without creating (`index.ts:277`).

**`delete` does not touch sessions or files** (`index.ts:191-201`):
```ts
/**
 * Delete one workspace registration while retaining its directory and every
 * session log. ...
 */
delete(id: WorkspaceId): Promise<boolean> {
  return this.enqueueOperation(() => this.deleteKnown(id))
}
```

**`archiveSession` = one-way hide flag; nothing is erased** (`index.ts:237-255`):
```ts
/**
 * Archive one session durably. The session must exist (live or in session
 * persistence); its workspace accounting — or lack of one — is irrelevant.
 * An already archived id resolves without writing.
 */
archiveSession(sessionId: SessionId): Promise<void> {
  return this.enqueueOperation(async () => {
    if (this.requireState().archivedSessionIds.includes(sessionId)) return
    if (!(await this.sessionKnown(sessionId))) {
      throw new WorkspaceUnknownSessionError(sessionId)
    }
    const state = this.requireState()
    await this.setState({ ...state, archivedSessionIds: [...state.archivedSessionIds, sessionId] })
```
Registry doc for the archive set (`index.ts:227-235`): "Archiving never touches workspace accounting — an archived session keeps its `sessionIds` slot so unarchiving restores its position." The durable shape is `archivedSessionIds: string[]` in `workspaceDomainState` (`spec.ts:52-57`). **There is no unarchive method in this package or anywhere official** (search of `packages/api` finds only `archiveSession`; e.g. host controller `packages/api/workspace-controller/src/commands.ts:153-161`).

**Entity (`WorkspaceEntity implements Workspace`, `entity.ts:69`)** — registry returns these via `Workspace` interface (`types.ts:31-112`): getters `id` `:79`, `path` `:85`, `title` `:89`, `createdAt` `:93`, `updatedAt` `:97`, `sessionIds` (filtered by canonical-cwd equality, `:101-103`); methods `setTitle(title)` `entity.ts:105`, `attachSession(sessionId)` `:109` (validates header cwd resolves to an existing dir equal to workspace path, `:109-149`), `insertSessionBefore(sessionId, beforeSessionId?)` `:151`, `detachSession(sessionId)` `:174`, `status(): Promise<'ok'|'missing-dir'>` `:180`. `detachSession` interface contract (`types.ts:95-103`): "Remove a session from this workspace's account. … **Never touches the session's own stored log.**"

**(5) Deletion audit:** `delete(id)` removes a KV *registration record* (and reorders durable registry state) only — never a directory or any session log. `archiveSession` appends an id to a durable JSON archive list. `detachSession` edits one record's `sessionIds` array. Nothing in `src/` performs fs removal of session artifacts. **No session-log deletion found.**

---

## 5. `ctx.agents` — `packages/core/agent` (npm `@deepseek-ai/dsh-agent`)

**(1) npm name:** `@deepseek-ai/dsh-agent` (`packages/core/agent/package.json:2`).

**(2) cordis key + class.** Context-key declarations (`packages/core/agent/src/index.ts:27-41`):
```ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    agents: AgentRegistry
    ...
    agent?: Agent
  }
}
```
Class (`index.ts:249,259-260`):
```ts
export class AgentRegistry extends Service {
  ...
  constructor(ctx: Context) {
    super(ctx, 'agents')
```
Default export `AgentRegistry` (`index.ts:700`).

**Registering file / host row:** `- id: agent` / `name: '@deepseek-ai/dsh-agent'` at `packages/bundle/base/cordis.patch.yml:67-68`.

**(3) Public methods** (doc+signature at file:line):
- `currentInitiator(): Agent | undefined` — agent that initiated the inherited async chain (`index.ts:303`).
- `requireInitiator(): Agent` — same but throws when no initiator is active (`index.ts:316`).
- `withInitiator<T>(agent, operation): T` (`index.ts:335`); `withoutInitiator<T>(operation): T` (`index.ts:350`).
- `setFactory(factory: AgentFactory): () => void` — register the loop-owned creation factory (`index.ts:366`).
- `async create(options: CreateAgentOptions): Promise<AgentHandle>` — create+publish through the factory (`index.ts:399`).
- `async resume(options: ResumeAgentOptions): Promise<AgentHandle>` — load persisted session + resume through the factory (`index.ts:418`).
- `register(agent): () => void` — record an already-constructed agent; emits `agent/created`/`agent/disposed` (`index.ts:444`).
- `enter(agent, owner): () => void` — insert without announcing; advanced ordered-lifecycle primitive (`index.ts:468`).
- `announce(agent): void` (`index.ts:543`).
- `get(id): Agent | undefined` (`index.ts:577`).
- `isOwnedBy(id, owner): boolean` (`index.ts:589`).
- `list(): Agent[]` — all live agents in registration order (`index.ts:597`).
- `roots(): Agent[]` — live top-level agents (`index.ts:607`).

Actual creation/resume/dispose implementations live in `@deepseek-ai/dsh-agent-loop` (`packages/core/agent-loop`), registered via `ctx.agents.setFactory(this)` in `AgentLoop extends Service implements AgentFactory` (`packages/core/agent-loop/src/index.ts:352-353,413`); row `id: agent-loop`/`@deepseek-ai/dsh-agent-loop` (`packages/bundle/base/cordis.patch.yml:483-484`).

**(4) get/list/create/resume/dispose semantics.** `AgentRegistry` itself only tracks *live* entries in a `Map<SessionId, AgentEntry>`; create/resume are delegated (`index.ts:399-424`). The **dispose contract** is documented on `AgentHandle` (`packages/core/agent/src/index.ts:151-168`):
```ts
 * `dispose()` stops the loop, awaits its exit, unregisters the agent, removes
 * its session from the store, and finally unwinds its scoped world.
```
Dispose head (agent-loop, `packages/core/agent-loop/src/index.ts:560-583`):
```ts
const dispose = (ownerTriggered = false): Promise<void> => (disposing ??= (async () => {
  abort.abort(new Error(`agent "${id}" lifecycle disposed`))
  callerSignal?.removeEventListener('abort', onCallerAbort)
  this.ownership.signal.removeEventListener('abort', onFactoryTeardown)
  try {
    if (machine === undefined) await machineReady.promise
    if (machine !== undefined) {
      machine.cancel({ kind: 'disposed' })
      await machine.whenIdle()
      await machine.scope.dispose()
    }
  } finally {
    try {
      detachAgent?.()
      detachSession?.()
    } finally {
      untrack()
      if (!ownerTriggered) await unfollowOwner()
    }
  }
})())
```
where `detachSession = agent.ctx.sessions.enter(session)` and `detachAgent = loopCtx.agents.enter(agent, ownerCtx.agent)` were captured at publish (`index.ts:619-633`). Net effect: machine cancelled → loop idles → agent scope disposed → **in-memory unregister** from the AgentRegistry (`detachEntered`, `core/agent/src/index.ts:506-519`) and **in-memory removal + `session/disposed`** from the live SessionStore (`core/session/src/index.ts:1013-1023`). Persisted data is untouched by dispose: the JSONL backend's coordinator observes `session/disposed` → `retire(session)` (`session-persistence/src/coordinator.ts:1319,1325-1347`) which **final-flushes then deletes only in-memory write-behind state** (`await this.flush(session)` then `this.live.delete(session); if (this.states.get(id)?.owner === session) this.states.delete(id)`), leaving the `.jsonl[.zstd]` artifact intact on disk. So: **dispose does not delete, archive, or truncate the session log file; the artifact remains resumable** via `ctx.agents.resume`.

**(5) Deletion audit:** The only "remove" in the package is `Inbox.remove(messageId)` (`packages/core/agent/src/inbox.ts:121`) — an in-memory per-agent message box, unrelated to persistence. `create`/`resume`/`dispose` and agent-loop teardown never invoke any persistence removal. **No delete method found** for persisted session artifacts.

---

## 6. `ctx.sessionQuery` — `packages/session-query/session-query` (npm `@deepseek-ai/dsh-session-query`)

**(1) npm name:** `@deepseek-ai/dsh-session-query` (`packages/session-query/session-query/package.json:2`). Abstract Service Definition; a backend subclass (host mounts `@deepseek-ai/dsh-session-query-sqlite`) provides full-text search.

**(2) cordis key + class.** Context-key declaration (`src/index.ts:80-84`):
```ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionQuery: SessionQueryEngine
  }
}
```
Class (`src/index.ts:93-101`):
```ts
export abstract class SessionQueryEngine extends Service {
  static inject = ['sessions']
  ...
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'sessionQuery')
```
Default export `SessionQueryEngine` (`index.ts:394`).

**Registering file / host row:** concrete backend `- id: session-query-sqlite` / `name: '@deepseek-ai/dsh-session-query-sqlite'` with `config: { path: ':memory:', openAt: never }` at `packages/bundle/base/cordis.patch.yml:129-133` — search is opt-in while the service (`ctx.sessionQuery`) stays mounted for exact reads/titles/traces (comment `:121-128`).

**(3) Head of public methods** (doc+signature at file:line — first ~15):
- `observeSession(sessionId, options?): Promise<SessionObservation>` — observe one exact live/prepared Session (`index.ts:127`).
- `abstract searchSessions(request, exec?): Promise<SessionSearchPage<SessionSearchHit>>` (`index.ts:140`).
- `abstract searchEvents(request, exec?): Promise<SessionEventSearchPage>` (`index.ts:151`).
- `listSessions(signal?): Promise<SessionRecord[]>` — complete logical corpus, newest-first (`index.ts:161`).
- `readSession(sessionId): Promise<SessionLogSnapshot>` — full log replay-validated without making live (`index.ts:171`).
- `filterSessions(filters, signal?): Promise<SessionRecord[]>` (`index.ts:192`).
- `readTitle(sessionId, signal?): Promise<SessionTitleSnapshot | undefined>` (`index.ts:206`).
- `readTitleSnapshot(sessionId, signal?): Promise<SessionTitleObservation>` (`index.ts:219`).
- `readTitleSnapshots(sessionIds, signal?): Promise<SessionTitleObservationResult[]>` (`index.ts:237`).
- `listEvents(sessionId): Promise<SessionEventRecord[]>` (`index.ts:255`).
- `filterEvents(sessionId, filters): Promise<SessionEventSearchDocument[]>` (`index.ts:266`).
- `readSurface(sessionId): Promise<SessionSurfaceSnapshot>` (`index.ts:296`).
- `traceSession(sessionId, signal?): Promise<SessionLineageTrace>` (`index.ts:313`).
- `traceEvent(request, signal?): Promise<SessionEventTraceObservation>` (`index.ts:326`).
- `readEvent(request, signal?): Promise<SessionEventWindow>` (`index.ts:341`).

All reads are live-preferred (live Session first, else persistence via the corpus); nothing mutates storage. **(5) Deletion audit: no delete/remove/archive anywhere; read-only service. No delete method found.**

---

## DELETION AUDIT (summary)

Per service, does any official method delete/remove persisted session artifacts (the JSONL log files) or otherwise erase history on disk?

| Service (key) | Package | Deletes persisted session artifacts? |
|---|---|---|
| `ctx.sessions` | `@deepseek-ai/dsh-session` | **No delete method found.** In-memory only; `detachEntered` drops the store entry + emits `session/disposed` (`core/session/src/index.ts:1013-1023`). No fs code at all. |
| `ctx.sessionPersistence` | `@deepseek-ai/dsh-session-persistence` | **No delete method found.** Abstract API and `PersistenceBackend` contract have no remove/delete/erase; all `discard`/`delete` hits are in-memory caches (`coordinator.ts:1217,1331,1345,1460`; `preparations.ts`). |
| (JSONL backend) | `@deepseek-ai/dsh-session-persistence-jsonl` | **No delete method found.** `rm()` only cleans temp/staging files during atomic publish (`src/index.ts:591,601,624`, `win32.ts:151`); `truncate` only discards a torn crash tail in repair (`index.ts:734-743`). Session/project dirs and `session.jsonl[.zstd]` artifacts are never removed. |
| `ctx.workspaceRegistry` | `@deepseek-ai/dsh-workspace` | **No session-log deletion.** `delete(id)` removes only a workspace *registration* record ("retaining its directory and every session log", `index.ts:191-201`); `archiveSession` only appends the id to a durable `archivedSessionIds` list (hide flag; no unarchive anywhere official, `index.ts:244-255`); `detachSession` only edits a record's `sessionIds` and "never touches the session's own stored log" (`types.ts:95-103`). |
| `ctx.agents` | `@deepseek-ai/dsh-agent` (+ `dsh-agent-loop`) | **No delete method found.** `dispose()` stops/awaits the loop, unregisters from the in-memory registries and removes the session from the *live store*, then the persistence coordinator's `retire` final-flushes and drops in-memory write-behind state (`agent/src/index.ts:151-168`; `agent-loop/src/index.ts:560-583`; `session-persistence/src/coordinator.ts:1319,1325-1347`). The on-disk session log survives and remains resumable via `ctx.agents.resume`. |
| `ctx.sessionQuery` | `@deepseek-ai/dsh-session-query` | **No delete method found.** Read-only service (exact reads, filters, titles, lineage traces). |

**Bottom line:** across all official host services, **nothing ever deletes a persisted session artifact or session log file**. "Archive" (`workspaceRegistry.archiveSession`) is a durable UI-hide flag in workspace domain state; "dispose" (`ctx.agents` handle / session store detach) is in-memory teardown after a final flush. A third-party cordis host plugin that must actually erase session history has no official API to call — it would have to remove the artifact itself using the JSONL layout above (`<root>/<projectKey(cwd)>/<encodeSegment(id)>/session.jsonl[.zstd]`), e.g. starting from `ctx.sessionPersistence.locate(header).path` or `readRaw(…).filename`, and reconcile the workspace registry's `archivedSessionIds`/session accounts itself.
