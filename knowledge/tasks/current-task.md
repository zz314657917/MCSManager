---
title: Current Task
type: task
status: doing
last_verified: 2026-04-20
---

# 当前目标
把仓库知识入口从“监控 v1 基线”补到当前真实状态，重点同步 control/GM/operations/standalone preview 相关结论，并让后续会话能快速定位当前工作树主题。

# 现象
- `knowledge/07-current-focus.md`、`knowledge/03-build-and-verify.md`、`knowledge/01-project-map.md`、`knowledge/05-known-pitfalls.md` 仍主要描述监控链路
- 仓库最近提交已经新增桌面端实例终端、玩家管理、control/GM 顶部导航、独立预览入口与相关测试
- 当前工作树仍有一批 `frontend` control/GM/preview 改动，但 `knowledge/tasks/current-task.md` 之前还是空模板

# 已确认事实
- 2026-04-16 提交已补入 `GMConsole`、`PlayerInteractionConsole`、`operations` 移动端布局和知识库基础结构
- 2026-04-17 提交已新增桌面端实例终端与玩家管理界面，并同步了 `common/global.d.ts`、`daemon/src/service/gm_service.ts`、`panel/src/app/routers/gm_router.ts`
- 2026-04-18 提交已新增 control/operations 顶部导航，并补写了 [`knowledge/frontend/control-console.md`](F:/mcplugins/MCSManager-monitor/knowledge/frontend/control-console.md)
- 当前已有 [`knowledge/frontend/standalone-preview.md`](F:/mcplugins/MCSManager-monitor/knowledge/frontend/standalone-preview.md) 和 [`knowledge/errors/control-node-list-load-failure.md`](F:/mcplugins/MCSManager-monitor/knowledge/errors/control-node-list-load-failure.md)，但总入口尚未同步
- 当前分支是 `codex/mcsm-monitor-deploy`，远端仍保持 `origin` 官方仓库、`zzrepo` 用户仓库的双远端约定

# 怀疑点
- 如果总入口不补写，后续会话仍会把仓库误判为“主要只做监控页”
- 如果不把当前工作树主题写入任务文件，后续很难区分“已提交的 control/GM 结论”和“仍在进行中的 preview/control 调整”

# 已尝试
- 已巡检最近提交、当前工作树和 `knowledge/` 现状
- 已确认优先补写对象是 `07-current-focus.md`、`03-build-and-verify.md`、`01-project-map.md`、`05-known-pitfalls.md` 和本文件

# 下一步
1. 先补齐知识库总入口，让 control/GM/preview 主题进入 `current-focus`、`project-map` 和 `pitfalls`
2. 把 frontend 的 `vitest`、Playwright preview/e2e 验证路径补入 `build-and-verify`
3. 后续若当前工作树继续收敛出稳定结论，再补写对应模块笔记或错误记录，而不是继续堆在本文件
