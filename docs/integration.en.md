# Profile Bundle & Cordis Integration

This document explains how dsh-sess mounts into DeepSeek Harness
(dsh-v0.1.2-alpha.5) using only official mechanisms — bundles, profiles,
patches, the Cordis plugin registry and the client slot system.

## 1. Vocabulary

- **Bundle** — an npm package that ships a configuration layer: its manifest
  declares `dsh.bundle.patch`, pointing at a patch file that inserts or
  overrides plugin rows. A bundle is what an author distributes.
- **Profile** — a directory under `$DSH_HOME/profiles/<name>` describing one
  runnable composition; its manifest declares `dsh.profile.bundles`. A profile
  is what a user boots with `dsh --profile <name>` (or `dsh web`).
- **Patch** — a YAML list of loader patch entries applied over an empty root
  (`cordis.yml`). `- insert:` appends rows; id-targeted patches override a
  row's `config`/`disabled`/… fields. Layers apply in order: each bundle in
  `dsh.profile.bundles`, then the profile `cordis.patch.yml`, the home-level
  patch, then any `--patch` overlay. Later layers win.

## 2. What dsh-sess contributes

`package.json` declares:

```jsonc
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "inject": ["@deepseek-ai/dsh-client-connection", "@deepseek-ai/dsh-client-locale"], "platform": "web" }
},
"exports": {
  ".": { "types": "./lib/index.d.ts", "default": "./lib/index.js" },
  "./client": "./client/client.js",
  "./cordis.patch.yml": "./cordis.patch.yml"
}
```

`cordis.patch.yml` inserts one row:

```yaml
- insert:
    - id: dsh-sess
      name: 'dsh-sess'
```

When the profile composes, the row is resolved against the installed package:
the **host half** is the package main (`lib/index.js`) loaded as a Cordis
plugin; the **browser half** (`client/client.js`, exported as `./client`) is
materialized by the client module system and applied in the web page. Both
halves export the Cordis plugin shape (`name`, `inject`, `apply`).

## 3. Installing into a profile

Profiles are maintained by the `dsh plugin` command — never by hand:

```bash
# initialize-if-needed, pnpm add, and append to dsh.profile.bundles
dsh plugin --profile web add dsh-sess
```

`dsh plugin` forwards its arguments to pnpm inside the profile directory and
then reconciles `dsh.profile.bundles`: any dependency whose manifest declares
`dsh.bundle` joins the layer stack; bundle-less dependencies are left alone.

Restart the web UI afterwards. The host row becomes active once all declared
services (`connection`, `webServer`, `sessions`, `sessionPersistence`,
`workspaceRegistry`) exist — Cordis holds the plugin PENDING until then — and
the Settings page gains the **Session Manager** section once the client half
loads and the settings shell declares the `settings.section` slot.

## 4. What the client half requires from the profile

The web composition must already mount (all true for the stock `@deepseek-ai/dsh-web-app`
profile):

- the host services listed above (base + web-app bundles);
- the client services the manager reads: `sessions`, `workspaces`, `connection`,
  `locale`, `slots` (api-session-controller / api-workspace-controller client
  halves, client-connection, client-locale, ui-renderer);
- the settings shell that declares and renders `settings.section`
  (ui-settings / ui-settings-general), which is how the manager page appears;
- the baseline module table words the bundle requires at runtime
  (`react`, `react/jsx-runtime`, `@deepseek-ai/dsh-client-ui-primitives`).

If any of these are absent in a custom profile, the corresponding feature
degrades: without the settings shell the section is simply not rendered; the
host row stays pending if a required service never appears.

## 5. Upgrade / troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Settings has no "Session Manager" | The web UI was not restarted after install; or the package version resolved is old — rerun `dsh plugin --profile web add dsh-sess` (or `pnpm update dsh-sess`) so the lockfile points at the new version, then restart. |
| Delete always answers "service unavailable" | A required official service is not mounted in this profile (unusual for stock web). Check the profile bundles list. |
| Rename always answers "service unavailable" | `@deepseek-ai/dsh-api-session-controller` is not mounted (renaming is optional and degrades). |
| Host fails to load with "failed to import loader entry dsh-sess" | The package is not resolvable in the profile (dependency not installed / build artifacts missing). For Git/folder installs run `npm ci && npm run build` in the checkout first. |
| Stale UI after delete | The sidebar converges on the next projection refresh and fully settles after a DSH restart (search/sqlite indexes reconcile from persisted artifacts). |

## 6. Cordis contract used

- Plugin shape: `export const name`, `export const inject`, `export function apply(ctx)`.
- `inject` lists required services; activation is service-gated (no ordering
  assumptions between rows).
- `ctx.effect(cb)` binds a side effect (with disposer) to the plugin fiber.
- `ctx.get(name)` reads a service without the inject gate (used for the
  optional session controller).
- Nested availability is handled by the same rules: the client half waits for
  its injected client services and registers its Settings section under
  `ctx.slots.inject('settings.section', …)`, which defers to the slot's
  declaration lifetime.

## 7. Publishing

`npm publish` runs `prepack` (`npm run build`), so the tarball always carries
fresh `lib/` and `client/` artifacts. The package targets npm's public
registry; the lockfile is maintained with npm. CI (`.github/workflows/ci.yml`)
runs lint, typecheck, tests and the build on every push/PR; the release
workflow publishes on version tags.
