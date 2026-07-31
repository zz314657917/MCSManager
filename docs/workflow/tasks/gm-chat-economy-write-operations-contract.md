---
task_id: gm-chat-economy-write-operations
project: gm-chat-economy-operations
phase: contract-approved
owner: Codex
qa_mode: browser-plugin
---

# Task Contract: GM Chat And Economy Write Operations

## Goal

完成已接通的受控后端链路的前端交互，并覆盖聊天、经济设置和 1.20.1 插件控制 action 的契约验证。

## Success Criteria

- `GMConsole` 提供当前实例全服广播和已选在线玩家私聊；发送成功后刷新该实例聊天缓存。
- `EconomyConsole` 可从流水或排行榜对有明确实例归属的玩家增加、扣除或设置默认余额，并在确认后刷新数据。
- 经济全区排行榜必须保留玩家来源的 `daemonId` 与 `instanceId`，禁止根据名称猜测目标实例。
- 所有写操作有提交中态、错误反馈与管理员审计；扣除和设置必须二次确认。
- preview 与 live hook 的返回契约一致，并有关键 Playwright 预览覆盖。

## Allowed Paths

- `common/global.d.ts`
- `frontend/src/hooks/useGmConsoleState.ts`
- `frontend/src/hooks/useGmConsolePreviewState.ts`
- `frontend/src/hooks/useEconomyConsoleState.ts`
- `frontend/src/hooks/useEconomyConsolePreviewState.ts`
- `frontend/src/views/GMConsole.vue`
- `frontend/src/views/EconomyConsole.vue`
- `frontend/src/services/apis/index.ts`
- `frontend/tests/e2e/operations-pages.spec.ts`
- `daemon/src/routers/gm_router.ts`
- `daemon/src/service/gm_service.ts`
- `panel/src/app/routers/gm_router.ts`
- `mcsm-monitor-plugin/src/**`
- `mcsm-monitor-plugin/pom.xml`
- `mcsm-monitor-plugin/README.md`
- `docs/workflow/**`

## Denied Paths

- 数据库 schema 或迁移。
- 生产配置、部署脚本、密钥或远程节点配置。
- 任意控制台命令、RCON 透传和角色权限放宽。
- `frontend/output/**` 与无关既有改动。

## Constraints

- 私聊只能发送给当前实例 GM 快照中的在线玩家；广播和私聊限制 500 字符。
- 所有经济写入固定走既有 `gm/actions/execute` 与 Vault `economy` allowlist；非 `money` 货币仅展示，不能误写入默认余额。
- Panel 保持 `ROLE.ADMIN`，Daemon 到插件保持 loopback token 控制；成功和失败都审计。
- 不回滚现有未提交的插件 1.20.1 适配或知识库改动。

## Acceptance Commands

```powershell
cd frontend
npm.cmd run type-check
npm.cmd run build-only
npx.cmd playwright test tests/e2e/operations-pages.spec.ts -g "gm .*preview|economy .*preview" --project=chromium

cd ../daemon
npm.cmd run test:economy
npm.cmd run build

cd ../panel
npm.cmd run build

cd ../mcsm-monitor-plugin
mvn package
```

## Stop Rules

- 若实现需要开放 arbitrary command、降低 `ROLE.ADMIN` 或向全区猜测实例目标，停止并重新规划。
- 若外部经济插件不支持 Vault 默认余额，显示失败并保留审计，不伪造成功。
- 若真实 1.20.1 测试服不可用，保留为未验证风险，不能以构建替代运行时结论。
