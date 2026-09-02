# Development Guide

Target: dsh-v0.1.2-alpha.5. This guide explains the repository toolchain,
structure and extension workflow.

## 1. Toolchain

| tool | role |
| --- | --- |
| Node.js ≥ 20 / npm | runtime & package manager |
| TypeScript ~5.7 | typecheck (three projects) and host build |
| esbuild | browser bundle build |
| vitest | tests (Node environment) |
| oxlint | lint (`.oxlintrc.json`) |

Commands:

```bash
npm ci                 # install pinned devDependencies
npm run typecheck      # host + client + tests type projects
npm run lint           # oxlint over src, tests, scripts
npm test               # vitest suite
npm run build          # lib/ (tsc) + client/client.js (esbuild)
npm run check          # lint + typecheck + build + test (CI entry)
```

## 2. Repository layout

```text
src/index.ts                 host plugin entry (name / inject / apply)
src/host/errors.ts           stable error codes, SessionOpError, wire errors
src/host/session-id.ts       session-id validation (single clean path segment)
src/host/artifact.ts         guarded removal of the durable artifact
src/host/delete-session.ts   delete operation over official service faces
src/host/rename-session.ts   rename operation over the official controller
src/host/rpc.ts              /dsh-sess channel: install + endpoint dispatch
src/client/index.tsx         browser entry: dictionaries + Settings section
src/client/session-manager.tsx   manager UI (two tabs, inline confirm/rename)
src/client/model.ts          pure row projection & relative time (unit-tested)
src/client/rpc.ts            client RPC helpers & RpcBusinessError
src/client/locales.ts        zh/en copy (key sets enforced equal)
src/client/types.ts          structural client service faces
src/client/styles.ts         scoped stylesheet injection
tests/host/operations.spec.ts   host op/guard tests (fake services + temp dirs)
tests/client/model.spec.ts      locale parity + projection tests
cordis.patch.yml             profile bundle patch (mounts the plugin row)
scripts/build-client.mjs     esbuild client bundle (module-table externals)
```

## 3. Type projects

- `tsconfig.host.json` — host sources; emits `lib/` (declarations included).
  Relative imports use `.ts` extensions; `rewriteRelativeImportExtensions`
  rewrites them to `.js` on emit.
- `tsconfig.client.json` — browser sources (DOM lib, react-jsx); typecheck
  only, no emit (the bundle is built by esbuild).
- `tsconfig.tests.json` — test sources plus the host sources they import.

## 4. Adding or changing a host operation

1. Add the operation as a pure function over a **structural face** (see
   `delete-session.ts`) — it receives exactly the official services it needs
   and nothing else. Import official types (e.g. `SessionId`, `SessionHeader`
   from `@deepseek-ai/dsh-session/types`) type-only.
2. Throw `SessionOpError(code, message, details)` for every refusal; fold
   unexpected failures into `internal`.
3. Register the endpoint in `rpc.ts` (`Endpoints`, dispatch case, payload field
   extraction).
4. Add a unit test faking the face (and a temp directory when the filesystem
   is involved).

Constraints that keep the plugin aligned with the target version:

- never require a harness core package at runtime — only official services from
  the host context (`ctx.get` / `inject`);
- never write workspace domain state or session files outside the guarded
  artifact removal;
- keep wire payloads lossless-JSON.

## 5. Changing the browser half

- Runtime module imports must stay within the baseline platform words; the
  esbuild script (`scripts/build-client.mjs`) lists them as `external`. Keep
  that list in sync with `src/client` imports.
- Type against the *structural faces* in `types.ts` (the client bundle may not
  import the full client packages at runtime). `@deepseek-ai/dsh-client-ui-primitives`
  is the one real UI dependency (baseline).
- All user-visible copy lives in `locales.ts`; add keys to `zh` and `en`
  together (a test enforces identical key sets).
- Data derivation belongs in pure `model.ts` functions so it stays testable
  without a DOM.

## 6. Code conventions

- English doc-comments explaining *why*, JSDoc `@param`/`@throws` on public
  functions.
- `strict` TypeScript, no implicit any, `noUncheckedIndexedAccess` honored.
- Errors: stable codes over messages (see `docs/api.en.md`).
- No TODO/placeholder markers, no version branches, no monkey patching.

## 7. Release

1. Bump `version` in `package.json`; add a `CHANGELOG.en.md` /
   `CHANGELOG.zh.md` entry.
2. Run `npm run check`.
3. Tag `v<version>` and push; the release workflow
   (`.github/workflows/release.yml`) runs CI and publishes to npm from the tag.
