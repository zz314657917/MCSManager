---
title: Start Here
type: index
repo: MCSManager-monitor
last_verified: 2026-04-15
---

# 一句话说明
这是 `MCSManager-monitor` 仓库的 AI 入口文件。新会话先读这里，再按顺序读项目地图、开发规则、构建验证和当前关注点。

# 推荐阅读顺序
1. `knowledge/01-project-map.md`
2. `knowledge/02-dev-rules.md`
3. `knowledge/03-build-and-verify.md`
4. `knowledge/04-monitor-architecture.md`
5. `knowledge/05-known-pitfalls.md`
6. `knowledge/07-current-focus.md`

# 仓库概览
这是一个基于 MCSManager 的多模块仓库，主要包含：
- `frontend/`：Vue 3 + Vite + Ant Design Vue 前端
- `panel/`：Web Panel 后端
- `daemon/`：Daemon 后端
- `common/`：前后端共享类型
- `languages/`：多语言文案
- `mcsm-monitor-plugin/`：Minecraft 监控插件，Java 8，Spigot 1.12.2
- `mcsmanager-mcp-server/`：MCSManager MCP stdio server，Node.js 18+

# 当前监控链路
- Minecraft 插件：`mcsm-monitor-plugin/`
- Daemon 指标采集：`daemon/src/service/monitor_service.ts`
- Daemon 主机指标：`daemon/src/service/host_metrics.ts`
- Panel 聚合接口：`panel/src/app/routers/monitor_router.ts`
- 前端监控页面：`frontend/src/widgets/MonitorOverview.vue`
- 前端接口封装：`frontend/src/hooks/useMonitorOverview.ts`
- 共享类型：`common/global.d.ts`

# 当前核心约束
- 监控 v1 不依赖 Prometheus/Grafana
- 面板通过 `/api/monitor/servers` 聚合当前状态
- Minecraft 侧插件向本机 daemon 上报心跳
- 修改监控字段时，要同步检查 daemon、panel、frontend、common
- 修改用户可见行为时，检查是否需要同步 README、配置示例和说明文档

# 修改前先确认
- 是前端展示问题、Panel 聚合问题、Daemon 采集问题，还是 Minecraft 插件上报问题
- 是否涉及共享类型 `IMcsmMonitor*`
- 是否会影响浏览器直连 daemon、WSS/HTTPS、远程节点地址映射
