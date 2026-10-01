---
task_id: echarts-zrender-chunk-runtime-fix
phase: contract-approved
reviewer: Codex
reviewed_at: 2026-08-14
---

### PASS: echarts-zrender-chunk-runtime-fix contract review

## Findings

- 现有 `manualChunks` 将 `echarts` 与 `zrender` 分到两个静态产物，而已安装的 ECharts 6.1.0 依赖其内部的 ZRender 6.1.0；这与报告的生产运行时错误一致。
- 将两类模块映射到同一个 `echarts` chunk 可保持依赖初始化顺序，且不会触及图表业务代码或依赖版本。

## Acceptance Readiness

- `vue-tsc` 与 Vite production build 覆盖配置解析及产物生成。
- 本地 production preview 的浏览器控制台检查覆盖所报告的运行时异常。

## Decision

Contract approved. Proceed to build.
