---
phase: done
current_sprint: gm-chat-navigation-merge
total_sprints: 3
pending_action: user-authorized-deployment-only
project_type: mcsm-web-plugin
qa_mode: browser
approval_required: false
last_verified: 2026-08-24
---

# Workflow Status

- 当前阶段：`done`
- 本轮主题：`gm-chat-navigation-merge`
- 当前 Sprint：`gm-chat-navigation-merge`
- 当前 contract：`docs/workflow/tasks/gm-chat-navigation-merge-contract.md`
- 用户已批准方向：合并 `/gm` 与 `/gm/chat` 的顶级入口和页面生命周期，保留“玩家操作 / 聊天”内部工作区。
- 当前边界：只改前端路由、GM 页面、operations 移动导航、定向 E2E 与必要 workflow/知识说明。
- Contract review：`docs/workflow/gm-chat-navigation-merge-review.md`，结论 `PASS`。
- 已完成实现：主导航合并、旧 URL 兼容、query 内部切换、移动底栏三项等宽和 E2E 覆盖均已落地。
- 首轮 QA：`20 passed / 19 skipped / 1 failed`；唯一失败归因为测试类名断言错误，修复记录见 `docs/workflow/gm-chat-navigation-merge-fix-log.md`。
- 重测与最终 QA：失败项定向 `1 passed`，完整桌面/移动 operations E2E 为 `21 passed / 19 skipped`；报告见 `docs/workflow/gm-chat-navigation-merge-qa.md`。
- 最终裁决：`PASS`。类型检查、生产构建、CLI 实际交互、定向 E2E 与 `git diff --check` 均通过。
- 当前交付：精确范围提交并推送到 `zzrepo/master`；生产前端替换仍需另行授权。
- 保护项：不覆盖现有 GM 侧栏搜索、聊天全宽布局、ECharts/ZRender 修复和验证产物。
- 历史待办不变：真实已配置 Panel/Daemon 的管理员与非管理员端到端 smoke 仍待部署前执行。
