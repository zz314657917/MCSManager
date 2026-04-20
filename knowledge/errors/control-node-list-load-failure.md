---
title: Control Page Node List Load Failure
type: error-note
severity: medium
last_verified: 2026-04-19
---

# 现象
`/control` 页面偶尔弹出“加载节点列表失败”，但节点管理页或其他页面看起来又是正常的。

# 根因
`frontend/src/hooks/useControlPanelState.ts` 在刷新链路里会先调用 `/api/service/remote_services_list`。
旧实现里这里失败后只返回布尔值，后续刷新逻辑又统一弹一次“加载节点列表失败”，把真实错误原因吞掉了。

常见真实原因包括：
- Panel 会话或 token 短暂失效，返回 403
- Panel 后端瞬时 500
- 浏览器到 Panel 的网络瞬断、超时、`failed to fetch`

这个接口是 Panel 直接返回内存中的远程节点列表，并不会因为某个 daemon 离线就必然抛错；daemon 离线通常表现为列表仍返回，但节点 `available=false`。

# 修复方向
- 保留节点列表请求的真实错误文本，不要在后续流程里再次覆盖成通用文案
- 仅对网络类、超时类、5xx 类瞬时错误做一次轻量重试
- 403 一类权限/令牌错误不要盲目重试，应直接暴露真实原因

# 相关位置
- `frontend/src/hooks/useControlPanelState.ts`
- `frontend/src/tools/control.ts`
