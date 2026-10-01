---
task_id: echarts-zrender-chunk-runtime-fix
project: frontend-runtime
phase: contract-approved
owner: Codex
qa_mode: browser
---

# Task Contract: ECharts And ZRender Chunk Runtime Fix

## Goal

修复 ECharts 6 生产构建中 `echart` 与 `zrender` 被手动拆分后出现的初始化顺序错误，使监控图表所在页面不再因 `zrender is not a function` 失败。

## Success Criteria

- `echarts` 与所有 `zrender` 模块被归入同一个 Vite manual chunk。
- 生产构建不再生成独立的 `zrender-*.js` chunk，且不报告 ECharts/ZRender 循环 chunk 警告。
- 前端类型检查和生产构建通过；本地生产预览不出现截图中的 ZRender 初始化错误。

## Allowed Paths

- `frontend/vite.config.ts`
- `docs/workflow/**`
- `frontend/dist/**` 仅作为未提交的本地验证产物。

## Denied Paths

- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/src/components/gm/GmServerPlayerSidebar.vue`
- `frontend/src/views/GMConsole.vue`
- `frontend/tests/e2e/operations-pages.spec.ts`
- `frontend/output/**`
- 生产部署、容器、密钥与远程节点配置。

## Constraints

- 保持分包规则的其他依赖边界不变，不升级或删除依赖。
- 不回滚、覆盖或纳入已有未提交改动。
- 生产替换不在本次授权范围内。

## Acceptance Commands

```powershell
cd frontend
npm.cmd run type-check
npm.cmd run build-only
```

随后检查生成的 `dist/assets`，并在本地生产预览中确认浏览器控制台不存在 `zrender is not a function`。

## Stop Rules

- 若修复需要变更依赖版本、图表业务逻辑或生产部署，停止并请求范围裁决。
- 若类型检查或构建失败，先区分本次配置修改与既有环境问题，再决定是否继续。
