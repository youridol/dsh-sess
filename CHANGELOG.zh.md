# 更新日志

dsh-sess 的所有重要变更都记录于此（简体中文）。English version:
[CHANGELOG.en.md](CHANGELOG.en.md)。

## [0.2.0] - 2026-08-29

**面向 dsh-v0.1.2-alpha.5 的独立仓库重写。**

dsh-sess 被重新设计、重写，并从 `dsh-plugin` 收录仓库迁出为独立仓库，严格基于
dsh-v0.1.2-alpha.5 官方 API、Profile Bundle 与 Cordis 机制实现。

### 架构变更

- **Profile Bundle + Cordis 组合。** 插件是独立 npm 包，声明 `dsh.bundle.patch`；
  `cordis.patch.yml` 向 profile 的层栈插入一行插件
  （`dsh plugin --profile web add dsh-sess`）。
- **宿主端**（`src/index.ts`、`src/host/*`）：Cordis 插件，服务 `/dsh-sess` RPC
  通道。全部行为建立在官方服务 `ctx.sessions`、`ctx.sessionPersistence`、
  `ctx.workspaceRegistry` 与 `ctx.sessionController` 之上——不改 harness 源码，
  绝不写 workspace 域状态。
- **浏览器端**（`src/client/*`）：符合模块表约束的 bundle，通过官方客户端 slot
  体系（`settings.section`）与 locale 服务注册原生 **会话管理** 设置分区。无 DOM
  注入、无私有客户端 API。
- **数据来自官方客户端投影。** 管理器渲染与侧边栏同源的会话/工作区投影（标题、
  活跃时间、工作区归属、归档集合），展示的元数据与原生 UI 一致。

### 保留的行为

- **冷会话**永久删除：带护栏的持久化产物删除 + 经官方 detach API 解除工作区记账。
- 稳定错误码拒绝：本进程打开 → `agent-busy`、`session-not-found`、非法 id →
  `bad-request`；任何文件被删前先过结构护栏。
- 归档管理器：列出归档会话（标题 / 工作区 / 活跃时间），经官方
  `sessionController.rename` 路径重命名，删除走同一套确认流程。
- zh/en 双语文案；不静默改变任何用户可见语义。

### 工程

- 独立仓库：自有 `package.json`、TypeScript（host/client/tests）、esbuild 客户端
  构建、oxlint、vitest、GitHub CI 与 release 工作流。
- 宿主操作接收结构化的官方服务面，用伪造服务 + 真实临时目录做单测；浏览器投影与
  文案是纯模块，带 Node 测试。Typecheck、lint、build 与全部测试通过。
- 代码与文档中无 TODO、占位符、兼容垫片或版本分支。

### 新增

- **侧边栏会话行菜单入口。** 每条会话行的省略号菜单在原生 **归档** 行正下方新增
  **删除会话**。原生菜单没有第三方 slot，因此该入口是防御式 DOM 级扩展（结构匹配、
  幂等、带注入标记）：会话 id 取自该行 React fiber、绝不信任可见文本；无法证实行
  结构时入口静默消失。选中后打开插件自有的确认弹窗，走与会话管理页相同的宿主删除
  路径。

### 修复

- **设置中的会话管理分区内容为空。** esbuild 客户端构建未开启 automatic JSX
  runtime，产物生成 `React.createElement` 调用却未导入 React，导致
  `settings.section` 条目崩溃（`ReferenceError: React is not defined`）——
  分区标签可见但内容为空。现构建已设置 `jsx: 'automatic'`，产物改为调用
  `react/jsx-runtime`（基线模块表词），管理页完整渲染。

### 说明

- 旧开发线（v0.1.x：面向旧版 dsh UI 的侧边栏行菜单注入、基于私有 `/dsh-sess`
  DOM 客户端）已被本版取代，仅存在于旧仓库历史中作为参考。
