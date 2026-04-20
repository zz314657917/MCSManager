---
title: Frontend Standalone Preview
type: module-note
module: frontend
last_verified: 2026-04-17
---

# 入口脚本
- 仓库根目录 `open-h5-preview.bat`
- 中文快捷入口 `打开H5预览.bat`
- 中文快捷入口现在会把命令行参数透传给底层脚本

# 预览地址
- 默认打开 `http://127.0.0.1:5173/index.html#/control`
- 不要直接使用 `http://127.0.0.1:5173/#/control`，当前配置下根路径 `/` 会返回 404
- 支持传入预览路由参数：
  - `open-h5-preview.bat control`
  - `open-h5-preview.bat gm`
  - `open-h5-preview.bat gm-chat`
  - `open-h5-preview.bat players`
  - 也支持直接传 `gm/chat` 这类原始 hash 路由片段

# 行为说明
- 该快捷入口只启动 `frontend` 的 Vite dev server
- `/#/control`、`/#/gm`、`/#/gm/chat`、`/#/players` 属于独立预览路由
- 当前端检测到后端不可用时，会在这些路由上自动切换到本地 preview 数据，不要求 panel/daemon 在线
- `/control` 页面里的轻量功能可以直接复用已有弹窗，但中量功能如果直接嵌入正式业务页，通常会因为继续请求真实 API 而在 standalone preview 下报错
- 当前已为 `/control` 的“服务端配置”“计划任务”大弹窗补了本地 preview wrapper；后续若继续给 `/control` 增加中量功能弹窗，优先沿用同样的 preview/live 分流方式
