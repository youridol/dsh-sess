# dsh-sess API 参考

目标版本：dsh-v0.1.2-alpha.5。

本文档是浏览器端与宿主端之间的 wire 契约，以及宿主端消费的官方服务清单。
面向用户的文案已本地化（zh/en）；**错误码是稳定契约**——请勿解析 message。

## 1. 传输

- 通道：`/dsh-sess`（插件私有；共享的 `/api` 通道归官方 api gateway 所有）。
- 方法：向 `/dsh-sess/<endpoint>` 发 HTTP `POST`，携带 connection 层标准的
  `client-request` 信封；浏览器端经
  `ctx.connection.rpc.call('/dsh-sess', endpoint, payload)` 调用。
- 响应为标准信封：

```text
{ ok: true,  value: ... }
{ ok: false, error: { code, message, details } }
```

## 2. 端点

### `dshSess.deleteSession`

永久删除一个会话。

请求载荷

```jsonc
{ "sessionId": "session-12" }
```

成功返回值

```jsonc
{ "deleted": "session-12" }
```

行为（全部在宿主端，仅用官方服务）：

1. 校验会话 id（见下）；非法 id 返回 `bad-request`。
2. 本进程当前打开的会话被拒绝（`agent-busy`）。
3. 会话必须存在于持久化中（否则 `session-not-found`）。
4. 在结构护栏保护下删除官方持久化后端定位到的产物。
5. 经官方 registry detach API 解除工作区记账。

### `dshSess.renameSession`

经官方 session controller 重命名（例如归档的冷）会话。

请求载荷

```jsonc
{ "sessionId": "session-12", "title": "New title" }
```

成功返回值

```jsonc
{ "title": "New title" }
```

行为：

1. 校验 id；标题必须为非空（trim 后）字符串且不超过 512 字符（否则
   `bad-request`）。
2. 服务挂载时委托 `ctx.sessionController.rename`；未挂载返回
   `service-unavailable`。
3. 官方拒绝映射为 `title-invalid` / `session-not-found`。

## 3. 会话 id 校验

两个端点接受的 id 均为 `[A-Za-z0-9._-]` 上的单一干净路径段，长度 1–128，
不得为 `.`/`..` 或包含 `..`。这是刻意取 Harness 自身铸造字符集的子集：JSONL
后端会把这些 id 原样作为目录名落盘，因此产物删除护栏可以要求目录名与 id 完全一致，
而不必复刻后端的路径编码器。`~` 被拒绝，因为编码器会转义它。

## 4. 错误码

| code | 含义 | details |
| --- | --- | --- |
| `bad-request` | 载荷非法（id/标题形态） | 可选 `{ sessionId }` |
| `session-not-found` | 不存在该 id 的持久化会话 | `{ sessionId }` |
| `agent-busy` | 会话在本进程打开，拒绝删除 | `{ sessionId }` |
| `title-invalid` | 官方 controller 拒绝该标题 | `{ sessionId }` |
| `service-unavailable` | 所需官方服务未挂载 | `{ reason }` |
| `internal` | 意外失败（message 含细节） | `{}` |

浏览器端把每个 code 映射为本地化文案（dsh-sess 字典中的 `error.<code>`）；
未知 code 原样展示宿主 message。

## 5. 宿主端消费的官方服务

宿主端从宿主 Context 读取以下公开服务键（列出 dsh-v0.1.2-alpha.5 中提供方）：

| ctx 键 | 提供方 | 用途 |
| --- | --- | --- |
| `ctx.connection` / `ctx.webServer` | `@deepseek-ai/dsh-client-connection` / `@deepseek-ai/dsh-host-webserver` | 服务 `/dsh-sess` |
| `ctx.sessions` | `@deepseek-ai/dsh-session` | live 会话护栏（`get`） |
| `ctx.sessionPersistence` | `@deepseek-ai/dsh-session-persistence`（后端 `…-jsonl`） | 存在性校验（`list`）、产物定位（`locate`） |
| `ctx.workspaceRegistry` | `@deepseek-ai/dsh-workspace` | 解除记账（`list`、实体 `detachSession`） |
| `ctx.sessionController` | `@deepseek-ai/dsh-api-session-controller` | 重命名（可选；缺失时降级） |

代码只触碰各服务的窄文档化子集，并为它们保留结构面以便测试伪造。

## 6. 浏览器端消费的客户端服务

浏览器端通过 locale 服务注册字典、通过 slots 服务注册设置分区，并读取：

- `ctx.sessions.list`（快照 + 订阅）与 `ctx.sessions.refresh()`；
- `ctx.workspaces.list`（快照 + 订阅）；
- `ctx.connection.rpc`（发起 `/dsh-sess` 调用）；
- `ctx.locale.register/bind` 与 `ctx.slots.inject/register`。

客户端 bundle 运行时的唯一模块依赖是基线平台词
（`react`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-ui-primitives`）。
