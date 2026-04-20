---
title: Frontend Control Console
type: module-note
module: frontend
last_verified: 2026-04-18
---

# 相关文件
- `frontend/src/views/ControlConsole.vue`
- `frontend/src/hooks/useControlPanelState.ts`
- `frontend/src/tools/control.ts`

# target 加载约束
- 控制页首次进入时，先加载当前选中 daemon 的 targets，再后台补齐其他在线 daemon 的 targets。
- 不能把“是否展示实例列表”建立在用户是否手动切换过某个 daemon 之上，否则未切换节点会长期只剩默认 `Host Shell`。
- 用户选中某个 target 时，如果该 target 所属 daemon 还没有完成过 target 加载，需要立即静默补拉一次。

# 刷新与重试
- 当前目标手动刷新成功后，顺手后台补齐其他在线 daemon 的 targets。
- 页面重新可见且触发节点/target 强刷后，也要补齐其他在线 daemon。
- 首次进入控制页的后台补齐允许静默重试一次，用于覆盖偶发超时或短暂抖动。

# 验证
- 这类改动至少运行 `frontend` 的 `vitest` 针对性用例和 `npm.cmd run type-check`。
- 如果改动触及导出、构建路径或共享工具，补跑 `npm.cmd run build-only`。
