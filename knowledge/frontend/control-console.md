---
title: Frontend Control Console
type: module-note
module: frontend
last_verified: 2026-08-24
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
- `normalizeControlOutputLog` 负责把 ANSI 光标定位、清屏和 alternate screen 转成当前可读快照，供 `top`、`htop` 等全屏程序展示；光标参数必须限制上限，避免异常输出拖垮浏览器。
- `/control` 仍只发送整行命令，不等同于完整交互式 xterm；页面提供 `q` 和 `Ctrl+C` 恢复入口，复杂交互继续使用“高级终端”。

# 验证
- 这类改动至少运行 `frontend` 的 `vitest` 针对性用例和 `npm.cmd run type-check`。
- 如果改动触及导出、构建路径或共享工具，补跑 `npm.cmd run build-only`。

# 运维页面入口
- `/control` 是主控制台，包含实例管理、日志终端和批量操作入口。
- `/gm` 是唯一的 GM 管理主入口，页面内通过 `view=chat` query 切换“玩家操作 / 聊天”工作区；只改 query 不会触发根 `RouterView` 按 path 重建，因此当前实例、玩家选择和 GM 轮询状态可以保留。
- `/gm/chat` 只作为旧链接兼容入口，必须重定向到 `/gm?view=chat` 并保留 `preview` 等既有 query 与 hash；不要重新把它注册为 `mainMenu`。
- operations 移动底栏只保留 Control、GM 玩家和经济中心三个顶级入口；聊天入口放在 GM 页面内部，三个底栏入口应等宽填满。
- `/players` 是独立玩家互动预览页，挂载 `PlayerInteractionConsole.vue`，不应再重定向到 `/gm`。
