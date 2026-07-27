---
topic: upstream-v10.17.0-hardening
last_verified: 2026-07-27
qa_mode: build-and-browser
---

# QA Record

## Completed Checks

- `common`: `npm.cmd run build`
- `daemon`: `npm.cmd run build`
- `daemon`: `npm.cmd run test:economy`, `test:monitor`, `test:process-tree`, `test:host-metrics`
- `panel`: `npm.cmd run build`, `test:monitor-overview`
- `frontend`: `npm.cmd run type-check`, `build-only`
- `frontend`: `npm.cmd run test:e2e` -> 24 tests, 13 passed, 11 conditional skips
- `mcsmanager-mcp-server`: `npm.cmd run build`, `npm.cmd test` -> 24 passed
- `mcsm-monitor-plugin`: `mvn package -DskipTests`
- `git diff --check`

## Integration Recheck (2026-07-27)

- Resolved all seven merge conflicts. The final result retains the hardened economy persistence, plugin event queue, derived instance-token boundary, and the already-fixed Economy UI component registration/type narrowing.
- Freshly reran every command above after the integration. All builds and targeted tests passed; the browser suite finished with 13 passed and 11 device-conditional skips, and the MCP suite finished with 24 passed.
- `npm.cmd audit --omit=dev` is clean for `panel`; the known `daemon` `archiver@5` dependency-chain finding remains unchanged and requires a separate major-version migration.

## Findings

- Economy persistence now serializes database initialization per instance, keeps dirty state across failed flushes, writes through a temporary file, deduplicates `referenceId`, and ignores stale snapshots.
- Plugin economy events now use a bounded queue with rate-limited overflow warnings, bounded exponential retries, and stable reference IDs.
- GM preview starts with no selected player, so the first explicit click opens the operations panel instead of toggling an implicit selection off.
- Monitor test fixtures now use the derived per-instance token required by the hardened heartbeat boundary.

## Remaining Risk

- `npm.cmd audit --omit=dev` is clean for `panel`. `daemon` still reports the `archiver@5` / `readdir-glob` chain; npm only offers `archiver@8` as a major-version fix. Keep that migration as a separate compatibility sprint rather than forcing it into this merge.
- Playwright's local preview logs expected `ECONNREFUSED` messages for live-only `/api` and Socket.IO requests; preview assertions pass without a running Panel/Daemon.
