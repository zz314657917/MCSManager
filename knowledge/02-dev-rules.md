---
title: Dev Rules
type: rules
repo: MCSManager-monitor
last_verified: 2026-04-15
---

# 通用规则
- 先读相关模块，再做修改，不做无关重构
- 不回滚用户已有改动
- 不提交构建产物，除非任务明确要求
- 不硬编码密钥、token、私有地址或生产凭据
- 涉及数据库、认证、权限、生产部署或大规模目录调整时，先确认影响范围

# 本仓库专属规则
- 修改监控接口时，优先同步 `common/global.d.ts` 中的 `IMcsmMonitor*` 类型
- 修改前端监控页时，检查 `MonitorOverview.vue`、`useMonitorOverview.ts`、`services/apis/index.ts`
- 修改监控聚合时，检查 `monitor_router.ts` 和 daemon 侧 `monitor_service.ts`
- 修改插件上报时，检查插件配置、心跳结构、daemon 接收逻辑和面板展示字段
- 前端多语言发布型文案优先走 `languages/*.json`

# 前端规则
- 只改 route query 不应触发整页重挂载
- `InstanceWorkspace` 外层不要按实例设置 `key`
- 只允许 `TerminalCore` 按 `daemonId:instanceUuid` 重建
- 表格排序使用原始数值字段，不要对带单位的展示文本排序

# 插件规则
- Java 8，Spigot/Bukkit 1.12.2
- 不要在异步线程直接调用 Bukkit API
- 玩家身份优先使用 UUID
- 配置变更必须兼容旧配置缺失字段并提供默认值
- 外部插件如 PlaceholderAPI、Vault、MythicMobs、GermEngine 要支持未安装时降级

# 解耦与单一职责
- `JavaPlugin` 入口类只负责生命周期协调，不承载复杂业务
- 监听器、命令处理器、定时任务类主要负责接入、校验和调度，核心业务下沉到服务层
- Panel 路由负责权限和聚合，不堆积重复的数据加工逻辑
- Daemon 采样、缓存、历史记录和主机指标职责尽量集中在服务层，不散落到路由层
- 前端页面组件负责展示和交互，字段解释、接口封装和格式化逻辑尽量放到 hook 或工具层
- 外部插件调用和第三方系统适配集中在 hook、adapter、integration 层
- 避免滥用静态全局状态、跨模块共享 Map 和到处传递主实例

# 设计判断原则
- 一个类如果同时负责接收事件、业务计算、持久化和第三方调用，通常职责过多
- 一个改动如果必须同时改很多看似无关的文件，优先检查是否模块边界不清晰
- 能从 Bukkit API 中抽离的纯业务逻辑，优先抽离，便于测试和复用
