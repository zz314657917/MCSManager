### PASS: gm-chat-navigation-merge

# Contract Review

## Scope Review

- `Task ID`、`Role`、`Goal`、`Success Criteria`、`Allowed Paths`、`Denied Paths`、`Constraints`、`Acceptance Commands`、`Output` 与 `Stop Rules` 均已具备。
- 路由、UI 和 E2E 范围足以完成入口合并；无需触达 Panel、Daemon、插件、API 或权限模型。
- 已将实际 Playwright 项目名修正为 `mobile-chromium`，Windows 命令使用 `npx.cmd`。

## Risk Review

- 最大回归风险是旧 `/gm/chat` 丢失 `preview` query、切换模式重建 `GMConsole`，以及移动端失去聊天入口；contract 已逐项设置成功标准和浏览器验收。
- 当前未提交的 `GmServerPlayerSidebar.vue`、聊天全宽 CSS 与 E2E 增量被明确列为保护项，不得回滚。
- 管理员权限和危险操作确认保持原路径，未出现权限扩大或后端改动需求。

## Decision

Contract 边界清晰、命令可执行、验收覆盖正常路径与失败/权限保护边界，批准进入实现。

## Approved Amendment

- 实现前确认移动底栏由四项缩减为三项时必须同步调整固定列数，因此批准将 `frontend/src/components/operations/OperationsMobileNav.vue` 加入 Allowed Paths；该补充只用于移除未使用的聊天图标映射并让剩余入口等宽填满。
