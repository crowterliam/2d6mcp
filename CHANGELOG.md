# Changelog

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with **lockstep** versions across the npm workspaces (see [VERSIONING.md](VERSIONING.md)).

## [Unreleased]

## [0.9.0] - 2026-09-19

### Added

- Chronicle tool family (`chronicle`) scoped by durable `table_label`: threads, beats, entities, links, hooks, `brief` (no LLM), `promote`, `search`, `extract_candidates`, and allowlisted markdown `export`.
- Session end/summarize returns provisional `chronicle_candidates` for review. `log_transcript` `intent=chronicle|beat` and optional live-ingest `chronicle_hints` write provisional beats only.
- SpacetimeDB TypeScript kernel (`@2d6mcp/spacetime`) for session transcript, rulings, live-transcript cursors, transcription progress, session metadata, and chronicle. Optional remote replica via `SPACETIMEDB_URI`.
- CLI `import-sessions` to copy a legacy SQLite `sessions.db` into the kernel.
- ADRs: BYOD/rules indexes stay on SQLite; session/chronicle state lives in SpacetimeDB.
- BYOD sync can target a nested directory via `relative_path` or `root`. The walk stays inside that folder and rejects paths that escape `BYOD_PATH`.
- `query_local_byod` accepts the same `relative_path` / `root` pin so a search does not walk sibling editions.
- Session `rules_system=byod` (default when `byod_system` is set) so rulings prefer indexed personal files.
- `roll` operator target presets `difficulty=average|difficult|very_difficult|impossible` map to 8/10/12/16. Ignored when `target` is set.
- `parse_character` accepts pasted `sheet_text` when no local `file_path` is available.
- Sync results include `failedPaths` (relative paths that failed to ingest), not only a failed count.
- CLI `sync-byod <query>` (and `--root`) loops until `complete`, with a round cap. The MCP tool stays time-budgeted.
- `ingest_live_transcript` polls an external companion SQLite DB (`meetings` + `segments`) or an NDJSON/`watch_dir` fixture into `log_transcript`. System loopback / mic capture stays outside 2d6mcp.
- `LLM_BACKEND=ollama` HTTP backend (`OLLAMA_HOST`, `OLLAMA_MODEL`, default `llama3.2:3b` at `http://127.0.0.1:11434`). On Windows, default mlx falls back to Ollama when `mlx_lm.generate` is missing and `/api/tags` answers; GGUF/`llama-cli` is not required.

### Changed

- **Breaking:** session persistence is no longer `~/.2d6mcp/sessions.db` at runtime. Default local store is `~/.2d6mcp/spacetime-kernel.json`. `SESSION_DB_PATH` is import-only.
- Bare `sync_byod` / `npm run sync-byod` lists top-level collections. A query or directory root indexes that scope.

### Fixed

- `populate-5ecompatible` reads `docs_compiled/dnd_srd_5.2.1_compiled.md` (current SRD 5.2.1 layout) and still falls back to the extensionless compiled file or directory from older checkouts, so `sr5e_sections` is no longer left empty.
- Credit Oldmanumby for the structured markdown packaging cloned into `.reference/SRD` (`https://github.com/oldmanumby/dnd.srd.5.2.1`), separate from Wizards of the Coast LLC / CC-BY-4.0 SRD 5.2.1 attribution. Oldmanumby did not author the SRD text; that tree is not vendored.
- Catalog matching no longer extra-indexes a sibling folder whose name merely contains a shorter hit (for example `collection-a-website-dump` next to `collection-a`).
- On `BYOD_NETWORK=true`, sync does not start another file when remaining budget is below a small floor.
- `loadConfig` logs the BYOD_PATH banner at most once per process.
- OGL `query_rules` category aliases are case-insensitive, so display names such as `Trade & Commerce` and `TRADE & COMMERCE` route through the trade filter instead of core FTS.
- `search_transcript` matches unquoted tokens with AND (all terms present, not necessarily adjacent). Quoted queries stay exact phrases.
- `synthesize_ruling` prefers indexed personal files when `byod_system` is set and no longer silently ignores BYOD. Missing local LLM still returns retrieved context instead of a hard block.
- `synthesize_ruling` `from_context` prefers the most recent speaker-`Me` rules-ish utterance (including STT lines that omit `?`) instead of latching an older `?` in the window.

## [0.8.0] - 2026-09-16

### Added

- OSR / B/X-compatible procedures database (`query_rules` / `roll_table` with `system`/`source` `osr`). Bundled rows are original mechanical summaries; full commercial books stay on the operator's local shelf (BYOD, consent-gated, never uploaded).
- Optional session `table_label` so context, transcript search, and session list stay per-table.
- Percentile (CoC-style) roll helpers: Hard/Extreme bands, bonus/penalty dice, optional SAN loss, opposed rolls (`roll` mechanic `coc`).
- Licensing firewall in CI: reject vendored PDFs, book dumps, and closed-content identifiers outside attribution files.
- Lockstep SemVer tooling (`npm run version:check`, `npm run version:bump`) and [VERSIONING.md](VERSIONING.md).

### Changed

- BYOD indexes matching top-level collections on demand instead of crawling an entire shelf.
- MCP catalog exposes tools, prompts, and resources for marketplace handshake scoring.
- Self-hosted MCP-only distribution after dropping the hosted Worker/bridge stack.

### Security

- Dependency advisory patches and npm overrides.
- In-repo rules text stays original AGPL helpers; Product Identity titles remain exclusion/attribution-only in `LICENSE.md`.

## [0.7.0] - 2026-05-22

### Added

- Self-hosted MCP server: dice, licensed rules databases, BYOD ingest, sessions, local STT/LLM backends, Discord webhook posting.

[Unreleased]: https://github.com/crowterliam/2d6mcp/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/crowterliam/2d6mcp/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/crowterliam/2d6mcp/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/crowterliam/2d6mcp/releases/tag/v0.7.0
