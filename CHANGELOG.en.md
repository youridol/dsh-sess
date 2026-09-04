# Changelog

All notable changes to **dsh-sess** are documented here, in English. 简体中文
版本见 [CHANGELOG.zh.md](CHANGELOG.zh.md).

## [0.2.1] - 2026-09-04

**Post-audit robustness and tidiness fixes (PATCH).**

### Fixed

- **Deletion no longer reports failure when accounting release fails.**
  `dshSess.deleteSession` downgrades a `detachSession` rejection (a very
  unlikely domain-write fault) after the durable artifact is gone to a
  `detachWarnings` diagnostic instead of failing the whole operation; the UI
  reports "deleted, accounting will self-heal" (the official registry prunes
  stale members on its next domain write). Host tests cover the detach-failure
  path.
- **Row-menu confirmation subscriptions and state no longer leak.**
  `RowDeleteHost`'s store subscription now unsubscribes on unmount; plugin
  teardown calls a new `resetRowDelete()` that clears the module-level pending
  request and subscribers, so a hot reload never resurfaces a stale
  confirmation or leaks listeners.
- **Relative-time labels follow live locale switches.** The manager's activity
  time ("x minutes ago") no longer caches the first-render language; it now
  subscribes to locale snapshot changes and re-renders immediately on zh/en
  switch.
- **Rename budget is delegated to the official service.** The local 512
  character pre-check was removed — its unit disagreed with the official
  deployment-configured UTF-8 byte cap and could reject titles the deployment
  accepts. Validation now relies entirely on the official normalization and
  `session/title-invalid` mapping (unchanged).

### Changed

- **Sessions group by workspace id, not title.** The group key is the stable
  workspace id with the title as display text, so two same-titled workspaces no
  longer merge into one group.
- **Delete-failure copy gains a fallback branch.** `agent-busy` refusals now
  have a generic in-process fallback beyond the existing `running`/`retained`
  distinctions, so a future host reason never degrades to a raw message.
- **Dead copy removed.** The never-referenced `row.renaming` and `row.deleting`
  dictionary keys were dropped.
- **npm package slimmed.** The `files` allowlist now ships only `lib/`,
  `client/client.js(.map)` and docs — no whole-directory source or debug
  artifacts.

### Docs

- Fixed the self-contradictory "no DOM injection" wording in the 0.2.0 entry:
  the Settings section registers through the official slot system, while the
  sidebar session-row menu is a defensive DOM-level extension (matching the
  README and architecture docs).

## [0.2.0] - 2026-08-29

**Independent-repository rewrite for dsh-v0.1.2-alpha.5.**

dsh-sess was redesigned, rewritten and migrated out of the `dsh-plugin`
collection repository into its own repository, rebuilt strictly on the
dsh-v0.1.2-alpha.5 official API, Profile Bundle and Cordis mechanisms.

### Changed (architecture)

- **Profile Bundle + Cordis composition.** The plugin is a standalone npm
  package declaring `dsh.bundle.patch`; `cordis.patch.yml` inserts one plugin
  row into a profile's layer stack (`dsh plugin --profile web add dsh-sess`).
- **Host half** (`src/index.ts`, `src/host/*`): a Cordis plugin that serves the
  `/dsh-sess` RPC channel. All behavior is built from the official services
  `ctx.sessions`, `ctx.sessionPersistence`, `ctx.workspaceRegistry` and
  `ctx.sessionController` — no harness source is touched and no workspace
  domain state is ever written.
- **Browser half** (`src/client/*`): a module-table-compliant bundle that
  registers a native **Session Manager** Settings section through the official
  client slots system (`settings.section`) and locale services; the sidebar
  session-row "Delete session" entry is a defensive DOM-level extension (the
  native menu exposes no third-party slot).
- **Data flows from the official client projections.** The manager renders the
  same session/workspace projections the sidebar uses (titles, activity time,
  workspace membership, archive set), so displayed metadata matches native UI.

### Preserved behavior

- Permanent deletion of **cold** sessions: durable artifact removal (guarded)
  plus workspace-accounting release via the official detach API.
- Refusals with stable error codes: `agent-busy` for sessions open in this
  process, `session-not-found`, `bad-request` for malformed ids, and structural
  guards before any file is removed.
- Archive manager: list archived sessions (title / workspace / activity time),
  rename through the official `sessionController.rename` path, delete with the
  same confirmation flow.
- zh/en user-facing copy; no user-visible semantics silently changed.

### Engineering

- Independent repository: own `package.json`, TypeScript (host/client/tests),
  esbuild client build, oxlint, vitest suite, GitHub CI and release workflows.
- Host operations accept structural official-service faces and are unit-tested
  against fakes plus real temp directories; browser projection/locales are
  pure modules with Node tests. Typecheck, lint, build and all tests pass.
- No TODO, placeholder, compatibility shim, or version branch anywhere in the
  codebase or documentation.

### Added

- **Sidebar session-row menu entry.** Every session row's ellipsis menu gains a
  **Delete session** entry directly below the native **Archive** row. The
  native menu has no third-party slot, so the entry is a defensive DOM-level
  extension (structural matching, idempotent, marker-guarded): the session id
  is resolved from the row's React fiber and never from visible text, and the
  entry silently disappears whenever the row shape cannot be proven. Selecting
  it opens the plugin-owned confirmation modal and runs the same host delete
  path as the Session Manager page.
- **Workspace grouping in the Session Manager list.** Sessions are shown
  grouped under their workspace (Ungrouped last), each group with a header and
  per-group count, in both tabs.

### Changed

- **Precise busy diagnostics.** `dshSess.deleteSession` now reports whether the
  refusing agent is `running` or merely retained (`idle`), and the UI shows
  targeted copy: running, retained-with-session-id, or "currently viewed" (the
  latter is refused client-side before any RPC, since the host cannot know the
  browser's active session). Deleting a session opened earlier in this process
  is a documented official-API limitation (no session-close API in
  dsh-v0.1.2-alpha.5), so the message states the restart requirement exactly.
- **Compact manager layout.** Removed the artificial bottom whitespace of the
  Session Manager content and enlarged the scrollable list area.

### Fixed

- **Client section rendered empty in the Settings dialog.** The esbuild client
  build did not enable the automatic JSX runtime, so the bundle emitted
  `React.createElement` calls without importing React, crashing the
  `settings.section` entry (`ReferenceError: React is not defined`) and leaving
  the section label visible with no content. The build now sets
  `jsx: 'automatic'`, emitting `react/jsx-runtime` calls (the baseline module
  table word), and the manager page renders its full content.

### Notes

- The previous line of development (v0.1.x, sidebar row-menu injection on the
  older dsh UI, private `/dsh-sess` DOM-based client) is superseded by this
  release and is referenced only in the old repository's history.
