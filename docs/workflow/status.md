---
phase: done
current_sprint: 1
total_sprints: 4
pending_action: prepare-sprint-02-contract
project_type: mcsm-web-plugin
qa_mode: browser
approval_required: true
last_verified: 2026-06-27
---

# Workflow Status

- 当前阶段：`done`
- 本轮默认收口主题：`operations-console-ux-hardening`
- 当前 Sprint：`ux-sprint-01-control-target-danger`
- 当前 spec：`docs/workflow/spec-operations-console-ux-hardening.md`
- 当前 contract：`docs/workflow/tasks/sprint-01-control-target-danger-contract.md`
- 下一合法动作：如继续本主题，进入 Sprint 2 contract 草拟：终端日志过滤、暂停滚动、清屏/复制和健康摘要收敛。
- Sprint 1 验收结论：目标卡片玩家人数展示、危险操作分层、单实例/批量危险确认均已完成；`type-check`、`build-only`、相关 Vitest、Playwright 控制台预览用例通过。
- 最近完成记录：上一轮 `operations-routing-and-daemon-hardening` 已收口到 operations 页面恢复、`process config` 编辑修复、7zip 特殊字符解压修复，以及上游 `MCSManager v10.16.2` 合流后的本地同步。
- 状态推进规则：先 `spec-approved`，再进入当前 Sprint 的 `contract-draft -> contract-approved -> build -> qa -> fix -> retest -> done`。
