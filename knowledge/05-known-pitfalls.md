---
title: Known Pitfalls
type: pitfalls
repo: MCSManager-monitor
last_verified: 2026-04-20
---

# 前端与路由
- 只改 query 不应导致整页重挂载
- 如出现列表或工作台整体闪烁，优先检查 `RouterView` key、组件 `key` 和 `v-if`
- `InstanceWorkspace` 外层不要按实例设置 `key`
- `TerminalCore` 卸载时必须释放 xterm、事件监听、定时器和 socket
- control/GM 页面问题不要只盯视图层，很多状态、重试和错误透传都在 `useControlPanelState.ts`
- control 目标列表不能只依赖用户是否手动切换过 daemon；否则其他在线节点可能长期只剩默认 `Host Shell`

# 监控与网络
- Panel 能连 daemon，不代表浏览器也能直连 daemon 的 `24444/socket.io`
- 如果 panel 是 HTTPS 而 daemon 还是 `ws://`，浏览器可能拦截混合内容
- 远程节点地址不要随意填 `127.0.0.1`，浏览器侧直连时可能被解析成当前面板域名或本机

# control / preview
- `/control` 页面出现“加载节点列表失败”时，不要先假设 daemon 离线；先看 `remote_services_list` 的真实报错是否被吞掉
- standalone preview 默认走 `http://127.0.0.1:5173/index.html#/...`，不要直接用根路径 `/#/...`
- 中量功能如果直接复用正式业务弹窗，可能继续请求真实 API 而在 preview 下报错；需要 preview/live 分流 wrapper

# 构建与工具
- PowerShell 里优先用 `npm.cmd`
- `frontend/dist/` 是构建产物，通常不应进入源码提交
- `frontend` 的 `npm run lint` 会自动改文件
- 某些环境里 `rg` 可能不可用，准备好回退方案

# 类型和字段
- 监控接口字段改动最容易造成前后端字段漂移
- 表格排序不要对格式化后的文本排序
- 用户可见监控文案如果准备发布，记得同步 i18n
- control / GM 相关 UI 或接口改动如果影响共享结构，也要同步检查 `common/global.d.ts` 和 `languages/*.json`
