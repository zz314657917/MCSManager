---
title: MCSM Monitor Plugin
type: module-note
module: plugin
last_verified: 2026-04-15
---

# 相关文件
- `mcsm-monitor-plugin/README.md`
- `mcsm-monitor-plugin/pom.xml`
- `mcsm-monitor-plugin/src/main/java/com/mcsmanager/monitor/MinecraftMonitorPlugin.java`
- `mcsm-monitor-plugin/src/main/java/com/mcsmanager/monitor/HeartbeatReporter.java`
- `mcsm-monitor-plugin/src/main/java/com/mcsmanager/monitor/TpsMonitor.java`
- `mcsm-monitor-plugin/src/main/resources/config.yml`
- `mcsm-monitor-plugin/src/main/resources/plugin.yml`

# 当前定位
这是一个适用于 Spigot 1.12.2 / Java 8 的轻量监控插件，向同主机上的 MCSManager daemon 上报 TPS、在线人数、世界列表、MOTD 和主线程卡顿状态。

# 关键配置
- `agentUrl`
- `serverId`
- `instanceToken`
- `heartbeatIntervalTicks`
- `logHeartbeatFailures`

# 当前约束
- 兼容 Java 8 和 Spigot 1.12.2
- 不依赖高版本 Paper API
- 不要在异步线程直接调用不安全的 Bukkit API
- 玩家身份优先使用 UUID

# 运维说明
- 可通过 daemon key 获取实例 token
- 修改配置后可执行 `mcsmmonitor reload`
- 打包命令：`mvn package`
- 产物：`target/mcsm-monitor-plugin.jar`
