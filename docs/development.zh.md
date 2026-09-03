# 开发指南

目标版本：dsh-v0.1.2-alpha.5。本文说明仓库工具链、结构与扩展流程。

## 1. 工具链

| 工具 | 角色 |
| --- | --- |
| Node.js ≥ 20 / npm | 运行时与包管理 |
| TypeScript ~5.7 | 类型检查（三个工程）与宿主端构建 |
| esbuild | 浏览器 bundle 构建 |
| vitest | 测试（Node 环境） |
| oxlint | 代码检查（`.oxlintrc.json`） |

命令：

```bash
npm ci                 # 安装锁定的 devDependencies
npm run typecheck      # host + client + tests 三个类型工程
npm run lint           # oxlint 检查 src、tests、scripts
npm test               # vitest 套件
npm run build          # lib/（tsc）+ client/client.js（esbuild）
npm run check          # lint + typecheck + build + test（CI 入口）
```

## 2. 仓库结构

```text
src/index.ts                宿主端插件入口（name / inject / apply）
src/host/errors.ts          稳定错误码、SessionOpError、wire 错误
src/host/session-id.ts      会话 id 校验（单一干净路径段）
src/host/artifact.ts        持久化产物的带护栏删除
src/host/delete-session.ts  基于官方服务面的删除操作
src/host/rename-session.ts  基于官方 controller 的重命名操作
src/host/rpc.ts             /dsh-sess 通道：安装与端点分发
src/client/index.tsx        浏览器端入口：字典 + 设置分区
src/client/session-manager.tsx  管理器 UI（双页签、行内确认/重命名）
src/client/model.ts         纯行投影与相对时间（单测覆盖）
src/client/rpc.ts           客户端 RPC 助手与 RpcBusinessError
src/client/locales.ts       zh/en 文案（键集强制一致）
src/client/types.ts         结构化的客户端服务面
src/client/styles.ts        带作用域的样式注入
tests/host/operations.spec.ts   宿主操作/护栏测试（假服务 + 临时目录）
tests/client/model.spec.ts      文案对等 + 投影测试
cordis.patch.yml            profile bundle patch（挂载插件行）
scripts/build-client.mjs    esbuild 客户端 bundle（模块表外置）
```

## 3. 类型工程

- `tsconfig.host.json` —— 宿主源码；产出 `lib/`（含声明）。相对导入写 `.ts`
  后缀，`rewriteRelativeImportExtensions` 会在产出时改写为 `.js`。
- `tsconfig.client.json` —— 浏览器源码（DOM lib、react-jsx）；只类型检查不产出
  （bundle 由 esbuild 构建）。
- `tsconfig.tests.json` —— 测试源码及其导入的宿主源码。

## 4. 新增或修改宿主操作

1. 把操作写成基于**结构面**的纯函数（参见 `delete-session.ts`）——它只接收所需
   的官方服务，别无其它。官方类型（如 `@deepseek-ai/dsh-session/types` 的
   `SessionId`、`SessionHeader`）仅作 type-only 导入。
2. 一切拒绝都抛 `SessionOpError(code, message, details)`；意外失败折叠为
   `internal`。
3. 在 `rpc.ts` 注册端点（`Endpoints`、分发分支、载荷字段提取）。
4. 添加伪造该服务面的单元测试（涉及文件系统时用临时目录）。

保持与目标版本一致的约束：

- 运行时绝不 require harness core 包——只经宿主 Context（`ctx.get` /
  `inject`）取官方服务；
- 绝不写 workspace 域状态、不越过带护栏的产物删除触碰会话文件；
- wire 载荷保持 lossless-JSON。

## 5. 修改浏览器端

- 运行时模块导入必须限于基线平台词；esbuild 脚本（`scripts/build-client.mjs`）
  把它们列为 `external`，需与 `src/client` 的导入保持同步。脚本以
  `jsx: 'automatic'` 编译 JSX（与源码 `react-jsx` 的 tsconfig 设置一致）——
  切勿改回 transform 模式，否则产物会生成无 React 导入的
  `React.createElement` 调用并导致所有渲染条目崩溃。
- 用 `types.ts` 的**结构面**写类型（客户端 bundle 运行时不得导入完整客户端包）；
  唯一真实 UI 依赖是 `@deepseek-ai/dsh-client-ui-primitives`（基线词）。
- 所有可见文案都在 `locales.ts`；`zh` 与 `en` 一起加键（有测试强制键集一致）。
- 数据派生放纯 `model.ts` 函数，保证无 DOM 可测。

## 6. 代码约定

- 英文注释说明 *why*；公开函数带 JSDoc `@param`/`@throws`。
- `strict` TypeScript，无隐式 any，遵守 `noUncheckedIndexedAccess`。
- 错误用稳定码而非消息（见 `docs/api.en.md`）。
- 无 TODO/占位符、无版本分支、无 monkey patch。

## 7. 发布

1. 提升 `package.json` 的 `version`；在 `CHANGELOG.en.md` /
   `CHANGELOG.zh.md` 添加条目。
2. 运行 `npm run check`。
3. 打 `v<version>` tag 并推送；release 工作流（`.github/workflows/release.yml`）
   在 tag 上跑 CI 并发布 npm。
