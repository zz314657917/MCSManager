---
title: Current Focus
type: status
repo: MCSManager-monitor
last_verified: 2026-04-20
---

# 当前默认关注点
- 保持监控 v1 链路稳定：插件上报 -> daemon 聚合 -> panel 汇总 -> frontend 展示
- 修改监控字段时避免 `common/global.d.ts` 漏同步
- 当前前端重点已扩展到 `control`、`gm`、`operations` 与 standalone preview，不再只是监控页
- 修改前端交互时避免实例页、控制台页和监控页出现不必要的重挂载与闪烁
- 控制台目标加载要兼顾“当前节点立即可用”和“其他在线节点后台补齐”，避免页面长期只剩默认 `Host Shell`
- standalone preview 目前是前端调试和交互验证的重要入口；新增中量功能弹窗时优先考虑 preview/live 分流
- 保持 Java 8 / Spigot 1.12.2 兼容
- 保持 MCP server 只访问 panel API，不直连 daemon

# 当前会话开始时建议先确认
- 本次问题属于 monitor、control、gm、operations、plugin 还是 MCP
- 是否涉及监控字段新增、删除或重命名，或者 control/GM 相关路由与 target 加载
- 是否涉及 standalone preview、本地 preview 数据、弹窗 preview wrapper
- 是否涉及部署脚本、远程节点地址、浏览器直连限制或 mixed content/WSS
- 是否需要同步 README、配置说明或知识库

# 当前工作树里正在发生的主题
- `frontend/src/views/ControlConsole.vue`、`frontend/src/views/GMConsole.vue`、`frontend/src/config/router.ts`、`frontend/src/hooks/useControlPanelState.ts`、`frontend/src/hooks/useControlPreviewState.ts` 仍有未提交改动
- 当前未提交改动集中在 control/GM 页面、preview 行为、顶部导航和相关工具函数，不是单纯监控字段调整
- `knowledge/errors/control-node-list-load-failure.md` 已新增，说明控制页节点列表加载失败已经形成可复用排障结论

# 当前任务记录位置
- 进行中的问题写到 `knowledge/tasks/current-task.md`
- 新发现的稳定结论回写到 `knowledge/errors/`、`knowledge/decisions/` 或模块笔记
