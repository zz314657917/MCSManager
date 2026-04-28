---
title: Daemon Monitor Service
type: module-note
module: daemon
last_verified: 2026-04-24
---

# 相关文件

- `daemon/src/service/monitor_service.ts`
- `daemon/src/service/host_metrics.ts`
- `daemon/src/service/process_monitor.ts`
- `daemon/src/service/process_tree.ts`
- `daemon/src/entity/commands/pty/pty_start.ts`
- `daemon/src/entity/instance/interface.ts`

# 当前职责

- 缓存插件心跳状态
- 采样实例进程 CPU 与内存
- 维护实例历史曲线数据
- 生成主机快照与服务端快照
- 在实例退出时清理状态并补零历史点

# 当前实现特征

- 插件状态：`pluginStateMap`
- 进程快照：`processSnapshotMap`
- 历史数据：`historyMap`
- 心跳超时：`20` 秒
- 历史长度：`80`
- 磁盘缓存 TTL：`5` 秒

# 新增的 PTY / 进程树约束

- Linux PTY 进程不再只看“外层 PTY 包装进程是否还活着”，而是显式区分：
  - `rootPid`：PTY 包装进程
  - `childPid`：shell 或首层业务子进程
  - `pid`：当前推断出的活跃业务进程
- `process_tree.ts` 负责从 `/proc/*/stat` 读取进程表、构建子树、识别僵尸进程、判断 session 是否还活着，并在需要时整树 kill。
- `pty_start.ts` 的 `GoPtyProcessAdapter` 会周期性调用 `inspectLinuxPtyProcess(...)`；若健康检查失败且外层 PTY 还没退出，会直接触发树级回收并补发 exit。

# 调试建议

- Linux 下遇到“面板显示实例还活着，但业务进程已僵死”时，先查 `process_tree.ts` 与 PTY 健康检查日志，而不是只查 monitor API。
- 如果改了实例运行态接口，注意同步 `IInstanceProcessRuntimeState` 的 `rootPid`、`childPid`、`healthy`、`sessionAlive` 等字段使用方。
- 这块逻辑有独立验证入口：`cd daemon && npm.cmd run test:process-tree`。
