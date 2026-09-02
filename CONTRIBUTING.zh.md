# 参与 dsh-sess 开发

感谢帮助！dsh-sess 是 DeepSeek Harness（dsh-v0.1.2-alpha.5）的独立插件，质量门槛
是刻意设高的：必须严格停留在官方 API 之上，绝不依赖 harness 内部实现。

## 基本规则

1. **仅官方 API。** 新行为必须建立在公开的 DSH 服务、端点、bundle、patch、Cordis
   与客户端 slot 之上。不改 harness 源码、不用私有 API、不做 monkey patch、不做
   DOM hack、不做版本分支。
2. **行为诚实。** 保持文档化边界（仅冷会话删除、不支持取消归档、隐藏子 agent 会话、
   孤儿归档标记）。若官方 API 无法安全表达某项能力，请如实写进文档而不是绕过。
3. **每个改动带测试。** 宿主操作用伪造服务面做单测；浏览器逻辑放进可单测的纯模块。
4. **文案双语。** 每条可见文案同时在 `zh` 与 `en` 中且键一致
   （`src/client/locales.ts`）。

## 流程

1. Fork 仓库并新建功能分支。
2. 实施改动，遵循[开发指南](docs/development.zh.md)。
3. 本地跑全量门禁：

   ```bash
   npm ci
   npm run check
   ```

4. 更新 `CHANGELOG.en.md` / `CHANGELOG.zh.md`。
5. 提交 PR：说明改动内容、为何在官方 API 上安全、由哪些测试覆盖。

## 报告问题

请包含：DSH 版本（应为 `dsh-v0.1.2-alpha.5`）、profile 名称与 bundles、插件版本、
复现步骤与相关日志。凡能证明边界被破坏或有数据丢失风险的问题，优先处理。
