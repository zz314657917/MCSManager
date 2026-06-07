---
sprint: 1
status: draft
qa_mode: runtime
last_verified: 2026-06-07
---

# Sprint 01 Contract

## Sprint 目标
- 创建独立合并分支，将 `origin/master` 合入当前 fork 分支并解决机械冲突，产出可进入语义集成的工作树。

## 范围与非范围
- 范围：
  - `git fetch origin zzrepo --prune`
  - 创建 `codex/merge-upstream-v10.16.2`
  - 执行 `git merge origin/master`
  - 解决已预演出的内容冲突：
    - `common/src/system_storage.ts`
    - `frontend/src/widgets/InstanceList.vue`
    - `languages/en_US.json`
    - `languages/zh_CN.json`
  - 对 19 个重叠变更文件做人工复核，避免静默覆盖 fork 行为。
- 非范围：
  - 不在 Sprint 1 直接推送远端。
  - 不做 UI 重设计、架构重构或功能新增。
  - 不修改生产配置、密钥、部署目标。

## 输入/输出接口或命令面
- 输入：
  - 当前本地 `master`：`e9b31fb9`
  - 官方 `origin/master`：`9ead6bbc`
  - merge-base：`ed327fe91a091ab74f0c2f61ede70c6fd92b839a`
- 输出：
  - 合并分支 `codex/merge-upstream-v10.16.2`
  - 无 Git conflict markers 的源码工作树
  - `docs/workflow/sprint-01-review.md` 记录冲突处理摘要

## 受影响模块
- `common/`
- `daemon/`
- `frontend/`
- `panel/`
- `languages/`
- fork-only 的 `mcsm-monitor-plugin/` 和 `mcsmanager-mcp-server/` 在 Sprint 1 只做存在性保护，不做深度验收。

## 验收标准
- `git status` 不显示未解决 merge 状态。
- `rg "<<<<<<<|=======|>>>>>>>"` 不命中源码冲突标记。
- 19 个 overlap 文件都有明确保留策略：
  - 官方安全/文件/Docker/API 修复不丢。
  - fork 的监控、Control、GM、Operations、PTY、MCP 入口不丢。
- `package-lock.json` 与对应 `package.json` 版本关系保持一致。

## 验证方式
- Sprint 1 最小验证：
  - `git status --short --branch`
  - `rg "<<<<<<<|=======|>>>>>>>" -n`
  - `npm.cmd run build` in `common`
- Sprint 2/3 再执行完整验证矩阵。
