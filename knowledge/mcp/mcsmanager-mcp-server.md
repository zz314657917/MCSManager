---
title: MCSManager MCP Server
type: module-note
module: mcp
last_verified: 2026-04-15
---

# 相关文件
- `mcsmanager-mcp-server/`

# 当前定位
这是独立的 Node.js 18+ TypeScript MCP stdio server，供 AstrBot 等上层通过 MCP 协议访问 MCSManager 能力。

# 当前约束
- 只访问 panel API
- 不直连 A/B/C daemon
- 第一版只开放受控查询与启动、停止、重启等安全操作
- 不默认开放任意控制台命令

# 环境变量
- `MCSM_PANEL_BASE_URL`
- `MCSM_API_KEY`
- `MCSM_CONFIRM_TTL_SECONDS`

# 修改注意
- API Key 只放环境变量
- 解析 panel 返回结构时兼容 `{ status, data }` 包装和直接返回数据两种形态
