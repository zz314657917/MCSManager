---
title: Current Focus
type: status
repo: MCSManager-monitor
last_verified: 2026-06-07
---

# 当前默认关注点

- 继续把仓库视为“monitor + control + operations + daemon/runtime hardening + MCP”的组合仓库，而不是只看旧 monitor 页面。
- Daemon 侧 PTY 进程树探测、Linux 子进程回收和运行态同步仍然是稳定基础；后续涉及实例启动/停止/终端时仍要优先检查这条链路。
- 近 3 天的高频变更已经同时覆盖 operations 路由恢复、process config 编辑修复、7zip 特殊字符解压修复，以及上游 `MCSManager v10.16.2` 合流后的同步面。
- 修改监控字段或实例运行态结构时，继续同步 `common/global.d.ts`、daemon、panel 和 frontend，避免状态漂移。
- 前端仍要避免 query 变化导致整页重挂载；control/preview 路线继续优先走最小重建。
- MCP server 继续保持“只访问 panel API，不直连 daemon”的边界。

# 当前仓库事实

- 当前仓库近期主线已不是单一监控功能推进，而是“监控基础 + control/operations 入口修正 + daemon 文件/解压/runtime 修复 + upstream 合流”并行。
- `daemon/src/service/process_tree.ts` 现在集中封装 `/proc` 读取、僵尸进程识别、进程树构建和 Linux 子树 kill 逻辑。
- `daemon/src/entity/commands/pty/pty_start.ts` 已把 PTY 健康检查、`rootPid/childPid` 运行态、异常时树级回收整合进 `GoPtyProcessAdapter`。
- `frontend/src/config/router.ts`、`frontend/src/views/PlayerInteractionConsole.vue` 与 `frontend/tests/e2e/operations-pages.spec.ts` 已再次成为近期活跃入口，说明 operations 页面可达性和独立预览现在是默认验证面的一部分。
- `daemon/src/common/compress.ts` 与 `daemon/src/service/system_file.ts` 最近直接修过特殊字符 7zip 解压和 process config 编辑，后续涉及文件操作时要把它们当成当前稳定入口，而不是只盯 monitor service。
- 当前仓库没有再保留 `knowledge/tasks/current-task.md`，后续临时任务不要默认重建成分支日志；更适合把稳定结论落到模块笔记、错误页或决策页。

# 接手时先判断问题落在哪

- 监控数据链路：plugin -> daemon -> panel -> frontend
- control / instance 操作：panel router、frontend control 页面、daemon 实例命令
- operations / 玩家互动页：`router.ts`、`PlayerInteractionConsole.vue`、`GMConsole.vue`、`ControlConsole.vue`、`knowledge/frontend/control-console.md`
- PTY / 终端问题：`pty_start.ts`、`process_tree.ts`、实例运行态接口
- 文件编辑 / 解压问题：`system_file.ts`、`compress.ts`
- MCP / AstrBot：`mcsmanager-mcp-server/` 与 panel API 边界

# 记录原则

- 当前关注点只保留稳定方向和高复用边界，不记录分支名、工作树或临时任务状态。
- 新发现的稳定结论优先写到 `knowledge/daemon/`、`knowledge/errors/` 或 `knowledge/decisions/`，不要把实现细节堆回 `AGENTS.md`。
