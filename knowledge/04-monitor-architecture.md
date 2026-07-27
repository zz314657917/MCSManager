---
title: Monitor Architecture
type: architecture
repo: MCSManager-monitor
last_verified: 2026-06-10
---

# 当前定位

这份文档仍以监控链路为核心，但接手本仓库时不能再把它理解成完整仓库架构。`MCSManager-monitor` 现在是 `monitor + control + operations + daemon/runtime hardening + MCP` 的组合仓库；监控 v1 只是其中一条稳定基础链路。

# 监控 v1 目标

不依赖 Prometheus/Grafana，通过 panel 聚合各 daemon 当前状态，并展示 Minecraft 实例、进程和主机的核心监控数据。

# 数据流

1. Minecraft 服务器安装 `mcsm-monitor-plugin`
2. 插件向本机 daemon 上报心跳
3. daemon 聚合插件心跳、进程指标和主机指标
4. panel 调用各远程节点的 `monitor/overview`
5. panel 对所有节点结果做统一聚合
6. frontend 通过 `/api/monitor/servers` 展示总览

# 当前组合仓库视角

- 监控链路仍是基础层，但最近默认接手面已同时包括：
  - control / operations 前端入口与独立预览
  - daemon 文件编辑、压缩解压和 process config 路径
  - Linux PTY/runtime 进程树探测、异常回收和实例状态同步
  - MCP server 对 panel API 的安全边界
- 因此这里记录监控架构时，也要明确它与这些边界的关系，而不是把仓库剩余部分当作无关旁支。

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

# 近期同样高频的非监控关键文件

- operations / control 页面：
  - `frontend/src/views/ControlConsole.vue`
  - `frontend/src/views/GMConsole.vue`
  - `frontend/src/views/PlayerInteractionConsole.vue`
  - `frontend/tests/e2e/operations-pages.spec.ts`
- daemon/runtime hardening：
  - `daemon/src/service/process_tree.ts`
  - `daemon/src/entity/commands/pty/pty_start.ts`
  - `daemon/src/common/compress.ts`
  - `daemon/src/service/system_file.ts`
- MCP 边界：
  - `mcsmanager-mcp-server/`

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

# daemon 当前额外承担的稳定职责

- `process_tree.ts` 负责 Linux `/proc` 读取、僵尸进程识别、进程树构建与子树 kill，这已经不只是监控辅助，而是实例运行态和 PTY 健康检查的基础设施。
- `pty_start.ts` 通过 `GoPtyProcessAdapter` 把 `rootPid/childPid`、健康检查、异常退出和树级回收整合到实例进程生命周期。
- `system_file.ts` 与 `compress.ts` 已成为 daemon 文件管理链路的稳定入口；涉及特殊字符路径、解压、编辑或 process config 时，不能把它们视为与监控无关的次要模块。

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

# frontend 当前额外承担的稳定职责

- `ControlConsole.vue`、`GMConsole.vue`、`PlayerInteractionConsole.vue` 已进入默认产品面，不能再视为纯实验页。
- `frontend/tests/e2e/operations-pages.spec.ts` 说明 operations/control 独立预览、目标切换和命令流已进入稳定验证面。
- 路由或页面注册调整时，要同时考虑桌面端、移动端和独立预览入口，不要只看 monitor 总览页。

# MCP 边界

- `mcsmanager-mcp-server` 只访问 panel API，不直连 daemon。
- 这条边界很重要，因为仓库现在不只是“把监控渲染出来”，还承担外部自动化查询和受控操作入口。

# 改动联动规则

- 改一个监控字段时，默认检查插件、daemon、panel、frontend、common 五处
- 改响应结构时，先改 `common/global.d.ts`
- 改展示排序时，优先使用原始数字字段
- 如果变更触达 control / operations、PTY/runtime、文件编辑或解压链路，应把它们视为同一仓库默认验证面的一部分，而不是只补 monitor service 单点检查

# 当前不该误判的点

- 不要再把本仓库理解成“旧 monitor 页面扩展仓库”；最近稳定主线已覆盖 control / operations、daemon/runtime hardening 和 upstream 合流。
- 不要把 `process_tree.ts` 只当成测试辅助工具；它直接影响实例运行态、终端健康检查和异常回收。
- 不要把 `compress.ts` / `system_file.ts` 当作边缘工具；它们已经进入用户可见的文件管理与 process config 编辑链路。
- 不要因为 `knowledge/04-monitor-architecture.md` 讨论的是监控，就忽略 `mcsmanager-mcp-server` 的 panel-only 边界；当前仓库的外部自动化入口已经是默认组成部分。
