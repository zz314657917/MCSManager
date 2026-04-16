---
title: Build And Verify
type: build
repo: MCSManager-monitor
last_verified: 2026-04-15
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

# 验证优先级
- 小改动优先运行最小相关验证
- 前端模板、路由、组件注册改动优先 `frontend` 的 `type-check` 和 `build-only`
- 监控接口字段改动至少检查 `common`、`panel`、`daemon`、`frontend`
- 插件改动优先 `mvn package`
- `frontend` 的 `npm run lint` 带 `--fix`，不要把它当只读检查
