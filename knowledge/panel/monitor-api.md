---
title: Panel Monitor API
type: module-note
module: panel
last_verified: 2026-04-15
---

# 相关文件
- `panel/src/app/routers/monitor_router.ts`

# 当前职责
- 提供 `/monitor/servers`
- 要求 `ROLE.ADMIN` 权限
- 遍历 `RemoteServiceSubsystem.services`
- 调用各 daemon 的 `monitor/overview`
- 汇总为 `summary`、`nodes`、`servers`

# 当前行为
- 单个远程节点请求失败时，不中断整个聚合流程
- `nodes` 保留节点级信息
- `servers` 把节点信息扁平合并进服务器记录中

# 修改注意
- 聚合结构变更要同步前端和共享类型
- 权限边界不要被新功能绕过
- 远程节点不可用时应保持降级行为可预期
