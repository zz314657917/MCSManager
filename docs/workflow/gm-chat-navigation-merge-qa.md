### PASS: gm-chat-navigation-merge

# QA Report

## Changed Scope

- `frontend/src/config/router.ts`
- `frontend/src/views/GMConsole.vue`
- `frontend/src/components/operations/mobileNav.ts`
- `frontend/src/components/operations/OperationsMobileNav.vue`
- `frontend/tests/e2e/operations-pages.spec.ts`
- `knowledge/frontend/control-console.md`
- `knowledge/tasks/current-task.md`
- `docs/workflow/**`

工作区中既有的 `GmServerPlayerSidebar.vue`、`frontend/vite.config.ts`、`knowledge/05-known-pitfalls.md`、ECharts workflow 产物及 `frontend/output/` 未被本任务回滚或清理。

## Commands Run

- `npm.cmd run type-check`：PASS；最终实现后复跑仍为 PASS。
- `npm.cmd run build-only`：PASS；仅有仓库既有的 Ant Design PURE 注释、图标动态导入和大 chunk 警告。
- Playwright CLI 独立会话：PASS；顶部导航只有“GM 管理”，选择“爱马仕”后切换聊天，URL 为 `/gm?preview=1&view=chat`，私聊目标仍为“爱马仕”。本地无后端预览的 `/socket.io` 404 与本改动无关。
- 首轮 operations E2E：`20 passed / 19 skipped / 1 failed`；唯一失败为新增测试误写既有选中态 class，归因与修复见 `docs/workflow/gm-chat-navigation-merge-fix-log.md`。
- 失败项定向重测：`1 passed`。
- 最终 operations E2E：`21 passed / 19 skipped`。
- `git diff --check`：PASS。
- 额外 `prettier --check`：非 contract gate，报告 5 个既有风格文件与格式器输出不完全一致；为避免整文件重排现有未提交 GM 改动，未执行 `--write`。

## Acceptance Findings

- 正常路径：主导航去重、玩家选择、玩家操作、经济写预览、聊天广播/私聊、桌面/移动内部切换、旧 URL 重定向和 query 保留均通过。
- 失败/保护路径：危险扣款确认、GM 错误提示、离线目标状态及 `/players` 独立入口回归均通过。
- Contract compliance：未修改 denied paths，未扩大权限，未触达后端或生产部署。

## Remaining Risks

- 真实已配置 Panel/Daemon 的管理员与非管理员会话 smoke 仍是历史部署前验收项；本次纯前端合并没有重新声称该链路已验证。
- 生产前端替换、容器重建和远程部署均未执行。
