---
task_id: ux-sprint-01-control-target-danger
project: operations-console-ux-hardening
phase: contract-draft
owner: Generator Worker
qa_mode: browser
last_verified: 2026-06-27
---

# Task Contract: ux-sprint-01-control-target-danger

## Role

你是 P/G/E 流程里的 Generator worker。只执行本 contract，不做架构裁决，不扩大范围。

## Goal

优化控制台目标选择与危险操作体验：让实例目标卡片优先展示运维高频信息，并将停止、终止、批量 kill 等危险操作从普通操作中更清晰地区分出来。

## Success Criteria

- 控制台实例目标卡片底部不再优先显示无助于扫描的实例 ID；实例目标应显示玩家人数，缺失数据时显示明确占位。
- 全局主机 Shell 目标不显示无意义玩家人数，仍保留身份标识或主机类信息。
- 停止、终止、批量 kill 等危险操作在视觉层级、确认弹窗和文案上与启动/重启区分。
- 危险确认内容必须包含目标实例名、节点名和影响范围；批量操作必须列出主要目标并提示剩余数量。
- 不改变后端 API、不改变实例生命周期调用顺序、不新增数据库或生产配置。

## Context

- Repo: `F:/mcplugins/MCSManager-monitor`
- Read first:
  - `docs/workflow/spec-operations-console-ux-hardening.md`
  - `docs/workflow/status.md`
  - `docs/workflow/agent-matrix.md`
- Related files:
  - `frontend/src/views/ControlConsole.vue`
  - `frontend/src/components/control/ControlTargetSelector.vue`
  - `frontend/src/components/control/ControlActionButtons.vue`
  - `frontend/src/hooks/useControlPanelState.ts`
  - `frontend/src/types/control.ts`
  - `frontend/src/tools/control.ts`
  - `frontend/src/tools/controlStatus.ts`
  - `frontend/tests/e2e/operations-pages.spec.ts`

## Allowed Paths

- `frontend/src/views/ControlConsole.vue`
- `frontend/src/components/control/**`
- `frontend/src/hooks/useControlPanelState.ts`
- `frontend/src/types/control.ts`
- `frontend/src/tools/control*.ts`
- `frontend/src/tools/control*.test.ts`
- `frontend/tests/e2e/operations-pages.spec.ts`
- `docs/workflow/worker-results/**`

## Denied Paths

- `daemon/**`
- `panel/**`
- `common/**`
- `mcsm-monitor-plugin/**`
- `mcsmanager-mcp-server/**`
- `languages/**`
- `knowledge/**`
- `C:/Users/Administrator/.codex/memories/**`
- 数据库迁移、生产配置、密钥、部署脚本。

## Constraints

- 保持最小改动；不要顺手重构整个 `ControlConsole.vue`。
- 不回滚用户已有未提交改动。
- 不把控制台、GM、聊天页一次性混改。
- 所有可见文案优先沿用现有 i18n；若本地已有中文直写区域，可局部保持一致，但不得引入大量新硬编码文案。
- 危险操作必须保留原有权限和禁用态判断。
- 移动端抽屉目标选择器不能被桌面端样式修改破坏。

## Acceptance Commands

```powershell
cd frontend
npm.cmd run type-check
npm.cmd run build-only
npx.cmd vitest run src/tools/control.test.ts src/tools/controlFeatureModal.test.ts src/tools/controlFeaturePreview.test.ts
npx.cmd playwright test tests/e2e/operations-pages.spec.ts -g "control desktop preview" --project=chromium
```

如果 Playwright 环境不可用，必须给出原因，并至少提供人工检查项：

- 桌面端控制台目标卡片显示玩家人数。
- 抽屉/移动端目标卡片显示不溢出。
- 停止、终止、批量 kill 弹窗文案包含目标和影响范围。
- 启动/重启仍可直接按原逻辑触发或按原确认逻辑触发。

## Output

- 按 `C:/Users/Administrator/.codex/templates/worker-result.md` 写 worker report。
- Worker report 第一行必须是 `### DONE: ux-sprint-01-control-target-danger`、`### BLOCKED: ux-sprint-01-control-target-danger` 或 `### FAILED: ux-sprint-01-control-target-danger`。
- 必须列出 changed files、commands run、test output、risks、knowledge_candidates。
- 不允许直接写长期知识库；只提交候选结论。

## Stop Rules

- 需要改后端 API、权限模型、数据库、生产配置或 `Denied Paths` 时停止。
- 发现现有未提交改动与本任务冲突且无法安全合并时停止。
- 无法保留危险操作原有权限/禁用态判断时停止。
- 验收命令不可执行时报告 blocked reason，不静默跳过。

## Budget

- worker_mode: `claude-bare-deepseek-v4-pro`
- qa_worker_mode: `claude-bare-deepseek-v4-pro`
- worker_model: `deepseek-v4-pro`
- max_budget_usd: `0.10`
- worktree_root: `E:/codex-worktrees`
