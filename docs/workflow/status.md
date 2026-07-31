---
phase: done
current_sprint: gm-chat-economy-write-operations
total_sprints: 1
pending_action: panel-daemon-admin-and-403-smoke-before-deployment
project_type: mcsm-web-plugin
qa_mode: browser-plugin
approval_required: false
last_verified: 2026-07-31
---

# Workflow Status

- 当前阶段：`done`
- 本轮主题：`gm-chat-economy-operations`
- 当前 Sprint：`gm-chat-economy-write-operations`
- 当前 spec：`docs/workflow/spec-gm-chat-economy-operations.md`
- 当前 contract：`docs/workflow/tasks/gm-chat-economy-write-operations-contract.md`
- 已完成：聊天广播/私聊、经济增加/扣除/设置、目标归属、管理员审计、双端 preview 和跨模块构建。
- 已完成：本地 Arclight 1.20.1 / Java 17 中插件实际加载、loopback token、广播/私聊/离线拒绝与 Vault 增扣设置 smoke；测试余额已恢复，测试环境已清理。
- 已完成：三笔主题提交已推送到 `zzrepo/master`，远端与本地 `HEAD` 一致。
- 下一动作：部署前在已配置 MCSManager 的 1.20.1 实例执行 Panel -> Daemon -> 插件管理员 smoke，并以非管理员 session 验证 `403`。
- 已有后端基础：Panel -> Daemon -> loopback 插件控制的结构化聊天 action，以及复用 Vault action 的 `economy_set`。
- 未验证边界：已配置 Panel/Daemon 的真实管理员/非管理员请求、插件 heartbeat/快照、聊天 JSONL 与 Panel 审计的端到端采证。
