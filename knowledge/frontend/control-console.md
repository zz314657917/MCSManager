---
title: Frontend Control Console
type: module-note
module: frontend
last_verified: 2026-05-21
---

# 相关文件
- `frontend/src/views/ControlConsole.vue`
- `frontend/src/hooks/useControlPanelState.ts`
- `frontend/src/tools/control.ts`

# target 加载约束
- 控制页首次进入时，先加载当前选中 daemon 的 targets，再后台补齐其他在线 daemon 的 targets。
- 不能把“是否展示实例列表”建立在用户是否手动切换过某个 daemon 之上，否则未切换节点会长期只剩默认 `Host Shell`。
- 用户选中某个 target 时，如果该 target 所属 daemon 还没有完成过 target 加载，需要立即静默补拉一次。

# 批量实例操作
- 控制页支持管理员在目标列表中勾选多个 `mode === "instance"` 的 target，然后在操作区执行批量启动、停止、重启或终止。
- 批量操作复用实例列表已有的 `batchStart`、`batchStop`、`batchRestart`、`batchKill` 接口；后端仍走 `/api/instance/multi_*` 管理员权限，不新增后端路由。
- `Host Shell` / `global0001` 不参与批量选择；非管理员不显示批量选择入口，且前端执行层也会忽略批量操作。
- 批量操作确认弹窗应固定执行用户确认时的实例集合，避免弹窗打开后选择状态变化影响最终执行对象。

# 刷新与重试
- 当前目标手动刷新成功后，顺手后台补齐其他在线 daemon 的 targets。
- 页面重新可见且触发节点/target 强刷后，也要补齐其他在线 daemon。
- 首次进入控制页的后台补齐允许静默重试一次，用于覆盖偶发超时或短暂抖动。

# 终端日志链路
- `/control` 页内终端不是 `TerminalCore` 的实时 xterm；它通过 `/api/protected_instance/outputlog` 拉取 daemon 侧 `data/InstanceLog/<uuid>.log` 快照。
- 普通实例终端页走 `stream_channel + socket.io` 实时订阅 `instance/stdout`，两者刷新语义不同；排查 control 页日志延迟时要先看 daemon 日志缓冲落盘和前端轮询。
- daemon 侧 `instance_event_router.ts` 先收到实时输出，再每 500ms 追加到日志文件；命令发送后前端需要覆盖这个落盘延迟做强制快照刷新。

# 验证
- 这类改动至少运行 `frontend` 的 `vitest` 针对性用例和 `npm.cmd run type-check`。
- 如果改动触及导出、构建路径或共享工具，补跑 `npm.cmd run build-only`。
