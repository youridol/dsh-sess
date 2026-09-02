# Testing

Target: dsh-v0.1.2-alpha.5.

## 1. Running tests

```bash
npm test            # vitest (Node environment)
npm run test:watch  # watch mode
npm run check       # full gate: lint + typecheck + build + tests
```

No live DSH host or browser is required: host operations run against faked
official-service faces plus real temporary directories; browser data logic is
pure and runs under Node.

## 2. Test suites

### `tests/host/operations.spec.ts` — host operations and guards

| Area | Cases |
| --- | --- |
| `assertSessionId` | accepts harness-style ids; rejects empty/non-string/separable/`.`/`..`/`~`/oversized values with `bad-request` |
| `removeSessionArtifact` | removes the owning directory for a valid shape; no-op without a location; refuses non-`jsonl` kinds, directory/id mismatches, unexpected artifact names, non-absolute paths — nothing is removed on refusal |
| `deleteSession` | refuses live sessions (`agent-busy`) without touching accounting; `session-not-found` for unknown sessions; deletes the artifact directory **and** releases accounting only for member workspaces; no-op artifact removal still releases accounting; `service-unavailable` for non-jsonl backends; `bad-request` before any service call for malformed ids |
| `renameSession` | succeeds through the official controller (trimmed title); maps `session/title-invalid`; clear failure when the controller is not mounted; rejects empty/non-string titles |
| channel handler | envelopes business failures (`{ok:false, error:{code,message,details}}`); unknown endpoints → `bad-request`; stable channel name `/dsh-sess` |

The deletion tests exercise the real filesystem (artifact directories are
created under `os.tmpdir()` and cleaned up after each test), which validates
that guards pass/fail against real paths.

### `tests/client/model.spec.ts` — browser data logic

| Area | Cases |
| --- | --- |
| locale dictionaries | `zh` and `en` key sets are identical; no empty or placeholder copy |
| `deriveSessionRows` | derives titles/workspace titles/archive/blank/running flags; skips subagent children (`parentId`/`origin`); falls back to the id; orders newest-first |
| `archivedRows` | keeps only archived rows in projection order |
| `relativeTime` | Intl-backed compact times for seconds/minutes/hours/days and "now" |

## 3. Coverage guidance

The pure modules (session-id validation, artifact guards, deletion/rename
semantics, row projection, locales) are the behavioral core and are kept
dependency-free precisely so these tests are fast and deterministic. UI
rendering itself is thin: rows come from the tested projection, operations from
the tested RPC/host path, and copy from the tested dictionaries. A new behavior
should land with its unit test in the same change.
