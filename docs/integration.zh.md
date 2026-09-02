# Profile Bundle 与 Cordis 集成

本文说明 dsh-sess 如何仅用官方机制（bundle、profile、patch、Cordis 插件注册表、
客户端 slot 体系）挂载进 DeepSeek Harness（dsh-v0.1.2-alpha.5）。

## 1. 词汇

- **Bundle** —— 携带配置层的 npm 包：其 manifest 声明 `dsh.bundle.patch`，
  指向一个插入或覆盖插件行的 patch 文件。Bundle 是作者分发的最小单元。
- **Profile** —— `$DSH_HOME/profiles/<name>` 下的目录，描述一个可运行组合；
  manifest 声明 `dsh.profile.bundles`。用户用 `dsh --profile <name>`（或
  `dsh web`）启动它。
- **Patch** —— 应用到空根（`cordis.yml`）之上的 loader patch YAML 列表。
  `- insert:` 追加行；带 id 的 patch 覆盖行的 `config`/`disabled`/… 字段。
  分层按序应用：`dsh.profile.bundles` 中每个 bundle、profile 的
  `cordis.patch.yml`、home 级 patch、`--patch` overlay；后层胜出。

## 2. dsh-sess 贡献的内容

`package.json` 声明：

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

`cordis.patch.yml` 插入一行：

```yaml
- insert:
    - id: dsh-sess
      name: 'dsh-sess'
```

profile 组合时，该行按已安装的包解析：**宿主端**是包 main（`lib/index.js`），
作为 Cordis 插件加载；**浏览器端**（`client/client.js`，导出为 `./client`）由
客户端模块系统物化并在页面内 apply。两个半区都导出 Cordis 插件形态
（`name`、`inject`、`apply`）。

## 3. 安装到 profile

profile 由 `dsh plugin` 命令维护——不要手写：

```bash
# 缺省时初始化、pnpm add、并追加到 dsh.profile.bundles
dsh plugin --profile web add dsh-sess
```

`dsh plugin` 把参数转发给 profile 目录内的 pnpm，随后对账
`dsh.profile.bundles`：manifest 声明了 `dsh.bundle` 的依赖进入层栈；无 bundle
的依赖保持不动。

之后重启 Web UI。声明所需服务（`connection`、`webServer`、`sessions`、
`sessionPersistence`、`workspaceRegistry`）到齐后，宿主行即激活——Cordis 会先
让插件保持 PENDING——浏览器端加载、设置外壳声明 `settings.section` slot 后，
设置页出现 **会话管理** 分区。

## 4. 浏览器端对 profile 的要求

web 组合需已挂载（官方 `@deepseek-ai/dsh-web-app` profile 全部满足）：

- 上文列出的宿主服务（base + web-app bundle）；
- 管理器读取的客户端服务：`sessions`、`workspaces`、`connection`、`locale`、
  `slots`（api-session-controller / api-workspace-controller 客户端半区、
  client-connection、client-locale、ui-renderer）；
- 声明并渲染 `settings.section` 的设置外壳（ui-settings /
  ui-settings-general）——管理器页面借此出现；
- bundle 运行时所需的基线模块表词
  （`react`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-ui-primitives`）。

自定义 profile 若缺某项，对应能力降级：无设置外壳则不渲染分区；必需服务永不出现
则宿主行保持 pending。

## 5. 升级与故障排查

| 现象 | 原因 / 处理 |
| --- | --- |
| 设置里没有「会话管理」 | 安装后未重启 Web UI；或解析到旧版本——重跑 `dsh plugin --profile web add dsh-sess`（或 `pnpm update dsh-sess`）让 lockfile 指向新版本后重启。 |
| 删除总提示「服务不可用」 | 该 profile 未挂载某项必需官方服务（stock web 少见）。检查 profile bundles。 |
| 重命名总提示「服务不可用」 | 未挂载 `@deepseek-ai/dsh-api-session-controller`（重命名是可选降级项）。 |
| 宿主加载失败：`failed to import loader entry dsh-sess` | profile 内无法解析该包（依赖未装 / 构建产物缺失）。Git/目录安装先在检出目录执行 `npm ci && npm run build`。 |
| 删除后 UI 未即时更新 | 侧边栏在下一次投影刷新后收敛，DSH 重启后完全稳定（搜索/sqlite 索引按持久化产物自动对账）。 |

## 6. 用到的 Cordis 契约

- 插件形态：`export const name`、`export const inject`、`export function apply(ctx)`。
- `inject` 列出所需服务；激活按服务门控（行间无顺序假设）。
- `ctx.effect(cb)` 把副作用（含 disposer）绑定到插件 fiber。
- `ctx.get(name)` 不经 inject 门读取服务（用于可选的 session controller）。
- 嵌套可用性同理：客户端半区等待其注入的客户端服务，并在
  `ctx.slots.inject('settings.section', …)` 下注册设置分区——注册跟随 slot 的
  声明生命周期。

## 7. 发布

`npm publish` 会执行 `prepack`（`npm run build`），因此 tarball 总是携带新鲜的
`lib/` 与 `client/` 产物。包面向 npm 公共 registry；lockfile 用 npm 维护。CI
（`.github/workflows/ci.yml`）在每个 push/PR 上跑 lint、typecheck、test 与
build；版本 tag 触发发布工作流。
