# 测试说明

目标版本：dsh-v0.1.2-alpha.5。

## 1. 运行测试

```bash
npm test            # vitest（Node 环境）
npm run test:watch  # 监听模式
npm run check       # 全量门禁：lint + typecheck + build + tests
```

无需真实 DSH 宿主或浏览器：宿主操作运行在伪造的官方服务面 + 真实临时目录之上；
浏览器数据逻辑为纯函数，在 Node 下运行。

## 2. 测试套件

### `tests/host/operations.spec.ts` —— 宿主操作与护栏

| 领域 | 用例 |
| --- | --- |
| `assertSessionId` | 接受 harness 风格 id；以 `bad-request` 拒绝空值/非字符串/分隔符/`.`/`..`/`~`/超长值 |
| `removeSessionArtifact` | 对合法形态删除所属目录；无 location 时为空操作；拒绝非 `jsonl` 种类、目录与 id 不符、异常产物名、非绝对路径——拒绝时不删任何文件 |
| `deleteSession` | 拒绝 live 会话（`agent-busy`）且不触碰记账；拒绝 agent 保留的空闲会话并带 `reason: 'idle'` 诊断；拒绝运行中会话并点名 running 状态；未知会话 `session-not-found`；删除产物目录**并**仅对成员工作区解除记账；无产物可删时仍解除记账；非 jsonl 后端 `service-unavailable`；非法 id 在任何服务调用前即 `bad-request` |
| `renameSession` | 经官方 controller 成功（trim 标题）；映射 `session/title-invalid`；controller 未挂载时给出清晰失败；拒绝空/非字符串标题 |
| 通道处理器 | 业务失败按标准信封包装（`{ok:false, error:{code,message,details}}`）；未知端点 → `bad-request`；通道名稳定为 `/dsh-sess` |

删除测试真实操作文件系统（产物目录建于 `os.tmpdir()`，每个用例后清理），验证护栏
在真实路径上的通过/拒绝。

### `tests/client/model.spec.ts` —— 浏览器数据逻辑

| 领域 | 用例 |
| --- | --- |
| locale 字典 | `zh` 与 `en` 键集完全一致；无空文案、无占位符 |
| `deriveSessionRows` | 派生标题/工作区标题/归档/空白/运行标志；跳过子 agent（`parentId`/`origin`）；回退 id；最新在前排序 |
| `archivedRows` | 只保留归档行并按投影序 |
| `groupByWorkspace` | 按工作区分组，未分组在最后、组名按字母序；组内保持行序 |
| `relativeTime` | 基于 Intl 的秒/分钟/小时/天紧凑时间与「现在」 |

## 3. 覆盖指引

纯模块（session-id 校验、产物护栏、删除/重命名语义、行投影、文案）是行为核心，
被刻意保持无依赖以便快速、确定地测试。UI 渲染本身很薄：行来自被测投影，操作来自
被测 RPC/宿主路径，文案来自被测字典。新增行为应在同一变更中带上对应单测。
