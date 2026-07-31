---
task_id: gm-chat-economy-write-operations
phase: contract-approved
reviewer: Codex
reviewed_at: 2026-07-31
---

### PASS: gm-chat-economy-write-operations contract review

## Findings

- Scope is bounded to existing Panel -> Daemon -> loopback plugin action boundaries and `ROLE.ADMIN`.
- Economy rows must carry their daemon and instance identifiers; name-based target recovery is explicitly prohibited.
- Add an implementation check: reject a chat `target` other than `broadcast` or `private` at both Panel and Daemon boundaries. It must not fall back to broadcast.

## Acceptance Readiness

- Frontend build/type checks and preview Playwright cases cover user-visible behavior.
- Daemon, Panel and Java plugin builds cover the cross-language protocol changes.
- A real 1.20.1 plus Vault/chat integration smoke remains a required manual evidence gap.

## Decision

Contract approved. Proceed to build.
