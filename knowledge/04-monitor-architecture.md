---
title: Monitor Architecture
type: architecture
repo: MCSManager-monitor
last_verified: 2026-04-15
---

# 监控 v1 目标
不依赖 Prometheus/Grafana，通过 panel 聚合各 daemon 当前状态，并展示 Minecraft 实例、进程和主机的核心监控数据。

# 数据流
1. Minecraft 服务器安装 `mcsm-monitor-plugin`
2. 插件向本机 daemon 上报心跳
3. daemon 聚合插件心跳、进程指标和主机指标
4. panel 调用各远程节点的 `monitor/overview`
5. panel 对所有节点结果做统一聚合
6. frontend 通过 `/api/monitor/servers` 展示总览

# 关键接口
- 插件心跳：`/v1/plugin/heartbeat`
- 插件 token 获取：`/v1/plugin/token/<serverId>?apikey=<daemonKey>`
- daemon 对 panel 的监控概览：`monitor/overview`
- panel 对 frontend 的聚合接口：`/api/monitor/servers`

# 关键文件
- 插件：`mcsm-monitor-plugin/`
- daemon：`daemon/src/service/monitor_service.ts`
- daemon 主机磁盘：`daemon/src/service/host_metrics.ts`
- panel 聚合：`panel/src/app/routers/monitor_router.ts`
- frontend 页面：`frontend/src/widgets/MonitorOverview.vue`
- frontend hook：`frontend/src/hooks/useMonitorOverview.ts`
- 共享类型：`common/global.d.ts`

# 已知监控字段
- 主机：CPU、内存、磁盘、hostname、platform、loadavg
- 进程：pid、cpuPercent、memoryBytes、memoryPercent
- 插件：online、lastSeen、heartbeatAgeMs、pluginVersion、serverVersion、motd、worlds、mainThreadBlocked、TPS、在线人数
- 概览汇总：节点总数、在线节点、实例总数、运行实例、插件在线数

# daemon 侧职责
- 接收插件心跳
- 采样进程运行时指标
- 维护实例历史数据
- 缓存磁盘信息
- 生成节点和服务器级监控快照

# panel 侧职责
- 遍历远程节点
- 捕获远程节点不可用情况
- 把节点级和服务器级数据扁平化为统一响应
- 输出 `summary`、`nodes`、`servers` 三部分结构

# frontend 侧职责
- 拉取 `/api/monitor/servers`
- 展示 summary 卡片和服务器表格
- 对 CPU、内存、TPS、玩家数、心跳时间做格式化
- 提供跳转到实例终端的快捷入口

# 改动联动规则
- 改一个监控字段时，默认检查插件、daemon、panel、frontend、common 五处
- 改响应结构时，先改 `common/global.d.ts`
- 改展示排序时，优先使用原始数字字段
