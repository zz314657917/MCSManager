---
project: gm-chat-economy-operations
qa_mode: browser-plugin
status: implemented
---

# GM Chat And Economy Operations

## Goal

让 GM 聊天页能够向当前实例广播或向当前快照中的在线玩家私聊；让经济中心能够对明确归属实例的玩家查询、增加、扣除和设置默认余额。

## Scope

- Panel、Daemon 与插件之间只传递结构化聊天和经济 action。
- 聊天写入现有聊天 JSONL，Panel 记录管理员审计。
- 经济写入复用既有 GM action 审计与 Vault 适配，不新增任意控制台命令。
- 前端 live 与本地 preview 都提供相同的操作模型、禁用态、确认和错误反馈。

## Non-goals

- 不支持离线玩家私聊。
- 不把 Vault 默认余额操作扩展成任意第三方多货币写入。
- 不修改生产配置、权限等级、数据库 schema 或部署脚本。

## Acceptance

- 仅 `ROLE.ADMIN` 可调用聊天发送与经济写接口。
- 私聊玩家必须在当前实例 GM 快照中在线；消息去空白且最多 500 字符。
- 经济 action 保持单 `daemonId + instanceId + playerUuid` 目标，设置余额也保留 before/after 与审计。
- 前端预览覆盖广播、私聊、经济增加/扣除/设置、取消确认和失败/禁用路径。
