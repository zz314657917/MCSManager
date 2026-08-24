# Fix Log: gm-chat-navigation-merge

## Round 1

- 首轮命令：`npx.cmd playwright test tests/e2e/operations-pages.spec.ts --project=chromium --project=mobile-chromium`
- 结果：`20 passed / 19 skipped / 1 failed`。
- 归因：测试断言错误。`GmServerPlayerSidebar` 的既有选中态类名是 `is-active`，新增状态保持测试误写为 `gm-sidebar__player-card--active`。
- 修复：仅把三处选中态断言改为匹配独立的 `is-active` class；业务路由和页面实现不变。
- 重测：重新执行同一条 Playwright 命令，并继续要求类型检查、生产构建和 diff review 通过。
