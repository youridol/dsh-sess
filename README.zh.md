# dsh-sess

**DeepSeek Harness（DSH）会话管理插件。**

`dsh-sess` 在 DSH Web UI 中新增 **「会话管理」** 页面（设置 → 会话管理），支持
永久删除冷会话、管理归档会话（列表 / 重命名 / 删除）。插件是**独立 npm 包**，
作为 profile bundle 安装到 DSH profile，通过官方 **Profile Bundle + Cordis**
机制挂载，严格基于
[`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)
**`dsh-v0.1.2-alpha.5`** 的公开 API 实现，不修改 Harness 源码。

> 简体中文 · [English](README.md)

## 为什么需要这个插件

DSH 原生界面（截至 `dsh-v0.1.2-alpha.5`）可以从行菜单重命名 / 派生 / 归档会话、
重命名 / 删除工作区注册——但**没有会话的永久删除**，且归档后**无法再查看或重命名
归档会话**（归档是单向的）。`dsh-sess` 正好补上这两个缺口：

1. **永久删除会话** —— 删除该会话的日志产物与工作区记账。带安全护栏：仅允许删除
   **冷会话**（本进程内未打开），绝不会在 agent 仍占用时删除其日志。可从
   **会话管理**设置页进入，也可在**侧边栏每条会话行**的省略号菜单直接操作：菜单在
   **归档**下方新增 **删除会话**（同一套确认流程）。
2. **归档管理器** —— 在统一界面列出归档会话（标题 / 工作区 / 活跃时间），并支持
   **重命名**与**删除**。

## 功能清单

| 能力 | 位置 | 说明 |
| --- | --- | --- |
| 会话列表 / 查询 / 当前状态 | 会话管理「全部会话」 | 与侧边栏同一投影：标题、活跃时间、所属工作区、运行/空白标记。 |
| 会话标识、名称与元数据 | 会话管理 | 展示持久化标题（缺失回退 id）、工作区归属、归档状态、活跃时间。 |
| 会话永久删除 | 会话管理 + 侧边栏行菜单 | 每条会话行的省略号菜单在「归档」下方新增 **删除会话**。仅冷会话；live 会话返回 `agent-busy` 并给出明确提示。 |
| 归档会话管理 | 「归档会话」页 | 列表、行内重命名（官方 `session/rename` 路径）、删除。 |
| 持久化、读取与重启恢复 | 宿主操作 | 存在性经官方 `ctx.sessionPersistence.list()` 校验；产物删除经官方 `locate()`。DSH 重启后所有会话变冷即可删除。 |
| 会话与工作区实例关联 | 会话管理 | 工作区标题来自客户端工作区投影；删除时经官方 `workspaceRegistry` detach 接口解除记账。 |
| 异常会话安全处理 | 护栏 | 非法 id 拒绝；未知会话 → `session-not-found`；live 会话 → `agent-busy`；危险路径在触碰文件前即被拒绝。 |

## 环境要求

- DeepSeek Harness **`dsh-v0.1.2-alpha.5`**（web profile：`@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`）。
- Node.js ≥ 20。
- 面向 **web** UI（设置页）；不影响 headless / CLI 行为。

## 安装

用官方插件命令安装到运行 Web UI 的 profile（`PATH` 需包含 pnpm）：

```bash
dsh plugin --profile web add dsh-sess
```

`dsh plugin` 会把参数转发给 profile 目录里的 pnpm，并在安装后把该包追加到
`dsh.profile.bundles`（因为包声明了 `dsh.bundle`；详见
[docs/integration.zh.md](docs/integration.zh.md)）。重启 Web UI（停掉并重新
`dsh web`）后，设置页即出现 **会话管理** 分区。

> 若从本仓库的 Git 检出安装（而非 npm）：先构建
> （`npm ci && npm run build`），再把 profile 指向本地目录：
> `dsh plugin --profile web add <仓库绝对路径>`（相对路径按执行命令时的工作目录解析）。
> 运行时依赖 `lib/` 与 `client/` 构建产物，这两个目录不入库。

### 验证

1. 打开 **设置 → 会话管理**，出现会话分区并列出你的会话。
2. **全部会话** 展示所有非子 agent 会话；正在运行的会话带标记且不可删除。
3. 原生归档一条会话（行菜单 → 归档）。它出现在 **归档会话** 页，可重命名或删除。
4. 删除一条*冷*会话：管理器要求确认，随后删除日志与工作区记账；刷新后该行消失
   （见下文「已知边界」）。

## 使用

**会话管理 → 全部会话**

- 每行显示：标题（或 id）、工作区（或 *未分组*）、相对活跃时间、状态徽标
  （归档 / 空白冷会话 / 运行中）。
- **删除会话** 需显式确认。仍在本进程打开的会话（`agent-busy`）或已不存在的会话
  （`session-not-found`）会返回本地化错误提示。

**会话管理 → 归档会话**

- 归档会话（标题 / 工作区 / 活跃时间），支持 **重命名**（行内编辑，Enter 保存、
  Esc 取消）与 **删除**（与上方同一套确认流程）。

## 已知边界（如实说明）

以下限制源于官方 API 面，而非插件：

- **不支持取消归档。** 官方工作区归档集合是单向的；`dsh-sess` 从不直接写
  workspace 域状态，因此归档会话无法恢复，只能重命名或删除。
- **live 会话拒绝删除。** 本进程打开过的会话其内存 agent 仍存在，删除其日志会
  破坏 UI 状态；请先关闭会话或重启 DSH（重启后全部变冷）再删除。
- **侧边栏在下一次投影刷新后收敛。** 删除工作区内会话的同时经官方 API 解除其
  记账；侧边栏/分组行会在下一次会话/工作区刷新后收敛，DSH 重启后完全稳定
  （搜索/sqlite 索引按持久化产物自动对账）。
- **子 agent 会话不展示。** 它们归属于父会话，应通过父会话管理。
- **孤儿归档标记无副作用。** 删除归档会话后其 id 可能残留在持久化归档集合中——
  官方 API 没有不写域状态即可移除标记的途径；列表面总是把归档 id 与真实会话联表，
  孤儿永不渲染。
- **重命名会使会话重新变活。** 重命名经官方控制器 resolve/resume 会话（与原生行为
  一致），需等其变冷后再删除。
- **侧边栏行菜单扩展是 DOM 级且防御式。** 原生会话行菜单没有第三方 slot，因此
  「删除会话」入口以结构匹配方式注入到「归档」下方：只作用于真正的会话菜单，且会话
  id 取自行的 React fiber——无法证实 id 时直接跳过而非猜测（这意味着若未来
  ui-workspace 重构行结构，该入口可能消失，需要随之适配）。

## 目录结构

```text
src/index.ts                宿主端插件入口（cordis plugin）
src/host/                   宿主端操作（仅用官方服务）
  rpc.ts                    /dsh-sess RPC 通道与端点分发
  delete-session.ts         冷会话永久删除
  rename-session.ts         归档会话重命名（官方 controller）
  artifact.ts               带护栏的持久化产物删除
  session-id.ts             会话 id 校验
  errors.ts                 稳定错误码 / wire 错误
src/client/                 浏览器端（官方客户端服务 + slots）
  index.tsx                 插件入口；注册设置分区与行菜单
  session-manager.tsx       管理器 UI
  row-menu.ts               会话行菜单注入（归档下方）
  fiber-id.ts               防御式会话 id 解析（React fiber）
  row-delete.tsx            行菜单确认弹窗宿主（Modal）
  row-store.ts              行删除请求存储
  delete-flow.ts            删除/重命名共享错误文案
  model.ts                  纯行投影（单测覆盖）
  rpc.ts                    客户端 RPC 助手
  locales.ts                zh/en 文案
tests/                      单元测试（宿主操作 + 客户端模型/文案）
cordis.patch.yml            Profile bundle patch（挂载插件行）
```

## 文档

- [架构](docs/architecture.zh.md) —— 组件、数据流、边界。
- [API 参考](docs/api.zh.md) —— RPC 端点、载荷、错误码。
- [Profile Bundle 与 Cordis 集成](docs/integration.zh.md) —— 挂载方式、安装/升级细节、故障排查。
- [开发指南](docs/development.zh.md) —— 仓库工具链、结构、如何扩展。
- [测试说明](docs/testing.zh.md) —— 测试矩阵与运行方式。
- [贡献指南](CONTRIBUTING.zh.md) · [更新日志](CHANGELOG.zh.md)

English documentation mirrors these files (start at [README.md](README.md)).

## License

[MIT](LICENSE) © 2026 dsh-sess contributors
