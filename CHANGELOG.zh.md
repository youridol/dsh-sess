# 更新日志

dsh-sess 的所有重要变更都记录于此（简体中文）。English version:
[CHANGELOG.en.md](CHANGELOG.en.md)。

## [0.2.1] - 2026-09-04

**全链路审计后的健壮性与整洁修复（PATCH）。**

### 修复

- **会话删除不再因记账释放失败而误报失败。** `dshSess.deleteSession` 在删除持久化
  产物后若某个工作区的 `detachSession` 抛出（极低概率的域写故障），现在降级为返回
  `detachWarnings` 诊断而非整个操作报错；界面给出"已删除、记账将自动收敛"提示
  （官方 registry 的下一次域写会剔除失效成员）。host 端测试补充 detach 失败路径。
- **行菜单确认弹窗的订阅与状态不再泄漏。** `RowDeleteHost` 的 store 订阅现在随组件
  卸载正确退订；插件卸载时新增 `resetRowDelete()` 清空模块级待决请求与订阅者，避免
  热重载后弹出陈旧确认框或残留监听器。
- **相对时间文案随界面语言即时切换。** 会话管理页的活跃时间（"x 分钟前"等）不再
  缓存首次渲染时的语言，订阅 locale 快照变化后立即跟随 zh/en 切换。
- **重命名上限交给官方裁决。** 移除本地 512 字符的标题预检——它与官方按部署配置的
  UTF-8 字节上限单位不一致，可能过早拒绝官方本可接受的标题；现在完全依赖官方
  `session/title-invalid` 归一化与拒绝（错误映射保持不变）。

### 变更

- **会话按工作区 id 分组而非标题。** 分组键改用稳定的工作区 id，标题仅作展示：
  两个同名工作区不再合并为一组。
- **删除失败提示增加兜底分支。** `agent-busy` 拒绝在既有 `running`/`retained` 细分
  之外增加通用兜底文案，未来宿主新增拒绝原因时不会退化为裸消息。
- **清理死代码。** 移除从未引用的 `row.renaming`、`row.deleting` 文案键。
- **npm 发布物精简。** `files` 白名单仅含 `lib/`、`client/client.js(.map)` 与文档，
  不再整目录携带源码与调试产物。

### 文档

- 修正 0.2.0 条目中"无 DOM 注入"的自相矛盾表述：设置分区经官方 slot 注册，侧边栏
  行菜单为防御式 DOM 级扩展（与 README/架构文档一致）。

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
  体系（`settings.section`）与 locale 服务注册原生 **会话管理** 设置分区；侧边栏
  会话行菜单的"删除会话"入口是防御式 DOM 级扩展（原生菜单无第三方 slot）。
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
- **会话管理列表按工作区分组。** 会话按所属工作区分组展示（未分组在最后），每组带
  标题与条数，两个页签均生效。

### 变更

- **删除失败提示细分。** `dshSess.deleteSession` 现在区分拒绝原因：agent 为
  `running`（运行中）或仅被保留（`idle`）；UI 给出对应文案——运行中、被保留
  （附宿主看到的 sessionId）、或“当前查看的会话”（后者在发起 RPC 前由客户端直接
  拒绝，宿主无从得知浏览器当前会话）。本进程曾打开过的会话无法删除是官方 API 的
  文档化限制（dsh-v0.1.2-alpha.5 无会话关闭接口），提示会精确说明“重启后即可删除”。
- **布局紧凑化。** 移除会话管理内容底部多余留白，并增大可滚动列表区域。

### 修复

- **设置中的会话管理分区内容为空。** esbuild 客户端构建未开启 automatic JSX
  runtime，产物生成 `React.createElement` 调用却未导入 React，导致
  `settings.section` 条目崩溃（`ReferenceError: React is not defined`）——
  分区标签可见但内容为空。现构建已设置 `jsx: 'automatic'`，产物改为调用
  `react/jsx-runtime`（基线模块表词），管理页完整渲染。

### 说明

- 旧开发线（v0.1.x：面向旧版 dsh UI 的侧边栏行菜单注入、基于私有 `/dsh-sess`
  DOM 客户端）已被本版取代，仅存在于旧仓库历史中作为参考。
