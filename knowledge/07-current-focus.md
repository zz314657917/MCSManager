---
title: Current Focus
type: status
repo: MCSManager-monitor
last_verified: 2026-04-15
---

# 当前默认关注点
- 保持监控 v1 链路稳定：插件上报 -> daemon 聚合 -> panel 汇总 -> frontend 展示
- 修改监控字段时避免 `common/global.d.ts` 漏同步
- 修改前端交互时避免实例页和监控页出现不必要的重挂载与闪烁
- 保持 Java 8 / Spigot 1.12.2 兼容
- 保持 MCP server 只访问 panel API，不直连 daemon

# 当前会话开始时建议先确认
- 本次问题属于 frontend、panel、daemon、plugin 还是 MCP
- 是否涉及监控字段新增、删除或重命名
- 是否涉及部署脚本、远程节点地址或浏览器直连限制
- 是否需要同步 README、配置说明或知识库

# 当前任务记录位置
- 进行中的问题写到 `knowledge/tasks/current-task.md`
- 新发现的稳定结论回写到 `knowledge/errors/`、`knowledge/decisions/` 或模块笔记
