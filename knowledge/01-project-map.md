---
title: Project Map
type: project-map
repo: MCSManager-monitor
last_verified: 2026-04-15
---

# 主要模块
- `frontend/`：控制台前端、监控页面、实例工作台
- `panel/`：用户、权限、远程节点聚合、对前端提供 API
- `daemon/`：实例进程、文件、终端、Docker、主机指标、监控采集
- `common/`：共享全局类型和协议
- `languages/`：i18n 文案
- `mcsm-monitor-plugin/`：Minecraft 侧监控插件
- `mcsmanager-mcp-server/`：通过 panel API 操作实例的 MCP server
- `prod-scripts/linux/`：Linux 部署脚本

# 监控功能关键文件
- `frontend/src/widgets/MonitorOverview.vue`
- `frontend/src/hooks/useMonitorOverview.ts`
- `frontend/src/services/apis/index.ts`
- `panel/src/app/routers/monitor_router.ts`
- `daemon/src/service/monitor_service.ts`
- `daemon/src/service/host_metrics.ts`
- `common/global.d.ts`
- `mcsm-monitor-plugin/src/main/java/com/mcsmanager/monitor/MinecraftMonitorPlugin.java`
- `mcsm-monitor-plugin/src/main/java/com/mcsmanager/monitor/HeartbeatReporter.java`
- `mcsm-monitor-plugin/src/main/java/com/mcsmanager/monitor/TpsMonitor.java`
- `mcsm-monitor-plugin/src/main/resources/config.yml`
- `mcsm-monitor-plugin/src/main/resources/plugin.yml`

# 前端关键位置
- 路由：`frontend/src/config/router.ts`
- 卡片注册和默认布局：`frontend/src/config/index.ts`
- 根视图：`frontend/src/App.vue`
- 实例列表：`frontend/src/widgets/InstanceList.vue`
- 实例工作台：`frontend/src/widgets/instance/InstanceWorkspace.vue`
- 终端核心：`frontend/src/components/TerminalCore.vue`

# 后端关键位置
- Panel 路由：`panel/src/app/routers/`
- Daemon 服务：`daemon/src/service/`
- 监控聚合入口：`panel/src/app/routers/monitor_router.ts`
- 监控采样逻辑：`daemon/src/service/monitor_service.ts`

# 插件关键位置
- Maven 配置：`mcsm-monitor-plugin/pom.xml`
- 插件说明：`mcsm-monitor-plugin/README.md`
- 资源配置：`mcsm-monitor-plugin/src/main/resources/`
- 构建产物：`mcsm-monitor-plugin/target/mcsm-monitor-plugin.jar`

# MCP 关键位置
- 目录：`mcsmanager-mcp-server/`
- 构建命令：`npm.cmd run build`
- 测试命令：`npm.cmd test`

# 高风险区域
- `common/global.d.ts`：共享类型漂移会同时影响前后端
- `frontend/src/App.vue`、`InstanceWorkspace.vue`、`TerminalCore.vue`：容易引入整页重挂载或终端闪烁
- `daemon/src/service/monitor_service.ts`：心跳缓存、历史采样、进程指标和磁盘缓存集中在这里
- `panel/src/app/routers/monitor_router.ts`：聚合多个远程节点数据，改动会影响整个监控页
- `mcsm-monitor-plugin/`：Java 8、Spigot 1.12.2 兼容要求严格
