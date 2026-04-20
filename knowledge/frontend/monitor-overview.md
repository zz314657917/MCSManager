---
title: Frontend Monitor Overview
type: module-note
module: frontend
last_verified: 2026-04-15
---

# 相关文件
- `frontend/src/widgets/MonitorOverview.vue`
- `frontend/src/hooks/useMonitorOverview.ts`
- `frontend/src/services/apis/index.ts`

# 当前职责
- 拉取监控总览数据
- 计算 summary 卡片
- 展示节点和服务器表格
- 提供跳转到实例终端的快捷操作
- 对 CPU、内存、TPS、玩家数、最后心跳时间做格式化

# 当前实现要点
- `useMonitorOverview()` 在挂载时请求一次，并每 5 秒刷新
- 页面将节点数据映射成 `nodeMap`
- 表格排序使用原始数值字段，而不是格式化文本
- 点击操作可跳转到 `/instances/terminal`

# 重点约束
- 排序应基于原始数值字段
- 只改 query 不应触发整页重挂载
- 如表格或工作台闪烁，优先检查 key 和加载态

# 常见改动联动
- 接口字段变更时同时检查 `common/global.d.ts`
- 新增展示项时检查格式化函数和排序函数
- 新增用户可见通用文案时考虑 i18n
