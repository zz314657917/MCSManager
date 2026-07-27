---
title: Start Here
type: index
repo: MCSManager-monitor
last_verified: 2026-06-07
---

# 一句话说明
这是 `MCSManager-monitor` 仓库的 AI 入口文件。当前默认应把仓库理解为 `monitor + control + operations + daemon/runtime hardening + MCP` 的组合仓库，而不只是旧监控页面扩展。

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

# 当前默认接手面
- 监控链路仍是基础层，但最近活跃主线已经不只在监控。
- control / operations 前端入口目前至少包括：
  - `frontend/src/views/ControlConsole.vue`
  - `frontend/src/views/GMConsole.vue`
  - `frontend/src/views/PlayerInteractionConsole.vue`
  - `frontend/src/config/router.ts`
- daemon/runtime hardening 近期重点包括：
  - `daemon/src/common/compress.ts`
  - `daemon/src/service/system_file.ts`
  - `daemon/src/service/process_tree.ts`
  - `daemon/src/entity/commands/pty/pty_start.ts`
- MCP server 仍保持“只访问 panel API，不直连 daemon”的边界：`mcsmanager-mcp-server/`

# 当前核心约束
- 监控 v1 不依赖 Prometheus/Grafana
- 面板通过 `/api/monitor/servers` 聚合当前状态
- Minecraft 侧插件向本机 daemon 上报心跳
- 修改监控字段时，要同步检查 daemon、panel、frontend、common
- 修改用户可见行为时，检查是否需要同步 README、配置示例和说明文档
- 前端 operations / control 页面存在桌面端、移动端和独立预览入口；改路由或页面注册时要一起检查导航和 e2e。
- daemon 侧近期已补特殊字符 7zip 解压和 process config 编辑修复；后续改文件操作或解压链路时，不要只看 monitor 相关目录。
- 上游 MCSManager `v10.16.2` 已合入；继续改公共模块前先确认是本地扩展逻辑，还是应跟随后续 upstream 兼容面。

# 修改前先确认
- 是前端展示问题、Panel 聚合问题、Daemon 采集问题，还是 Minecraft 插件上报问题
- 是否涉及共享类型 `IMcsmMonitor*`
- 是否会影响浏览器直连 daemon、WSS/HTTPS、远程节点地址映射
- 是否同时影响 control / operations 路由、移动导航或独立预览页
- 是否落在 daemon 文件操作、解压、实例 process config 或 PTY/runtime 回收链路

<!-- codex:pge-workflow:start -->
## Planner / Generator / Evaluator Workflow

- 本仓库的交付流程产物位于 `docs/workflow/`。
- 默认 Agent Matrix：`docs/workflow/agent-matrix.md`；命中 `P/G/E`、`Agent Matrix`、`worker` 或 `测试 worker` 时按矩阵分工执行。
- 当前阶段阅读顺序：`docs/workflow/status.md` -> `docs/workflow/agent-matrix.md` -> `docs/workflow/spec.md` -> 当前 Sprint 的 contract/review/qa/fix-log。
- 会话暂停、续做或换人接手时，仍优先更新 `knowledge/tasks/current-task.md` 作为事实源；阶段完成或需要保留最近重点时追加 `knowledge/tasks/timeline.md`。
- 小型一次性修改可显式绕过该流程；多 Sprint 或需要验收门禁的任务默认启用。
<!-- codex:pge-workflow:end -->
