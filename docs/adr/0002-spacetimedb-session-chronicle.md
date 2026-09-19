# ADR 0002 — SpacetimeDB for session and chronicle state

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

## Status

Accepted (19 Sep 2026)

## Context

The MCP server stored sessions, transcripts, rulings, transcription progress, and live-ingest cursors in a process-local better-sqlite3 file (`SESSION_DB_PATH`, default `~/.2d6mcp/sessions.db`). Chronicle (cross-session table memory) needs the same durable store, scoped by `table_label`.

The operator stack for personal apps is SpacetimeDB + TypeScript.

## Decision

1. Domain state lives in `@2d6mcp/spacetime`, a TypeScript kernel that implements the SpacetimeDB module schema (sessions + chronicle tables).
2. Default local mode is `SPACETIMEDB_MODE=embedded`: the kernel persists a JSON snapshot to `SPACETIMEDB_EMBEDDED_PATH` (`~/.2d6mcp/spacetime-kernel.json`). This is not SQLite.
3. `SPACETIMEDB_MODE=remote` (or setting `SPACETIMEDB_URI`) hydrates/flushes that snapshot to a published module via HTTP (`apply_kernel_snapshot`). Publish from `packages/spacetime/module`.
4. CI uses the in-process kernel (no spacetime daemon required).
5. `SESSION_DB_PATH` is the legacy SQLite import source only (`2d6mcp import-sessions`).
6. Chronicle extracts are always `provisional`. Only `chronicle promote` confirms.

## Consequences

- Breaking persistence change on 0.x → lockstep **0.9.0**.
- Operators should run `import-sessions` once if they have an old `sessions.db`.
- A published SpacetimeDB replica is optional; embedded mode is local-first.
