---
task_id: gm-chat-navigation-merge
project: frontend-operations
phase: contract-approved
owner: Codex
qa_mode: browser
---

# Task Contract: GM Chat Navigation Merge

## Role

Codex 同时承担本次小型 Sprint 的 Planner、Generator 与 Final Evaluator；不调用外部 worker。

## Goal

将当前重复占用主导航的 `/gm` 玩家管理页与 `/gm/chat` 聊天页合并为一个 GM 管理入口，在同一个 `GMConsole` 生命周期内切换“玩家操作 / 聊天”内部工作区，并保留旧聊天 URL 的兼容访问。

## Success Criteria

- 主菜单只显示一个“GM 管理”入口，不再把“聊天”作为独立顶级菜单。
- `/gm` 使用 query 表达内部工作区；玩家操作与聊天切换时保留当前实例、玩家选择及 GM 状态，不因 path 变化重建页面。
- 旧 `/gm/chat` 自动重定向到 `/gm?view=chat`，同时保留 `preview` 等既有 query 和 hash。
- 桌面端和移动端都提供清晰的“玩家操作 / 聊天”内部切换；玩家操作模式不重复展示聊天面板，聊天模式保持现有全宽布局。
- 移动端 operations 底栏移除独立聊天项后，其余三个入口继续等宽填满，不留下空白列。
- `ROLE.ADMIN` 权限、危险操作确认、错误态、Panel/Daemon/API 与插件边界均保持不变。
- 前端类型检查、生产构建和 operations 定向 Playwright 验收通过。

## Allowed Paths

- `frontend/src/config/router.ts`
- `frontend/src/views/GMConsole.vue`
- `frontend/src/components/operations/mobileNav.ts`
- `frontend/src/components/operations/OperationsMobileNav.vue`
- `frontend/tests/e2e/operations-pages.spec.ts`
- `knowledge/frontend/control-console.md`
- `knowledge/tasks/current-task.md`
- `docs/workflow/**`

## Denied Paths

- `frontend/src/hooks/useGmConsoleState.ts`
- `frontend/src/hooks/useGmConsolePreviewState.ts`
- `frontend/src/components/gm/GmServerPlayerSidebar.vue`
- `frontend/src/components/gm/GmOperationsPanel.vue`
- `frontend/src/services/**`
- `panel/**`
- `daemon/**`
- `common/**`
- `mcsm-monitor-plugin/**`
- `frontend/vite.config.ts`
- `frontend/output/**`
- 生产部署、容器、密钥、远程节点和权限模型。

## Constraints

- 保留并兼容工作区中已经存在的 GM 聊天全宽布局、侧栏双搜索与对应 E2E 改动，不覆盖或回滚这些未提交修改。
- 只使用路由 query 切换内部工作区；不得修改根 `RouterView` 的 `$route.path` key 约定。
- `/players` 继续作为独立玩家互动页，不重定向、不合并到 GM 管理。
- 不新增后端接口，不放宽管理员权限，不改变聊天广播/私聊或 GM 写操作语义。
- 不提交构建产物，也不清理现有 `frontend/output/`、`.playwright-cli/` 等用户文件。

## Acceptance Commands

```powershell
cd frontend
npm.cmd run type-check
npm.cmd run build-only
npx.cmd playwright test tests/e2e/operations-pages.spec.ts --project=chromium --project=mobile-chromium
```

定向浏览器验收还必须覆盖：旧 URL 重定向、主导航去重、桌面/移动内部切换、选中玩家在切换后仍保留、聊天发送正常、危险 GM 操作确认与错误提示仍通过。

## Output

- 合并后的 GM 前端路由和页面交互。
- 更新后的 operations E2E。
- `docs/workflow/gm-chat-navigation-merge-review.md`。
- `docs/workflow/gm-chat-navigation-merge-qa.md`。
- 完成后的 `docs/workflow/status.md` 与必要知识说明。

## Stop Rules

- 若实现需要修改权限、API、Panel、Daemon、插件或生产部署，停止并请求范围裁决。
- 若无法在不覆盖现有未提交 GM 改动的情况下完成，停止并报告重叠点。
- 若旧 `/gm/chat` 无法保留 query/hash 或 query 切换仍触发 GM 状态重建，contract 不得通过验收。
- 若类型检查、构建或定向浏览器验收失败，先归因并修复；证据不足不得标记 PASS。
