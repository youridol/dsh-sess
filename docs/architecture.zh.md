# dsh-sess Architecture（架构）

目标版本：[`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) **`dsh-v0.1.2-alpha.5`**。

本文描述 dsh-sess 的设计与原因，作为评审依据：每个设计决策都注明其依托的官方机制，
并明确说明**刻意不做**什么。

## 1. 设计约束

插件受四条硬性规则约束：

1. **仅使用官方 API。** 一切行为建立在 DSH 公开的服务、端点和组合机制上；不改
   Harness 源码、不触碰私有 API、不做版本特判。
2. **仅使用官方 UI 面。** 浏览器端通过官方客户端 slot 体系扩展；不对其它包拥有的
   组件做 DOM 注入或改动。
3. **模块表纪律。** 客户端 bundle 运行时只能 `require` 冻结的基线平台模块
   （react、jsx runtime、ui-primitives）；其余依赖由构建内联。
4. **不写 workspace 域状态。** 归档/删除绝不直接改写持久化的
   `archivedSessionIds` 或记录表（这是旧代插件踩过的坑）；只调用官方 registry API。

## 2. 运行时切分

一个 profile bundle 行挂载两个半区：

| 半区 | 产物 | 挂载形式 | 运行形态 |
| --- | --- | --- | --- |
| 宿主端 | `lib/index.js`（包 `main`） | Cordis 插件行（`cordis.patch.yml`） | 宿主进程内 Cordis 插件 |
| 浏览器端 | `client/client.js`（包导出 `./client`） | 客户端模块（boot 行客户端半区） | 页面内 Cordis 插件 |

两个半区通过插件私有的 **`/dsh-sess` RPC 通道**通信——而非官方 api gateway
独占的共享 `/api` 通道。

### 宿主端（`src/index.ts`、`src/host/*`）

入口导出 cordis 插件形态（`name`、`inject`、`apply`），声明所需服务：
`connection`、`webServer`、`sessions`、`sessionPersistence`、
`workspaceRegistry`。Cordis 会把这些服务到齐后才激活插件，因此 `apply` 可直接
安装 RPC 通道：

```text
apply(ctx)
  └─ ctx.effect(installSessChannel)   # ctx.connection.rpc.handle('/dsh-sess', …)
```

通道处理器把官方服务解析为**窄结构面**（`delete-session.ts`、
`rename-session.ts`），并分发两个端点（`rpc.ts`）：

- `dshSess.deleteSession { sessionId }`
- `dshSess.renameSession { sessionId, title }`

服务面采用结构类型是有意的：编译期钉住 dsh-v0.1.2-alpha.5 的类型，运行时只依赖
各官方服务的**小型公开子集**——与完整宿主 Context 解耦，且易于单元测试。

### 浏览器端（`src/client/*`）

浏览器入口向 locale 服务注册文案字典，并通过
`ctx.slots.inject('settings.section', … register …)` 贡献一个**设置分区**——
profile 插件向设置对话框添加页面的官方途径。分区组件的数据来自**客户端会话/工作区
投影**（与侧边栏同源），因此无需额外的服务端列表端点，标题与活跃时间与原生 UI 一致。

## 3. 删除算法

`deleteSession`（宿主端）安全地实现永久删除：

```text
assertSessionId(raw)                          # 单一干净路径段；拒绝 '..'、'~'、分隔符
若 sessions.get(id) 存在   → agent-busy       # 会话在本进程打开
headers = sessionPersistence.list()
header  = headers.find(id)        → 否则 session-not-found
removeSessionArtifact(header)                 # 带护栏删除，见下
for entity of workspaceRegistry.list()        # 经官方 API 解除记账
  若 entity.sessionIds 含 id → entity.detachSession(id)
```

`removeSessionArtifact` 只删除官方 JSONL 后端定位到的文件
（`ctx.sessionPersistence.locate(header)`），并经过结构护栏：

- 后端种类为 `jsonl`；
- 产物基名为 `session.jsonl` 或 `session.jsonl.zstd`；
- 路径为绝对路径；
- 所在目录是**与校验后的会话 id 完全同名**的单一干净段（JSONL 布局为
  `<root>/<projectKey(cwd)>/<id>/…`，且通过校验的 id 会被后端路径编码器原样落盘）。

护栏失败则不删除任何文件并返回 `internal`；后端无单会话产物时删除为空操作
（没有可删的持久化内容），仍会解除记账。

拒绝 live 会话的理由：打开的会话持有内存 agent 与 UI 状态，在其下方删除日志会留下
不一致的内存状态。官方没有可安全支持“运行中删除”的会话关闭接口，因此插件与原生
行为保持一致：本进程打开过的会话在变冷（关闭或重启 DSH）后才可删除。

## 4. 重命名操作

`renameSession` 复用**官方 session controller**
（`ctx.sessionController.rename({ sessionId, title })`）——即原生行菜单重命名
走的同一宿主操作。归档（冷）会话也能使用，因为 controller 会先 resolve/resume
该会话，再经 session-title 服务写入持久化标题事件。插件只校验输入基本形态
（合法 id + 非空去空格标题且在合理长度内），并把官方拒绝
（`session/title-invalid`、`session/not-found`）映射到自己的稳定错误码。

## 5. 管理器数据流（浏览器端）

管理器行数据纯由两个官方客户端投影派生：

```text
sessions.list.getSnapshot()   # ids、byId { title, displayTitle, updatedAt, running, blank, parentId, origin }
workspaces.list.getSnapshot() # items[].sessionIds → 工作区标题；archivedSessionIds
```

`model.ts` 中为纯投影逻辑：

- 跳过子 agent 会话（`parentId` / `origin: 'subagent'`）；
- 由记账映射工作区标题，标记归档成员；
- 按活跃时间倒序。

破坏性操作走宿主通道；成功后 `await ctx.sessions.refresh()`，工作区侧由
follow 流自行收敛（见 README「已知边界」）。

## 6. 非目标与刻意省略

- **不支持取消归档。** 官方归档集合单向；恢复需要直接写 workspace 域状态（被禁止）。
  重命名 / 删除已覆盖归档生命周期。
- **不做会话创建 / 切换 / 关闭。** 这些在原生 UI 与官方 API 中已存在；插件只补
  DSH 缺失的能力（永久删除、归档管理）。
- **不直接写持久化。** 追加、标题、恢复等全部留在官方服务内。
- **不做 DOM 级 UI 集成。** 行菜单属于其它包且无 slot；插件刻意不去改动它们。

## 7. 可测试性

宿主操作接收结构服务面，单测用假服务 + 真实临时目录充当持久化树；浏览器端投影是
纯模块，可在 Node 下测试。详见 [Testing](testing.en.md)。
