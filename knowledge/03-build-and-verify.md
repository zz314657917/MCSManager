---
title: Build And Verify
type: build
repo: MCSManager-monitor
last_verified: 2026-04-20
---

# Windows 注意事项
- PowerShell 可能拦截 `npm.ps1`，优先使用 `npm.cmd`
- 某些环境中 `rg` 可能无法执行，可回退到 `git grep` 或 `Select-String`

# 根目录常用命令
- `npm.cmd run install-dependents`
- `npm.cmd run dev`
- `npm.cmd run frontend`
- `npm.cmd run panel`
- `npm.cmd run daemon`

# frontend
- `cd frontend`
- `npm.cmd run type-check`
- `npm.cmd run build-only`
- `npm.cmd run build`
- `npx vitest run src/tools/control.test.ts`
- `npx vitest run src/tools/controlFeatureModal.test.ts src/tools/controlFeaturePreview.test.ts`
- `npm.cmd run test:e2e`

# panel
- `cd panel`
- `npm.cmd run build`

# daemon
- `cd daemon`
- `npm.cmd run build`

# common
- `cd common`
- `npm.cmd run build`

# mcsm-monitor-plugin
- `cd mcsm-monitor-plugin`
- `mvn package`

# mcsmanager-mcp-server
- `cd mcsmanager-mcp-server`
- `npm.cmd run build`
- `npm.cmd test`

# frontend 验证分层
- 类型和模板改动：先跑 `npm.cmd run type-check`
- 影响构建、路由、组件注册或产物路径：补跑 `npm.cmd run build-only`
- 只改控制台工具函数、preview 分流或纯前端状态逻辑时，优先跑对应 `vitest`
- 影响 `/control`、`/gm`、`/players` 或独立预览路由时，优先补跑 Playwright 相关用例，例如 `frontend/tests/e2e/operations-pages.spec.ts`
- 若只验证 standalone preview，可先用仓库根目录 `open-h5-preview.bat` 或 `打开H5预览.bat` 打开 `/control`、`/gm`、`/gm/chat`、`/players`

# 验证优先级
- 小改动优先运行最小相关验证
- 前端模板、路由、组件注册改动优先 `frontend` 的 `type-check` 和 `build-only`
- 前端纯工具函数或 preview 逻辑改动，优先跑针对性 `vitest`
- control/GM 页面交互改动，优先补充或复用 Playwright preview/e2e 用例
- 监控接口字段改动至少检查 `common`、`panel`、`daemon`、`frontend`
- 插件改动优先 `mvn package`
- `frontend` 的 `npm run lint` 带 `--fix`，不要把它当只读检查
