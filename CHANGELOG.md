# Changelog

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with **lockstep** versions across the npm workspaces (see [VERSIONING.md](VERSIONING.md)).

## [Unreleased]

### Added

- BYOD sync can target a nested directory via `relative_path` or `root`. The walk stays inside that folder and rejects paths that escape `BYOD_PATH`.
- `query_local_byod` accepts the same `relative_path` / `root` pin so a search does not walk sibling editions.
- Session `rules_system=byod` (default when `byod_system` is set) so rulings prefer indexed personal files.
- `roll` operator target presets `difficulty=average|difficult|very_difficult|impossible` map to 8/10/12/16. Ignored when `target` is set.
- `parse_character` accepts pasted `sheet_text` when no local `file_path` is available.
- Sync results include `failedPaths` (relative paths that failed to ingest), not only a failed count.
- CLI `sync-byod <query>` (and `--root`) loops until `complete`, with a round cap. The MCP tool stays time-budgeted.

### Fixed

- Catalog matching no longer extra-indexes a sibling folder whose name merely contains a shorter hit (for example `collection-a-website-dump` next to `collection-a`).
- On `BYOD_NETWORK=true`, sync does not start another file when remaining budget is below a small floor.
- `loadConfig` logs the BYOD_PATH banner at most once per process.
- OGL `query_rules` category aliases are case-insensitive, so display names such as `Trade & Commerce` and `TRADE & COMMERCE` route through the trade filter instead of core FTS.
- `search_transcript` matches unquoted tokens with AND (all terms present, not necessarily adjacent). Quoted queries stay exact phrases.
- `synthesize_ruling` prefers indexed personal files when `byod_system` is set and no longer silently ignores BYOD. Missing local LLM still returns retrieved context instead of a hard block.

### Changed

- Bare `sync_byod` / `npm run sync-byod` lists top-level collections. A query or directory root indexes that scope.

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

[Unreleased]: https://github.com/crowterliam/2d6mcp/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/crowterliam/2d6mcp/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/crowterliam/2d6mcp/releases/tag/v0.7.0
