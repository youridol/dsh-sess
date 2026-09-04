# dsh-sess

**Session Manager for DeepSeek Harness (DSH).**

`dsh-sess` adds a **Session Manager** page to the DSH web UI (Settings → Session
Manager) that permanently deletes cold sessions and manages archived sessions
(list / rename / delete). It is an independent plugin package that runs as a
profile bundle — installed into a DSH profile, mounted through the official
Profile Bundle + Cordis mechanisms, and built strictly on the public APIs of
[`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)
**`dsh-v0.1.2-alpha.5`**. It never modifies harness source code.

> English · [简体中文](README.zh.md)

## Why does this plugin exist?

Native DSH (as of `dsh-v0.1.2-alpha.5`) lets you rename, fork and archive
sessions from a row menu and rename/delete workspace registrations — but it
offers **no permanent session deletion** and **no way to list or rename
archived sessions again after archiving** (archiving is one-way). `dsh-sess`
covers exactly those two gaps:

1. **Delete a session permanently** — removes the session log artifact and its
   workspace accounting. Guarded: only *cold* sessions (not open in the running
   process) can be deleted, so a live session is never deleted underneath its
   agent. Reachable from the **Session Manager** settings page and directly
   from each sidebar session row: its ellipsis menu gains a **Delete session**
   entry below **Archive** (with the same confirmation flow).
2. **Archive manager** — list archived sessions (title, workspace, activity
   time), **rename** them, or **delete** them, all from one surface.

## Feature checklist

| Capability | Where | Notes |
| --- | --- | --- |
| Session list / query / current state | Session Manager "All sessions" tab | Mirrors the sidebar projection (titles, activity time, workspace, running/blank flags). |
| Session identification, names & metadata | Session Manager | Shows durable titles (falling back to the id), workspace membership, archive state, activity time. |
| Permanent session deletion | Session Manager + sidebar row menu | Every session row's ellipsis menu gains **Delete session** below **Archive**. Only cold sessions; refuses `agent-busy` sessions with a clear message. |
| Archived-session management | Session Manager "Archived" tab | List, inline rename (official `session/rename` path), delete. |
| Session persistence, reads & restart recovery | Host operations | Existence checks go through official `ctx.sessionPersistence.list()`; artifact removal through official `locate()`. After a DSH restart every session is cold and deletable. |
| Association of sessions with workspaces | Session Manager | Workspace title shown from the client workspace projection; deletion releases accounting through the official `workspaceRegistry` detach API. |
| Abnormal-session safe handling | Guardrails | Malformed ids rejected; unknown sessions → `session-not-found`; live sessions → `agent-busy`; unsafe artifact paths are refused before any file is touched. |

## Requirements

- DeepSeek Harness **`dsh-v0.1.2-alpha.5`** (web profile: `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`).
- Node.js ≥ 20.
- The plugin targets the **web** UI (Settings page); it does not change headless/CLI behavior.

## Install

Install into the profile that runs your web UI with the official plugin command
(pnpm must be on `PATH`):

```bash
dsh plugin --profile web add dsh-sess
```

`dsh plugin` forwards the arguments to pnpm inside the profile directory, then
appends the package to `dsh.profile.bundles` because the package declares
`dsh.bundle` (see [docs/integration.en.md](docs/integration.en.md)). Restart the
web UI (stop `dsh web` and start it again) — the Settings page now contains a
**Session Manager** section.

> Installing from a Git checkout of this repository instead of npm? Build first
> (`npm ci && npm run build`), then point the profile at the local folder:
> `dsh plugin --profile web add <absolute-path-to-repo>` (relative paths are
> resolved from your shell's working directory). The `lib/` and `client/`
> build artifacts are required at runtime and are not committed.

### Verify

1. Open **Settings → Session Manager**. A section appears listing your sessions.
2. The **All sessions** tab shows every non-subagent session. Sessions running a
   turn are marked and cannot be deleted.
3. Archive a session natively (row menu → Archive). It moves to the
   **Archived** tab, where you can rename or delete it.
4. Delete a *cold* session: the manager asks for confirmation, then removes the
   log and workspace accounting. The row disappears after the refresh (see
   *Known boundaries*).

## Usage

**Session Manager → All sessions**

- Sessions are grouped under their workspace (Ungrouped last), each group with
  a header and count.
- Each row shows: title (or id), relative activity time, and badges
  (`Archived`, `Cold`/blank, `Running`).
- **Delete session** asks for explicit confirmation. Deleting fails with a
  localized message for sessions retained by this process (`agent-busy`,
  refined as running / retained-with-id) or no longer present
  (`session-not-found`); the currently viewed session is refused before any
  request.

**Session Manager → Archived**

- Archived sessions (title / workspace / activity time) with **Rename**
  (inline editor, Enter to save, Esc to cancel) and **Delete** (same
  confirmation flow).

## Known boundaries (honest behavior)

These limits come from the official API surface, not from the plugin:

- **No unarchive.** The official workspace archive set is one-way; `dsh-sess`
  never writes workspace domain state directly, so archived sessions cannot be
  restored. Archived items can be renamed or deleted from the manager.
- **Live sessions are refused.** A session open in the current process keeps an
  in-memory agent; deleting its log underneath it would corrupt the UI state.
  Close it (or restart DSH, which makes every session cold) and delete again.
- **Sidebar settles on the next projection refresh.** Deleting a session inside
  a workspace also removes its workspace accounting through the official API;
  the sidebar/grouping rows converge on the next session/workspace refresh and
  settle fully after a DSH restart (search/sqlite indexes reconcile from the
  persisted artifacts).
- **Subagent-child sessions are not shown** in the manager: they belong to
  their parent session and are managed through it.
- **Orphaned archive markers are inert.** If an archived session is deleted,
  its id may remain in the durable archive set — the official API has no way to
  remove a marker without writing domain state directly. List surfaces join
  archive ids against real sessions, so orphans never render.
- **Deleting a session that was renamed** makes it live again (renaming
  resolves/resumes the session through the official controller, matching native
  behavior), so delete it only after it goes cold.
- **Sidebar row-menu extension is DOM-level and defensive.** Native session-row
  menus expose no third-party slot, so the "Delete session" entry is injected
  structurally below the Archive item. It only appears on genuine session menus,
  and the session id is resolved from the row's React fiber — when the id
  cannot be proven the entry is skipped rather than guessing (this also means a
  future ui-workspace redesign may drop the entry until adapted).

## Project layout

```text
src/index.ts                 Host plugin entry (cordis plugin)
src/host/                    Host operations (official services only)
  rpc.ts                     /dsh-sess RPC channel, endpoint dispatch
  delete-session.ts          Permanent cold-session deletion
  rename-session.ts          Archived-session rename (official controller)
  artifact.ts                Guarded durable-artifact removal
  session-id.ts              Session-id validation
  errors.ts                  Stable error codes / wire errors
src/client/                  Browser half (official client services + slots)
  index.tsx                  Plugin entry; registers Settings section + row menu
  session-manager.tsx        Manager UI
  row-menu.ts                Session-row menu injection (below Archive)
  fiber-id.ts                Defensive session-id resolution (React fiber)
  row-delete.tsx             Row-menu confirmation host (Modal)
  row-store.ts               Row delete request store
  delete-flow.ts             Shared error copy for delete/rename
  model.ts                   Pure row projection (unit-tested)
  rpc.ts                     Client RPC helpers
  locales.ts                 zh/en copy
tests/                       Unit tests (host ops + client model/locales)
cordis.patch.yml             Profile bundle patch (mounts the plugin row)
```

## Documentation

- [Architecture](docs/architecture.en.md) — components, data flow, boundaries.
- [API reference](docs/api.en.md) — RPC endpoints, payloads, error codes.
- [Profile Bundle & Cordis integration](docs/integration.en.md) — how the plugin mounts, install/upgrade details, troubleshooting.
- [Development guide](docs/development.en.md) — repo tooling, structure, how to extend.
- [Testing](docs/testing.en.md) — test matrix and how to run it.
- [Contributing](CONTRIBUTING.en.md) · [Changelog](CHANGELOG.en.md)

简体中文文档见各 `.zh.md` 文件（[README.zh.md](README.zh.md) 入口）。

## License

[MIT](LICENSE) © 2026 dsh-sess contributors
