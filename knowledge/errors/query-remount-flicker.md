---
title: Query Change Causes Page Remount Flicker
type: error-note
severity: medium
last_verified: 2026-04-15
---

# 现象
只改 route query，列表或工作台整体闪烁、重新请求或终端重建。

# 排查重点
- `frontend/src/App.vue` 中 `RouterView` 的 key
- 相关组件是否错误使用实例级 `key`
- 是否通过 `v-if` 让整个页面卸载重建

# 修复方向
- 只允许真正需要重建的组件重建
- `InstanceWorkspace` 外层不要按实例设置 `key`
- `TerminalCore` 只按 `daemonId:instanceUuid` 重建
