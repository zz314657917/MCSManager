---
title: Knowledge Base
type: index
repo: MCSManager-monitor
last_verified: 2026-04-20
---

# 说明
这是仓库内供 AI 和开发者共用的结构化知识库。目标是让新会话先读索引和固定约束，再按需检索模块说明、错误记录和当前任务，而不是反复翻整仓源码。

# 使用方式
- 新会话优先阅读 `knowledge/00-start-here.md`
- 有监控链路问题时，再读 `knowledge/04-monitor-architecture.md`
- 有 control、GM、operations 或独立预览问题时，优先读 `knowledge/frontend/control-console.md`、`knowledge/frontend/standalone-preview.md` 和相关 `errors/`
- 模块问题优先查对应目录
- 问题解决后，把稳定结论回写到知识库

# 目录
- `00-start-here.md`：AI 入口
- `01-project-map.md`：项目地图
- `02-dev-rules.md`：开发规则
- `03-build-and-verify.md`：构建与验证
- `04-monitor-architecture.md`：监控链路
- `05-known-pitfalls.md`：易踩坑
- `06-deploy-conventions.md`：部署约定
- `07-current-focus.md`：当前关注点
- `frontend/`、`panel/`、`daemon/`、`plugin/`、`mcp/`：模块笔记
- `errors/`：错误与排查记录
- `decisions/`：决策记录
- `tasks/`：当前任务状态

# 当前更常用的入口
- 监控链路：`knowledge/04-monitor-architecture.md`
- control / GM 页面：`knowledge/frontend/control-console.md`
- standalone preview：`knowledge/frontend/standalone-preview.md`
- 浏览器直连 daemon / mixed content：`knowledge/errors/browser-daemon-direct-connect.md`、`knowledge/errors/mixed-content-wss.md`
- control 节点列表加载失败：`knowledge/errors/control-node-list-load-failure.md`
- 当前进行中的工作：`knowledge/tasks/current-task.md`
