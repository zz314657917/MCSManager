---
title: Build And Verify
type: build
repo: MCSManager-monitor
last_verified: 2026-06-10
---

# Windows 注意事项

- PowerShell 可能拦截 `npm.ps1`，优先使用 `npm.cmd`
- 某些环境里 `rg` 可能不可用，可回退到 `git grep` 或 `Select-String`
- `frontend` 的 `npm run lint` 带 `--fix`，不要把它当只读检查

# 根目录常用命令

- `npm.cmd run install-dependents`
- `npm.cmd run dev`
- `npm.cmd run frontend`
- `npm.cmd run panel`
- `npm.cmd run daemon`

# frontend

- `cd frontend`
- `npm.cmd run type-check`
- `npm.cmd run build-only`
- `npm.cmd run build`
- `npx vitest run src/tools/control.test.ts`
- `npx vitest run src/tools/controlFeatureModal.test.ts src/tools/controlFeaturePreview.test.ts`
- `npm.cmd run test:e2e`

# operations / control / preview 相关最小验证

- 影响 `frontend/src/views/ControlConsole.vue`、`frontend/src/views/GMConsole.vue`、`frontend/src/views/PlayerInteractionConsole.vue`、`frontend/src/config/router.ts` 或移动导航时，优先检查：
  - `cd frontend`
  - `npm.cmd run type-check`
  - `npm.cmd run build-only`
- 如果变更触达 operations 独立预览、路由可达性、控制台切换、GM 页面或玩家互动页，再补：
  - `npx playwright test tests/e2e/operations-pages.spec.ts`
- 如果只改控制台工具函数、preview 数据或前端纯状态逻辑，可优先跑对应 `vitest`，不必默认放大全量 e2e。

# panel

- `cd panel`
- `npm.cmd run build`

# daemon

- `cd daemon`
- `npm.cmd run build`
- `npm.cmd run test:process-tree`
- `npm.cmd run test:monitor`

# daemon 文件链路 / runtime hardening 最小验证

- 影响 `daemon/src/service/process_tree.ts`、`daemon/src/entity/commands/pty/pty_start.ts`、实例运行态同步或 Linux 子进程回收时，优先跑：
  - `cd daemon`
  - `npm.cmd run test:process-tree`
  - `npm.cmd run build`
- 影响 `daemon/src/common/compress.ts`、`daemon/src/service/system_file.ts`、压缩解压、特殊字符路径或 process config 编辑时，优先跑：
  - `cd daemon`
  - `npm.cmd run build`
  - 如改动包含监控或运行态联动，再补 `npm.cmd run test:process-tree`
- 影响监控聚合、主机指标或 `monitor_service` 时，再补：
  - `cd daemon`
  - `npm.cmd run test:monitor`

# common

- `cd common`
- `npm.cmd run build`

# mcsm-monitor-plugin

- `cd mcsm-monitor-plugin`
- `mvn package`

# mcsmanager-mcp-server

- `cd mcsmanager-mcp-server`
- `npm.cmd run build`
- `npm.cmd test`

# frontend 验证分层

- 类型和模板改动：先跑 `npm.cmd run type-check`
- 影响构建、路由、组件注册或产物路径：补跑 `npm.cmd run build-only`
- 只改控制台工具函数、preview 分流或纯前端状态逻辑时，优先跑对应 `vitest`
- 影响 `/control`、`/gm`、`/players` 或独立预览路由时，优先补跑 `frontend/tests/e2e/operations-pages.spec.ts`

# PTY / process-tree 最小验证

- 只改 Linux PTY 进程树探测、回收或实例运行态时，优先跑：
  - `cd daemon`
  - `npm.cmd run test:process-tree`
- 只改 daemon 监控聚合时，再补：
  - `npm.cmd run test:monitor`
- 如同时改了实例启动/停止链路，再补 `npm.cmd run build`，并联动检查 `panel/src/app/routers/instance_operate_router.ts` 与前端相关入口。

# 当前默认验收面

- 当前仓库默认验收已不是纯 monitor v1。
- 最近更稳定的最小验收组合至少覆盖：
  - operations / control 页面可达性与主要交互
  - daemon 文件编辑、解压压缩或 process config 路径
  - PTY/runtime 进程树、实例状态同步和异常回收
  - 如果改动碰到监控字段，再加 plugin -> daemon -> panel -> frontend 的旧监控链路检查
- 上游 `MCSManager v10.16.2` 合流后，改公共模块时应优先做最小相关验证，不要只看本地扩展目录。

# 验证优先级

- 小改动优先运行最小相关验证
- 监控接口字段改动至少检查 `common`、`panel`、`daemon`、`frontend`
- 插件改动优先 `mvn package`
- 如果改动影响用户可见 control / operations 路由，尽量补一次页面手动回读，避免只靠编译通过判断
