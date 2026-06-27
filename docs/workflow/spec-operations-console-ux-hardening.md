---
repo: MCSManager-monitor
project_type: mcsm-web-plugin
qa_mode: browser
last_verified: 2026-06-27
---

# Product Spec: operations-console-ux-hardening

## One-Line Goal

在现有 `ControlConsole`、`GMConsole`、`PlayerInteractionConsole` 和实例管理页面基础上，强化“运维控制、玩家沟通、GM 操作、管理后台”的任务分层，优先降低控制台误操作风险和信息噪声。

## Background

- 当前控制台已经具备目标列表、实时输出、在线玩家、快捷入口和危险操作确认等基础能力。
- `ControlConsole.vue` 体量较大，已经达到 2500 行以上；后续继续堆功能会提高维护成本。
- 外部评审意见建议把后台定位从“终端外壳”升级为“运维 + 客服 + GM 执法”的综合后台。
- 用户最近明确关注控制台目标卡片信息，例如将实例 ID 改成当前玩家人数。

## Goals

- 让控制台目标列表更适合快速判断实例状态、玩家人数、节点归属和异常目标。
- 将危险操作与普通操作视觉和交互上分层，减少误停服、误终止、误批量操作。
- 为后续终端日志过滤、右侧健康摘要、GM 任务化和聊天台分层打基础。
- 在每个 Sprint 中保持小步改动、可验证、可回退。

## Non-Goals

- 不做商业套餐、订单、工单、财务或销售后台。
- 不重写权限系统、数据库结构或生产配置。
- 不把 Control、GM、聊天和管理页一次性重做。
- 不在本轮引入新的前端 UI 框架或大规模状态管理迁移。

## UX Principles

- 运维控制与玩家沟通必须分开：命令输入、聊天发送、私聊入口不能视觉混淆。
- 危险操作必须有二次确认，并明确实例名、节点和影响范围。
- 高频信息优先显示：状态、玩家数、TPS、异常、节点和收藏。
- 低频入口折叠到更多菜单，避免和主操作竞争视觉焦点。
- 现有 Ant Design Vue 风格保持一致，避免一次性换肤。

## Sprint Plan

### Sprint 1: Control Target Cards And Danger Actions

- 优化控制台目标卡片底部信息，优先显示玩家数、节点和状态。
- 将停止、终止、批量 kill 等危险操作与启动、重启分层。
- 统一危险确认文案，确认内容包含目标实例、节点和影响范围。
- 不改变后端 API，不改变实例生命周期行为。

### Sprint 2: Terminal And Health Summary

- 终端日志增加暂停滚动、清屏、复制和关键词过滤。
- 对 WARN / ERROR 做轻量高亮。
- 右侧摘要收敛成健康状态、告警、关键指标和在线玩家入口。
- 支持右侧摘要折叠，改善终端专注空间。

### Sprint 3: GM Task Console

- 强化玩家详情：当前服务器、在线状态、最近聊天、权限/处罚摘要。
- GM 操作表单化：踢出、禁言、封禁、给物品、权限组。
- 处罚类操作原因必填，执行前展示命令预览。
- 操作结果进入审计区域。

### Sprint 4: Player Communication Console

- 聊天按服务器和玩家过滤。
- 明确区分发送聊天、私聊和执行命令。
- 增加快捷短语和重启/维护通知。
- 打通聊天玩家、GM 详情和控制台输出的跳转关系。

## Sprint 1 Acceptance Summary

- `frontend npm.cmd run type-check` 通过。
- `frontend npm.cmd run build-only` 通过。
- 控制台相关 Vitest 通过。
- 手工检查控制台目标卡片、单实例危险操作和批量危险操作。

## Risks

- 控制台页面体量较大，直接重排可能引发移动端和桌面端布局回归。
- 当前仓库已有未提交文档和前端改动，实施时必须只提交本 Sprint 相关文件。
- 危险操作涉及真实实例生命周期，测试必须优先使用预览模式、mock 或人工确认环境。
