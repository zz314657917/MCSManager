---
title: Known Pitfalls
type: pitfalls
repo: MCSManager-monitor
last_verified: 2026-04-15
---

# 前端与路由
- 只改 query 不应导致整页重挂载
- 如出现列表或工作台整体闪烁，优先检查 `RouterView` key、组件 `key` 和 `v-if`
- `InstanceWorkspace` 外层不要按实例设置 `key`
- `TerminalCore` 卸载时必须释放 xterm、事件监听、定时器和 socket

# 监控与网络
- Panel 能连 daemon，不代表浏览器也能直连 daemon 的 `24444/socket.io`
- 如果 panel 是 HTTPS 而 daemon 还是 `ws://`，浏览器可能拦截混合内容
- 远程节点地址不要随意填 `127.0.0.1`，浏览器侧直连时可能被解析成当前面板域名或本机

# 构建与工具
- PowerShell 里优先用 `npm.cmd`
- `frontend/dist/` 是构建产物，通常不应进入源码提交
- `frontend` 的 `npm run lint` 会自动改文件
- 某些环境里 `rg` 可能不可用，准备好回退方案

# 类型和字段
- 监控接口字段改动最容易造成前后端字段漂移
- 表格排序不要对格式化后的文本排序
- 用户可见监控文案如果准备发布，记得同步 i18n
