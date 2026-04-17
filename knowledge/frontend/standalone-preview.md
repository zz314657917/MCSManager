---
title: Frontend Standalone Preview
type: module-note
module: frontend
last_verified: 2026-04-17
---

# 入口脚本
- 仓库根目录 `open-h5-preview.bat`
- 中文快捷入口 `打开H5预览.bat`

# 预览地址
- 默认打开 `http://127.0.0.1:5173/index.html#/control`
- 不要直接使用 `http://127.0.0.1:5173/#/control`，当前配置下根路径 `/` 会返回 404

# 行为说明
- 该快捷入口只启动 `frontend` 的 Vite dev server
- `/#/control`、`/#/gm`、`/#/gm/chat`、`/#/players` 属于独立预览路由
- 当前端检测到后端不可用时，会在这些路由上自动切换到本地 preview 数据，不要求 panel/daemon 在线
