---
task_id: echarts-zrender-chunk-runtime-fix
phase: qa
reviewer: Codex
verified_at: 2026-08-14
---

### PASS: echarts-zrender-chunk-runtime-fix

## Evidence

- `cd frontend; npm.cmd run type-check` passed.
- `cd frontend; npm.cmd run build-only` passed after transforming 5,421 modules. The emitted chart dependency bundle was `dist/assets/echarts-BeqbZap8.js`; no `zrender-*.js` asset was emitted and the build did not report an ECharts/ZRender circular chunk warning.
- Local Vite production preview loaded at `http://127.0.0.1:4175/`. Playwright dynamically imported `/assets/echarts-BeqbZap8.js` successfully; the console contained no ZRender or ECharts errors.
- The only two console errors were the expected `/api/auth/status` HTTP 500 and its Axios wrapper because the local Panel backend was intentionally not running.
- `git diff --check` passed for the modified config and workflow files.

## Diff Review

- `frontend/vite.config.ts` now maps both `node_modules/echarts` and `node_modules/zrender` to the single `echarts` manual chunk.
- No dependency versions, chart code, production deployment settings, or pre-existing user changes were modified.

## Residual Risk

- A fully authenticated monitor page was not exercised because no local Panel backend was started. The production chart chunk itself was loaded directly in a browser and completed without the reported initialization error.
