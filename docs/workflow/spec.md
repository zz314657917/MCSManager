---
repo: MCSManager-monitor
project_type: minecraft-plugin
qa_mode: runtime
last_verified: 2026-06-07
---

# Product Spec

## 一句话需求
- 将官方 `MCSManager/MCSManager` 的 `origin/master` 更新合入当前 fork `zz314657917/MCSManager` 的监控/Control/Operations/MCP 扩展分支，保留本 fork 的既有功能并吸收官方 `v10.13.0` 到 `v10.16.2` 的修复与功能更新。

## 目标与非目标
- 目标：
  - 合入官方 `origin/master` 当前头部 `9ead6bbc`。
  - 保留本地 `master` 上 28 个 fork-only 提交的监控、Control、GM、Operations、MCP、PTY 进程树回收等能力。
  - 明确处理官方 151 个提交带来的冲突和行为重叠。
  - 完成前端、panel、daemon、common、Minecraft 插件、MCP server 的分层验证。
- 非目标：
  - 不把实验性 fork 功能直接推到官方上游。
  - 不重写历史，不使用 `git reset --hard`，不回滚用户已有改动。
  - 不顺手重构官方文件管理、Docker、i18n 或监控架构以外的无关代码。

## 关键约束
- 技术约束：
  - 官方更新重点覆盖 `frontend`、`daemon`、`panel`、`languages`、`common`。
  - fork 重点覆盖监控链路、Control/GM/Operations 页面、MCP server、Minecraft 插件、PTY 进程树。
  - 共享类型变更必须同步检查 `common/global.d.ts`、daemon、panel、frontend。
  - 前端仍需避免 query 变化导致整页重挂载，`InstanceWorkspace` 外层不要按实例设置 `key`。
- 交付约束：
  - 先在独立合并分支执行，不直接污染 `master`。
  - 每个 Sprint 结束都必须有真实命令或明确未验证风险。
  - 合并前先确认 push 目标是 `zzrepo`，不是官方 `origin`。

## 技术方案
- 架构说明：
  - 采用 `master` 合并 `origin/master` 的 merge 策略，保留 fork 历史，不做 rebase。
  - 对重叠文件逐个解决冲突；官方安全/文件/Docker 修复优先保留，fork 监控/Control/MCP/PTY 能力必须回接。
  - 冲突解决后先做构建与单测，再做前端关键页面手动/浏览器验证。
- 关键模块：
  - 高冲突：`common/src/system_storage.ts`、`frontend/src/widgets/InstanceList.vue`、`languages/en_US.json`、`languages/zh_CN.json`。
  - 重叠需人工复核：`common/global.d.ts`、`daemon/src/entity/instance/instance.ts`、`daemon/src/routers/http_router.ts`、`frontend/src/config/router.ts`、`frontend/src/hooks/useTerminal.ts`、`frontend/src/services/apis/index.ts`、`frontend/src/types/index.ts`、`panel/src/app/routers/daemon_router.ts`、`panel/src/app/routers/instance_operate_router.ts`。
  - fork-only 需回归：`mcsm-monitor-plugin/`、`mcsmanager-mcp-server/`、`panel/src/app/routers/monitor_router.ts`、`daemon/src/service/monitor_service.ts`、`frontend/src/widgets/MonitorOverview.vue`、Control/GM/Operations 相关页面。

## Sprint 计划
- Sprint 1：准备合并分支、执行 `origin/master` 合并、解决 Git 冲突，确保源码可解析。
- Sprint 2：做语义集成，重点回接监控、Control/GM/Operations、PTY、MCP，并吸收官方文件管理/Docker/API/i18n 修复。
- Sprint 3：运行分层验证、修复回归、更新必要知识库和最终推送到 `zzrepo`。
