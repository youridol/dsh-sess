# dsh-sess Architecture

Target: [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) **`dsh-v0.1.2-alpha.5`**.

This document describes how dsh-sess is designed and why. It is the source of
truth for reviewers: every design decision cites the official mechanism it is
built on and states what is deliberately **not** done.

## 1. Design constraints

The plugin is bound by four hard rules:

1. **Official API only.** Everything runs through public DSH services,
   endpoints and composition mechanisms. No harness source is modified, no
   private API is reached, and no version special-casing exists.
2. **Official UI surface only.** The browser half contributes through the
   official client slot system; it performs no DOM injection or mutation of
   components owned by other packages.
3. **Module-table discipline.** The client bundle may only `require` the frozen
   baseline platform modules (react, jsx runtime, ui-primitives); everything
   else is inlined by the build.
4. **No workspace domain-state writes.** Archiving/deleting never rewrites the
   durable `archivedSessionIds` or record tables directly (a past implementation
   bug class in older plugin generations); the plugin only invokes the official
   registry APIs.

## 2. Runtime split

The package ships two halves mounted by one profile-bundle row:

| Half | Artifact | Mounted as | Runs as |
| --- | --- | --- | --- |
| Host | `lib/index.js` (package `main`) | Cordis plugin row (`cordis.patch.yml`) | Cordis plugin in the host process |
| Browser | `client/client.js` (package export `./client`) | Client module (boot row client half) | Cordis plugin in the web page |

The two halves communicate over the plugin's private `/dsh-sess` RPC channel —
not the shared `/api` channel, which the official api gateway owns.

### Host half (`src/index.ts`, `src/host/*`)

The host entry exports the cordis plugin shape (`name`, `inject`, `apply`) and
declares its service requirements: `connection`, `webServer`, `sessions`,
`sessionPersistence` and `workspaceRegistry`. Cordis holds the plugin PENDING
until every service is available, so `apply` may install the RPC channel
unconditionally:

```text
apply(ctx)
  └─ ctx.effect(installSessChannel)   # ctx.connection.rpc.handle('/dsh-sess', …)
```

The channel handler resolves the official services into narrow **structural
faces** (`delete-session.ts`, `rename-session.ts`) and dispatches the two
endpoints (`rpc.ts`):

- `dshSess.deleteSession { sessionId }`
- `dshSess.renameSession { sessionId, title }`

Faces are structural on purpose: the plugin pins dsh-v0.1.2-alpha.5 types at
build time, but the runtime surface it needs is a small, documented subset of
each official service — keeping the plugin decoupled from the full host
context and easy to unit test.

### Browser half (`src/client/*`)

The browser entry registers the plugin's dictionaries with the locale service
and contributes a Settings section through `ctx.slots.inject('settings.section',
… register …)` — the official way for a profile plugin to add a page to the
Settings dialog. The section component renders the manager from the **client
session/workspace projections** (the same data the sidebar renders), so no
extra listing endpoint is needed and titles/activity stay consistent with the
native UI.

## 3. The deletion algorithm

`deleteSession` (host) implements permanent deletion safely:

```text
assertSessionId(raw)                         # one clean path segment; rejects '..', '~', separators
if sessions.get(id) is present  → agent-busy # session is open in this process
headers = sessionPersistence.list()
header  = headers.find(id)        → else session-not-found
removeSessionArtifact(header)                # guarded removal, see below
for entity of workspaceRegistry.list()       # release accounting via official API
  if entity.sessionIds includes id → entity.detachSession(id)
```

`removeSessionArtifact` only deletes what the official JSONL backend located
(`ctx.sessionPersistence.locate(header)`), after structural guards:

- backend kind is `jsonl`;
- the artifact base name is `session.jsonl` or `session.jsonl.zstd`;
- the path is absolute;
- the containing directory is one clean segment **named exactly the validated
  session id** (the JSONL layout is `<root>/<projectKey(cwd)>/<id>/…`, and
  validated ids are stored verbatim by the backend's path encoder).

If the guards fail, nothing is removed and an `internal` error is returned.
If the backend reports no per-session artifact, removal is a no-op (there is
nothing durable to delete) and accounting is still released.

Rationale for refusing live sessions: an open session keeps an in-memory agent
and UI state. Deleting its log underneath would leave inconsistent in-memory
state. DSH exposes no official "close session" that would make the deletion
safe mid-session, so the plugin mirrors native behavior: sessions opened in the
current process are deleted only after they go cold (close them or restart
DSH).

## 4. The rename operation

`renameSession` reuses the **official session controller**
(`ctx.sessionController.rename({ sessionId, title })`), the same host operation
the native row-menu rename uses. It works for archived (cold) sessions because
the controller resolves/resumes the session before writing the durable title
event through the session-title service. The plugin only validates the basic
shape of the input (id + non-empty trimmed title within a sane bound) and maps
official rejections (`session/title-invalid`, `session/not-found`) onto its own
stable error codes.

## 5. Manager data flow (browser)

The manager derives rows purely from the two official client projections:

```text
sessions.list.getSnapshot()   # ids, byId { title, displayTitle, updatedAt, running, blank, parentId, origin }
workspaces.list.getSnapshot() # items[].sessionIds → workspace title; archivedSessionIds
```

Pure projection in `model.ts`:

- skip subagent-child sessions (`parentId` / `origin: 'subagent'`);
- map workspace titles from membership, mark archive members;
- order by activity (newest first).

Destructive actions call the host channel; afterwards the plugin awaits
`ctx.sessions.refresh()` and lets the workspace follow-stream settle the rest
(see *Boundaries* in the README).

## 6. Non-goals and deliberate omissions

- **No unarchive.** The official archive set is one-way; restoring would require
  writing workspace domain state, which is forbidden. Rename/delete cover the
  archived lifecycle.
- **No session create/switch/close.** These exist natively in the UI and the
  official API; the plugin adds only the operations DSH lacks (permanent
  deletion, archived management).
- **No direct persistence writes.** Appends, titles and recovery all stay inside
  official services.
- **No DOM-level UI integration.** Row menus are owned by other packages and
  expose no slot; the plugin deliberately does not mutate them.

## 7. Testability

Host operations accept structural service faces, so unit tests fake the
official services and use real temp directories as the persistence tree; the
browser projection is a pure module tested under Node. See
[Testing](testing.en.md).
