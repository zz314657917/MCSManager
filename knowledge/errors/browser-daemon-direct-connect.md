---
title: Browser Cannot Directly Reach Daemon
type: error-note
severity: high
last_verified: 2026-04-15
---

# 现象
panel 后端显示远程节点在线，但浏览器相关功能仍异常。

# 根因
panel 能连 daemon，不代表浏览器能直连 daemon 的 `24444/socket.io`。

# 排查
- 检查浏览器网络请求目标地址
- 检查远程节点配置中的 IP、端口和 prefix
- 检查是否存在反向代理或跨域限制

# 修复方向
- 明确区分 panel -> daemon 和 browser -> daemon 两条链路
- 如浏览器需要直连，确认目标地址对客户端真实可达
