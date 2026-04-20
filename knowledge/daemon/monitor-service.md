---
title: Daemon Monitor Service
type: module-note
module: daemon
last_verified: 2026-04-15
---

# 相关文件
- `daemon/src/service/monitor_service.ts`
- `daemon/src/service/host_metrics.ts`
- `daemon/src/service/process_monitor.ts`

# 当前职责
- 缓存插件心跳状态
- 采样实例进程 CPU 和内存
- 维护实例历史曲线数据
- 生成主机快照和服务器快照
- 在实例退出时清理状态并补零历史点

# 当前实现特征
- 插件状态：`pluginStateMap`
- 进程快照：`processSnapshotMap`
- 历史数据：`historyMap`
- 心跳超时：30 秒
- 历史长度：180
- 磁盘缓存 TTL：5 秒

# 修改注意
- 路由层尽量薄，采样和缓存逻辑尽量集中在服务层
- 新增监控字段时优先保证默认值和降级表现
- 采样周期、缓存策略和 history 长度变更要评估前端图表和性能影响
