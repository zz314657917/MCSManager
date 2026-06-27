### DONE: ux-sprint-01-control-target-danger

# Worker Result

## Task ID
ux-sprint-01-control-target-danger

## Status
`done`

## Summary
- 控制台实例目标卡片已显示在线人数和最大人数，缺失时显示 `人数 --`，全局 Host Shell 仍显示原身份信息。
- 控制台普通操作与危险操作已视觉分组；批量启动/重启与批量停止/终止已分层。
- 停止、重启、终止和批量操作确认弹窗已展示目标、所属节点、操作类型和影响范围；停止/终止类弹窗带风险提示。

## Changed Files
- `frontend/src/types/control.ts`
- `frontend/src/hooks/useControlPanelState.ts`
- `frontend/src/components/control/ControlTargetSelector.vue`
- `frontend/src/components/control/ControlActionButtons.vue`
- `frontend/src/views/ControlConsole.vue`
- `docs/workflow/status.md`
- `docs/workflow/main-log.md`
- `docs/workflow/spec-operations-console-ux-hardening.md`
- `docs/workflow/tasks/sprint-01-control-target-danger-contract.md`

## Commands Run
```text
git diff --check -- <sprint files> -> passed
cd frontend; npm.cmd run type-check -> passed
cd frontend; npm.cmd run build-only -> passed
cd frontend; npx.cmd vitest run src/tools/control.test.ts src/tools/controlFeatureModal.test.ts src/tools/controlFeaturePreview.test.ts -> passed, 15 tests
cd frontend; npx.cmd playwright test tests/e2e/operations-pages.spec.ts -g "control desktop preview" --project=chromium -> passed, 5 tests
```

## Test Output
```text
vue-tsc --noEmit --skipLibCheck -p tsconfig.vitest.json --composite false -> exit 0
vite build -> built in 24.22s
Vitest -> Test Files 3 passed, Tests 15 passed
Playwright -> 5 passed (19.4s)
```

## Risks
- Playwright 预览期间 Vite 输出 `/api/auth/status`、`/socket.io` 等代理 `ECONNREFUSED` 日志；这是本地预览无后端服务时的既有噪声，测试结果为 PASS。
- 本轮没有改后端 API、权限模型或实例生命周期逻辑；真实危险操作仍需在人工测试环境中避免误点生产实例。

## Knowledge Candidates
- 控制台 `Modal.confirm` 的动态 VNode 内容不在组件 scoped 样式作用域内；需要用 `:global(...)` 写弹窗内容类名样式。

## Contract Compliance
- allowed_paths_only: `yes`
- denied_paths_touched: `no`
- success_criteria_met: `yes`
- stop_rules_triggered: `no`

## Blocked Reason
- 无。
