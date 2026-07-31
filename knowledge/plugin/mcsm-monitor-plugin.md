---
title: MCSM Monitor Plugin
type: module-note
module: plugin
last_verified: 2026-07-31
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
这是一个适用于 Spigot / Paper / Arclight 1.20.1 / Java 17 的轻量监控插件，向同主机上的 MCSManager daemon 上报 TPS、在线人数、世界列表、MOTD 和主线程卡顿状态。

# 关键配置
- `agentUrl`
- `serverId`
- `instanceToken`
- `heartbeatIntervalTicks`
- `logHeartbeatFailures`

# 当前约束
- 兼容 Java 17 和 Spigot 1.20.1
- 不依赖 Paper 专有 API，也不使用 NMS 或 CraftBukkit 版本包
- 不要在异步线程直接调用不安全的 Bukkit API
- 玩家身份优先使用 UUID

# 运维说明
- 可通过 daemon key 获取实例 token
- 修改配置后可执行 `mcsmmonitor reload`
- 打包命令：`mvn package`
- 产物：`target/mcsm-monitor-plugin.jar`

# 运行时验证
- 2026-07-31 已在本地 Arclight 1.20.1 / Java 17 测试单元实际加载 `0.2.0-SNAPSHOT`，插件启动 loopback 控制端点且 Vault 经济适配可用。
- 控制端点必须配置 token：未携带 token 的 health 请求返回 `401`；带 token 后广播、向在线玩家私聊均能被 1.20.1 自动化客户端接收，向离线玩家私聊返回 `409`。
- Vault 的 `balance`、`add`、`take`、`set` 已做实际调用并将测试玩家余额恢复；该结论只覆盖插件控制层，不替代 Panel -> Daemon 的管理员会话、快照与审计端到端验证。
