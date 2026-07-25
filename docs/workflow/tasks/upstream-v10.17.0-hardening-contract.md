# Sprint Contract: upstream v10.17.0 hardening

## Inputs

- Local base: `e2be0c30`.
- Upstream release: `v10.17.0` / `69afcc4c`.
- Additional reviewed upstream commit: `5d41087c`.
- Existing primary worktree remains dirty and is not modified.

## Required batches

1. Isolated worktree and reproducible snapshot of current local source changes.
2. Low-risk upstream ports: `2ceee6f6`, `8f1e0037`, `ab2613c7`; manual import correction from `71ae1f10`.
3. API Key, Daemon authentication, SSRF/TLS, multipart/task ownership and archive limits.
4. Terminal replay (`19419a09`, `fe794783`, `bc7b0637`), upload refresh (`2e8efb40`), stop timeout (`f9e4dfda`) and Economy durability.
5. Compatible dependency updates, full QA and non-force push to `zzrepo`.

## Acceptance gates

- No conflict markers, secrets or generated screenshots are staged.
- API Key `%ret%` probe cannot resolve a user; disabled API Key returns 403; valid MCP key remains usable by default.
- Plugin endpoints reject the global Daemon key and accept only the derived instance token.
- Remote fetches validate every redirect/DNS result and enforce byte limits; `/metrics` is authenticated.
- Economy tests cover concurrent initialization, flush failure, idempotent event retry and stale snapshot rejection.
- All repository build/test commands and the final remote ancestry check pass.
