---
title: Build And Verify
type: build
repo: MCSManager-monitor
last_verified: 2026-04-24
---

# Windows 注意事项

- PowerShell 可能拦截 `npm.ps1`，优先使用 `npm.cmd`
- 某些环境里 `rg` 可能不可用，可回退到 `git grep` 或 `Select-String`

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
- `npm.cmd run test:process-tree`
- `npm.cmd run test:monitor`

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
- 影响 `/control`、`/gm`、`/players` 或独立预览路由时，优先补跑 Playwright 相关用例

# PTY / process-tree 最小验证

- 只改 Linux PTY 进程树探测、回收或实例运行态时，优先跑：
  - `cd daemon`
  - `npm.cmd run test:process-tree`
- 只改 daemon 监控聚合时，再补：
  - `npm.cmd run test:monitor`
- 如同时改了实例启动/停止链路，再补 `npm.cmd run build`，并联动检查 `panel/src/app/routers/instance_operate_router.ts` 与前端相关入口。

# 验证优先级

- 小改动优先运行最小相关验证
- 监控接口字段改动至少检查 `common`、`panel`、`daemon`、`frontend`
- 插件改动优先 `mvn package`
- `frontend` 的 `npm run lint` 带 `--fix`，不要把它当只读检查
