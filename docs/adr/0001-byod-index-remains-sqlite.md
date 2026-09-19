# ADR 0001 — BYOD index remains on-disk SQLite

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

## Status

Accepted (19 Sep 2026)

## Context

Session transcript, rulings, live-transcript cursors, transcription progress, session metadata, and chronicle state moved off the local SQLite session database onto SpacetimeDB (TypeScript kernel + optional remote replica).

BYOD file ingest still needs:

- Content-addressable chunk cache
- Per-`BYOD_PATH` FTS5 indexes
- Prefix/root filters for nested shelves
- High-latency network-mount behaviour (`BYOD_NETWORK`)

Those workloads are document search, not session/chronicle state.

## Decision

Keep the BYOD file index and content cache on disk as SQLite/FTS5 (`data/byod/`, `BYOD_CONTENT_CACHE_PATH`). Do not migrate BYOD into SpacetimeDB in this change.

Licensed rules databases (OGL, DW, BRP, 5E-compatible, Orcus, OSR) also stay as bundled SQLite files. Companion live-transcript sources remain external SQLite/NDJSON; only the ingested session rows live in SpacetimeDB.

## Consequences

- Runtime session/chronicle persistence no longer uses `~/.2d6mcp/sessions.db`.
- Operators still need `better-sqlite3` for rules DBs and BYOD.
- A future ADR may revisit moving BYOD FTS into SpacetimeDB; that is a separate hard problem (large binary files, FTS5 ranking, content cache).
