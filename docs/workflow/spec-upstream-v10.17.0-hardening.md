---
topic: upstream-v10.17.0-hardening
source_base: 69afcc4c
local_base: e2be0c30
delivery_remote: zzrepo
delivery_branch: master
---

# Upstream v10.17.0 selective merge and security hardening

本主题在独立 worktree 中选择性回接上游稳定修复，同时保留本地 Operations/Economy 功能。禁止直接合并 `origin/master`，禁止修改官方 `origin`。

## Success criteria

- 低风险上游提交和批准的语义移植均有独立提交、测试和回滚边界。
- API Key 通配绕过、Daemon 全局 key 泄露、插件 token 冒充、SSRF/TLS、multipart 越权和解压资源耗尽问题有回归测试。
- Economy 初始化、重复事件、旧快照和 flush 失败不会造成静默数据覆盖或无界任务增长。
- `common`、`panel`、`daemon`、`frontend`、MCP 和 Java 插件均通过对应构建/测试门禁。
- 先推送集成分支到 `zzrepo`，远端主线保持 fast-forward；不强推、不触碰 `origin`。

## Explicit exclusions

- 不合并版本/Logo/大规模翻译、`RULES.md` 重命名或上游锁文件。
- JSONL 审计并发、Alert Socket.IO、监控节点并行化和 MCP 确认码扩容另立后续 Sprint。
