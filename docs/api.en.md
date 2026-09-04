# dsh-sess API Reference

Target: dsh-v0.1.2-alpha.5.

This document is the wire contract between the browser half and the host half,
plus the official services the host half consumes. Browser-visible copy is
localized (zh/en); error *codes* are the stable contract — never parse messages.

## 1. Transport

- Channel: `/dsh-sess` (plugin-private; the shared `/api` channel is owned by
  the official api gateway).
- Method: HTTP `POST` to `/dsh-sess/<endpoint>` with the connection layer's
  standard `client-request` envelope; the browser calls through
  `ctx.connection.rpc.call('/dsh-sess', endpoint, payload)`.
- Responses use the standard envelope:

```text
{ ok: true,  value: ... }
{ ok: false, error: { code, message, details } }
```

## 2. Endpoints

### `dshSess.deleteSession`

Permanently delete one session.

Payload

```jsonc
{ "sessionId": "session-12" }
```

Success value

```jsonc
{ "deleted": "session-12" }
```

Behavior (all host-side, official services only):

1. The id is validated (see below); an invalid id is a `bad-request`.
2. A session currently open in this process is refused (`agent-busy`).
3. The session must exist in durable persistence (`session-not-found` otherwise).
4. The durable artifact located by the official persistence backend is removed
   under structural guards.
5. Workspace accounting is released through the official registry detach API.

### `dshSess.renameSession`

Rename one (e.g. archived, cold) session through the official session
controller.

Payload

```jsonc
{ "sessionId": "session-12", "title": "New title" }
```

Success value

```jsonc
{ "title": "New title" }
```

Behavior:

1. The id is validated; the title must be a non-empty string (after trimming)
   of at most 512 characters (`bad-request` otherwise).
2. Delegates to `ctx.sessionController.rename` when that service is mounted;
   otherwise `service-unavailable`.
3. Official rejections map to `title-invalid` / `session-not-found`.

## 3. Session id validation

Ids accepted by both endpoints are single clean path segments over
`[A-Za-z0-9._-]`, 1–128 characters, never `.`/`..` and never containing `..`.
This is deliberately a subset of the harness's own mint charset: the JSONL
backend stores these ids verbatim as directory names, so the artifact-removal
guard can require an exact name match without reimplementing the backend's
path encoder. `~` is rejected because the encoder escapes it.

## 4. Error codes

| code | meaning | details |
| --- | --- | --- |
| `bad-request` | invalid payload (id/title shape) | optional `{ sessionId }` |
| `session-not-found` | no stored session with that id | `{ sessionId }` |
| `agent-busy` | session is retained by this process; deletion refused | `{ sessionId, reason?: 'idle'\|'running', retained?: 'session' }` |
| `title-invalid` | official controller rejected the title | `{ sessionId }` |
| `service-unavailable` | required official service not mounted | `{ reason }` |
| `internal` | unexpected failure (message has details) | `{}` |

The browser maps each code to localized copy (`error.<code>` in the dsh-sess
dictionary); `agent-busy` is refined from the diagnostics: a `running` reason
gets the running message, anything else gets the "retained" message including
the exact session id the host saw. Unknown codes surface the host message
verbatim. Deleting the session currently viewed in the browser is refused
client-side before any RPC (the host cannot know the browser's current
session).

## 5. Official services the host half consumes

The host half reads the following public service keys from the host context
(listed with the package that provides them in dsh-v0.1.2-alpha.5):

| ctx key | provided by | used for |
| --- | --- | --- |
| `ctx.connection` / `ctx.webServer` | `@deepseek-ai/dsh-client-connection` / `@deepseek-ai/dsh-host-webserver` | serving `/dsh-sess` |
| `ctx.sessions` | `@deepseek-ai/dsh-session` | live-session guard (`get`) |
| `ctx.sessionPersistence` | `@deepseek-ai/dsh-session-persistence` (backend `…-jsonl`) | existence check (`list`), artifact location (`locate`) |
| `ctx.workspaceRegistry` | `@deepseek-ai/dsh-workspace` | accounting release (`list`, entity `detachSession`) |
| `ctx.sessionController` | `@deepseek-ai/dsh-api-session-controller` | rename (optional; degraded when absent) |

Only the narrow documented surface of each service is touched; the code keeps
structural faces for these so tests can fake them.

## 6. Client services the browser half consumes

The browser half registers dictionaries through the locale service and a
Settings section through the slots service, and reads:

- `ctx.sessions.list` (snapshot + subscribe) and `ctx.sessions.refresh()`;
- `ctx.workspaces.list` (snapshot + subscribe);
- `ctx.connection.rpc` for the `/dsh-sess` calls;
- `ctx.locale.register/bind` and `ctx.slots.inject/register`.

The client bundle's only runtime module requires are the baseline platform
words (`react`, `react/jsx-runtime`, `@deepseek-ai/dsh-client-ui-primitives`).
