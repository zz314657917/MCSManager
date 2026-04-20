---
title: HTTPS Panel With WS Daemon Mixed Content
type: error-note
severity: high
last_verified: 2026-04-15
---

# 现象
panel 使用 HTTPS，但浏览器连 daemon socket 失败。

# 根因
浏览器拦截 `https://` 页面中的 `ws://` 混合内容。

# 修复方向
- 为 daemon 提供 WSS/HTTPS 反代
- 或正确配置远程地址映射，确保浏览器访问链路是安全协议
