# 2D6 MCP — Agent Instructions

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

## Project Identity

This project provides a self-hosted MCP server (`packages/server/`) — stdio transport, local MLX/llama.cpp, BYOD, session DB, and Discord webhook posting.

It shares rules databases (OGL/Cepheus Engine SRD for sci-fi, Dungeon World CC-BY-3.0 for fantasy, Basic Roleplaying SRD for percentile RPGs, 5E-compatible SRD CC-BY-4.0 for d20 fantasy, Orcus OGL v1.0a for 4e-compatible, original B/X-style OSR / B/X-compatible procedures), dice engine, prompt templates, and quality filters via `packages/shared/`.

The project is system-agnostic and avoids all third-party trademarks.

## Architecture

```
2d6mcp/                          # npm workspaces monorepo
├── packages/
│   ├── server/                  # MCP server (stdio transport, local MLX, BYOD)
│   ├── shared/                  # @2d6mcp/shared — dice, keywords, prompts, quality filter
│   ├── ogl/                     # @2d6mcp/ogl — OGL SQLite queries
│   ├── dw/                      # @2d6mcp/dw — DW SQLite queries
│   ├── brp/                     # @2d6mcp/brp — BRP SQLite queries
│   ├── 5ecompatible/            # @2d6mcp/5ecompatible — 5E-compatible SQLite queries
│   ├── orcus/                   # @2d6mcp/orcus — Orcus d20-compatible SQLite queries
│   └── osr/                     # @2d6mcp/osr — B/X-style procedures (original summaries)
├── data/
│   ├── ogl/cepheus.db           # Bundled OGL database
│   ├── dw/dungeon-world.db      # Bundled DW database
│   ├── brp/basic-roleplaying.db # Bundled BRP database
│   ├── 5ecompatible/5ecompatible-srd.db  # Bundled 5E-compatible database
│   ├── orcus/orcus.db           # Bundled Orcus database
│   └── osr/osr-procedures.db   # Generated OSR / B/X-compatible procedures (gitignored *.db)
└── tests/                       # Vitest test suite
```

## Build & Test Commands

```bash
npm install              # install all workspace dependencies
npm run build            # compile all packages (tsc --build)
npm run start            # run MCP server (packages/server/dist/index.js)
npm test                 # run test suite (vitest)
npm run test:watch       # run tests in watch mode
npm run test:coverage    # run tests with coverage
npm run setup            # create BYOD consent token
npm run populate-ogl     # regenerate OGL SQLite database
npm run populate-dw      # regenerate DW SQLite database
npm run populate-brp     # regenerate BRP SQLite database
npm run populate-5ecompatible  # regenerate 5E-compatible SQLite database from .reference/SRD (clone https://github.com/oldmanumby/dnd.srd.5.2.1; credit Oldmanumby for markdown packaging)
npm run populate-orcus     # regenerate Orcus SQLite database
npm run populate-osr      # regenerate OSR / B/X-compatible procedures database
npm run sync-byod          # list BYOD collections; pass a query or --root to index that scope
npm run version:check      # assert lockstep SemVer (root + packages/*)
npm run version:bump -- patch|minor|major  # write lockstep version (see VERSIONING.md)
```

## Versioning

Lockstep SemVer 2.0: root `package.json` and every `packages/*/package.json` share one product version. MCP `server.version` comes from root `package.json` via `getServerVersion()`. On **0.x**, breaking changes bump **minor** (unstable API). Tags are `vX.Y.Z` after merge; do not npm publish or auto-publish GitHub Releases. Operator guide: `VERSIONING.md`. Changelog: `CHANGELOG.md`.

## Agent Modes

Specialised agent instructions are available for multiple AI coding harnesses:

### Kilo Code (`.kilo/agent/`)

| Agent File | Domain |
|-----------|--------|
| `.kilo/agent/2d6mcp.md` | Master reference — all tools, workflows, environment vars |
| `.kilo/agent/2d6mcp-task-resolution.md` | Dice rolling — 2d6, d20, and d100 resolution with effect margins, difficulty, boon/bane |
| `.kilo/agent/2d6mcp-rules-reference.md` | Rules lookup and table rolling — OGL, DW, BRP, 5E, 4E-compatible, BYOD search strategies |
| `.kilo/agent/2d6mcp-character-creation.md` | Multi-system character creation — UPP, characteristics, careers, classes, skills |
| `.kilo/agent/2d6mcp-byod.md` | BYOD sync, listing, inspection, troubleshooting |

Slash commands are in `.kilo/command/`:

| Command | Purpose |
|---------|---------|
| `.kilo/command/roll.md` | Quick dice rolling |
| `.kilo/command/rules-lookup.md` | Quick rules lookup |
| `.kilo/command/byod-index.md` | BYOD index management |

### Claude Code (`.claude/skills/`)

| Skill | Domain |
|-------|--------|
| `.claude/skills/2d6mcp/SKILL.md` | Master reference — all tools, workflows, environment vars |
| `.claude/skills/2d6mcp-task-resolution/SKILL.md` | Dice rolling — 2d6, d20, and d100 resolution with effect margins, difficulty, boon/bane |
| `.claude/skills/2d6mcp-rules-reference/SKILL.md` | Rules lookup and table rolling — OGL, DW, BRP, 5E, 4E-compatible, BYOD search strategies |
| `.claude/skills/2d6mcp-character-creation/SKILL.md` | Multi-system character creation — UPP, characteristics, careers, classes, skills |
| `.claude/skills/2d6mcp-byod/SKILL.md` | BYOD sync, listing, inspection, troubleshooting |

### Cursor (`.cursor/rules/`)

| Rule File | Domain |
|-----------|--------|
| `.cursor/rules/2d6mcp.md` | Comprehensive reference — all tools, mechanics, workflows |

### Windsurf

| Rule File | Domain |
|-----------|--------|
| `.windsurfrules` | Comprehensive reference — all tools, mechanics, workflows |

### Cline (`.cline/rules/`)

| Rule File | Domain |
|-----------|--------|
| `.cline/rules/2d6mcp.md` | Comprehensive reference — all tools, mechanics, workflows |

### Aider

| File | Domain |
|------|--------|
| `AIDER.md` | Project conventions, MCP tools, environment reference |

## Package Structure

```
packages/server/src/
  index.ts          # MCP server entry point (stdio transport)
  server.ts         # Server class, tool / prompt / resource registration
  prompts.ts        # MCP prompt catalog (skill-check, lookup-rules, …)
  resources.ts      # MCP resource catalog (2d6mcp://info, rules indexes, …)
  config.ts         # Environment config + BYOD gate
  cli.ts            # CLI entry for setup/populate commands
  ogl/
    database.ts     # SQLite connection + FTS5 setup (IMPORTS from @2d6mcp/ogl)
    queries.ts      # Rule search queries
  dw/
    database.ts     # DW SQLite connection + schema setup (IMPORTS from @2d6mcp/dw)
    queries.ts      # DW rule search queries
  brp/
    database.ts     # BRP SQLite connection + schema setup (IMPORTS from @2d6mcp/brp)
    queries.ts      # BRP rule search queries
  5ecompatible/
    database.ts     # 5E-compatible SQLite connection + schema setup (IMPORTS from @2d6mcp/5ecompatible)
    queries.ts      # 5E-compatible rule search queries
  orcus/
    database.ts     # Orcus SQLite connection + schema setup (IMPORTS from @2d6mcp/orcus)
    queries.ts      # Orcus rule search queries
  osr/
    database.ts     # OSR procedures SQLite (IMPORTS from @2d6mcp/osr)
    queries.ts      # OSR procedure search queries
  byod/
    gate.ts         # Consent gate check
    ingest.ts       # File walking, PDF/text/md parsing
    catalog.ts      # Top-level collection list + query matching
    paths.ts        # Windows-safe relative paths and prefix filters
    search.ts       # FTS5 search against BYOD index
    content-cache.ts # Content-addressable chunk cache
  character/
    parser.ts       # UPP extraction, stat parsing
  discord/
    config.ts       # Webhook storage, smart routing, tag matching
    webhook.ts      # HTTP posting, embed validation, colour helpers
  audio/
    mlx-transcribe.ts  # MLX Whisper + whisper.cpp backend dispatch
    backends/
      whispercpp.ts    # whisper.cpp STT backend (Win/Linux)
    chunker.ts         # ffmpeg chunking, repetition cleanup
    speakers.ts        # silence-gap speaker diarization
  rulings/
    retrieve.ts        # Shared rules lookup for synthesize_ruling
    mlx-synthesize.ts  # MLX LM + llama.cpp + ollama backend dispatch, quality filter
    backends/
      llamacpp.ts      # llama.cpp LLM backend (Win/Linux)
  session/
    database.ts        # Session SQLite (transcripts, rulings, progress, live-ingest cursors)
    schema.sql.ts      # DDL for sessions, segments, rulings, transcription_progress, live_transcript_cursors
  live-transcript/
    paths.ts           # Allowlist + companion DB discovery
    sources.ts         # Companion SQLite + NDJSON/watch_dir readers
    ingest.ts          # Incremental poll into log_transcript
  tools/               # Componentised tool handlers
    helpers.ts         # Shared helpers, keyword extraction, fuzzy matching
    definitions.ts     # All tool JSON schemas
    index.ts           # Handler dispatch table

packages/shared/src/
  index.ts             # Re-exports all modules
  dice.ts              # parseDiceNotation, roll2d6, rollD20, rollPercentile, rollPercentileCoc, rollDamage, rollCustom
  tables.ts            # rollOnTable, normalizeDiceType, rollD66
  keywords.ts          # extractKeywords, fuzzyAlternatives, fuzzyKeywordList, STOPWORDS, FTS5/LIKE fuzzy query builders (sanitizeFts5Query, buildPrefixFtsQuery, buildFuzzyFtsQuery, fts5QueryStrategy, fuzzyLikeVariants, searchWithFuzzyFallback, levenshtein/OSA)
  prompts.ts           # DEFAULT_SYSTEM_PROMPT, SYSTEM_PROMPT_LARGE, quality filter
  types.ts             # Shared interfaces (RulingResult, RulingSource, etc.)
```

## Available Tools

| Tool | Purpose |
|------|---------|
| `roll` | Roll dice. `notation` plus optional `mechanic` (`2d6`, `d20`, `percentile`, `damage`, `raw`, `coc`). Optional `difficulty` operator target presets (`average=8`, `difficult=10`, `very_difficult=12`, `impossible=16`). |
| `roll_table` | Roll on a named table. `source`: `ogl`, `osr`, or `byod`. Omit `table_name` with `source=byod` or `source=osr` to list tables. |
| `query_rules` | Search a licensed rules DB. `system` required (`ogl`, `dw`, `brp`, `5ecompatible`, `orcus`, `osr`). Default category is core FTS only. `category=categories` lists filters. |
| `query_local_byod` | Search personal files. Indexes matching top-level game folders on demand, then searches. Optional `include_full`. Optional `relative_path` / `root` pins a nested folder. |
| `sync_byod` | On-demand index. No args lists folders. `query` indexes matching collections. `relative_path` or `root` indexes a file or a directory under `BYOD_PATH` (walk stays inside that folder). |
| `clear_byod` | Delete the BYOD index. |
| `list_byod_files` | List indexed files. Optional `relative_path` inspects one file. |
| `get_byod_chunk` | Retrieve full chunk content by path + chunk index. |
| `parse_character` | Parse a character sheet (`file_path` under project/`BYOD_PATH`, or pasted `sheet_text`). |
| `discord_post` | Post to Discord webhooks with smart routing and embeds. |
| `discord_webhook` | Manage webhooks: `action` add, remove, list, or test. |
| `session` | Manage sessions: `action` start, end, list, delete, or summarize. Optional `table_label` on start/list. `rules_system=byod` when `byod_system` is set. |
| `log_transcript` | Log a transcript segment to a session. |
| `get_session_context` | Get recent transcript and rulings (`session_id` or `table_label`). |
| `search_transcript` | Search transcripts. Unquoted tokens are AND; quoted queries are exact LIKE phrases. `session_id` or `table_label`. |
| `synthesize_ruling` | Cited rules ruling. When `byod_system` is set, prefers indexed personal files. Pass `rules_context` from BYOD chunks. |
| `transcribe_audio` | Transcribe audio. Files over 180 seconds are chunked. `action`: transcribe, list, or clear. Last chunk sets `complete: true`. |
| `ingest_live_transcript` | Ingest a live companion transcript into a session. `action`: poll (alias ingest), status, or reset_cursor. Sources: `companion_sqlite`, `ndjson_file`, `watch_dir`. |

## Prompts and Resources

MCP prompts (workflows): `skill-check`, `d20-check`, `percentile-check`, `lookup-rules`, `create-character`, `start-session`, `ask-ruling`, `index-documents`.

MCP resources: `2d6mcp://info`, `2d6mcp://tools`, `2d6mcp://prompts`, `2d6mcp://systems`, `2d6mcp://docs/quickstart`, `2d6mcp://docs/environment`, `2d6mcp://license`, `2d6mcp://session/current`, `2d6mcp://rules/{system}`.

## Session Management & Ruling Synthesis

- **Session lifecycle**: Start with `session` `action: start`, log with `log_transcript`, end with `session` `action: end`.
- **Table labels**: Pass optional `table_label` on start (examples: `table-a`, `campaign-label`) so list/context/search stay per-table.
- **OSR vs OGL**: `query_rules(system=ogl)` is 2d6 sci-fi SRD. B/X-style procedures use `system=osr`. Full commercial books are BYOD (`AGREE_BYOD_USE` + `BYOD_PATH`, for example `/path/to/rpg-shelf` for the operator's local OSR/B/X shelf PDFs).
- **OGL trade**: `query_rules(system=ogl, category=trade)` (alias `Trade & Commerce`) for freight, speculative trade, passengers, and mail. Broker is `category=skills`; Trade Codes/Routes are `category=worlds`. Commercial freight-lot matrices are not bundled (`category=list_tables` has none) — use Population/starport or BYOD.
- **BYOD system scoping**: Pass `byod_system` on session start to filter BYOD searches. Pin nested folders with `root` / `relative_path` so a family name does not index `edition-5-sibling`.
- **Ruling synthesis**: `synthesize_ruling` auto-looks up licensed rules and BYOD (when consent is on). If `byod_system` is set, retrieval prefers indexed personal files and skips licensed databases unless `rules_system` is set explicitly. Pass `rules_context` from `get_byod_chunk` when you already have chunks. Default licensed `rules_system` comes from the session only when `byod_system` is unset.
- **Audio transcription**: `transcribe_audio` processes files longer than 180 seconds in 2-minute chunks. Call repeatedly until `complete: true`. The last chunk sets `complete` itself.
- **Live transcript companion**: Voice chat, call apps, and screen recorders stay outside this server. Point `LIVE_TRANSCRIPT_DB` at a companion SQLite file, or use an NDJSON fixture. Start a `session`, then poll `ingest_live_transcript`. See **Live transcript companion** below.

### Live transcript companion

2d6mcp does not capture system loopback or microphone audio. An external live-transcript companion (or an NDJSON fixture) writes segments; this server polls them into `log_transcript`.

Companion SQLite schema:

- `meetings`: `id`, `title`, `started_at`, `duration_s`, …
- `segments`: `id`, `meeting_id`, `start_ms`, `end_ms`, `speaker` (integer), `text`

1. Run a compatible companion app separately, or write NDJSON for smoke tests without that app installed.
2. Set `LIVE_TRANSCRIPT_DB` to the companion SQLite file, and/or `LIVE_TRANSCRIPT_ALLOW_PATHS` (colon/semicolon-separated) for fixture files. Windows drive letters in those lists are kept intact.
3. `session` `action: start` to get a `session_id`.
4. Poll `ingest_live_transcript` with `action: poll` (alias `ingest`). Default source is `companion_sqlite` when `path` is omitted. Use `source: ndjson_file` plus `path` for `{ "start_ms", "end_ms", "speaker", "text", "id"? }` lines. `watch_dir` reads `.ndjson`/`.jsonl`/`.json` files in an allowlisted folder.
5. Repeat poll during play. Cursors are per session and incremental — the same segment is not logged twice. `action: status` shows the cursor; `action: reset_cursor` starts over.
6. Paths must stay under the project root, `BYOD_PATH`, `LIVE_TRANSCRIPT_ALLOW_PATHS`, or `LIVE_TRANSCRIPT_DB`. Compatible companion library files under common app-data locations are auto-discovered when present. System loopback / mic capture is out of scope for 2d6mcp.
7. Live-sidecar smokes: rotate or truncate the NDJSON fixture, or start a fresh session, between scenarios so an older fixture `Me` line cannot sit in the same `from_context` window as a new check. `synthesize_ruling` now prefers the most recent speaker-`Me` rules-ish utterance (including STT lines that omit `?`), but ops hygiene still keeps windows small.

The `2d6-mcp-stt-notes-ingest` workflow is not a repo skill (harness skills live under `.claude/skills/` / `.kilo/agent/`). Use this section plus the master `2d6mcp` skill.

Outbound webhook tools are unchanged.

### Personal files (BYOD)

BYOD tooling is system-agnostic. `sync_byod`, `query_local_byod`, `root`, `relative_path`, and `byod_system` work for any operator shelf folder.

1. Start with `rules_system=byod` (or omit `rules_system` when `byod_system` is set) so rulings prefer indexed personal files.
2. Pin search: `query_local_byod(search_term, root="parent/line")` so sibling collections are not walked.
3. `synthesize_ruling`: pass `rules_context` from BYOD chunks when you already have them. If the local LLM is missing, retrieved context is still returned.
4. Optional `roll` `difficulty` presets are generic operator targets (`average=8`, `difficult=10`, `very_difficult=12`, `impossible=16`). Ignored when `target` is set.
5. `parse_character` needs `file_path` under the project or `BYOD_PATH`, or pasted `sheet_text`.
6. `search_transcript`: unquoted tokens are AND; quoted strings are exact phrases.

## Cross-Platform Backends

| Platform | STT Backend | LLM Backend |
|---|---|---|
| macOS (default) | `mlx` (MLX Whisper) | `mlx` (MLX LM) |
| Windows/Linux | `whispercpp` (whisper.cpp) | `llamacpp` (llama.cpp) or `ollama` |

On Windows, if `LLM_BACKEND` is unset/`mlx` and `mlx_lm.generate` is missing, `synthesize_ruling` probes `OLLAMA_HOST` `/api/tags` and uses Ollama when that answers. Set `LLM_BACKEND=ollama` in mcp.json to skip the probe. GGUF/`llama-cli` is not required when Ollama is present.

## Multi-License Architecture

- All `.ts` source files: AGPL-3.0
- All files under `data/ogl/`: OGL v1.0a
- All files under `data/dw/`: CC-BY-3.0
- All files under `data/brp/`: BRP OGL v1.0
- All files under `data/5ecompatible/`: CC-BY-4.0
- All files under `data/orcus/`: OGL v1.0a
- All files under `data/osr/`: original 2d6mcp procedure summaries (AGPL); see `data/osr/NOTICE.txt`. Full commercial books are BYOD only (local, consent-gated, never uploaded).
- Commercial rulebooks and third-party publisher trademarks are not bundled. Do not commit commercial book PDFs or extracted dumps. Full books are BYOD only. CI runs `scripts/license-firewall.mjs`.
- `LICENSE` contains the AGPL-3.0 text
- `LICENSE.md` describes the firewall in detail
- `OGL-1.0a.txt` contains the full OGL text with Cepheus SRD copyright attributions
- `data/dw/CC-BY-3.0.txt` contains the full CC-BY-3.0 license text
- `data/dw/ATTRIBUTION` contains Dungeon World derivation and attribution details
- `data/5ecompatible/SRD-NOTICE.txt` contains 5E-compatible SRD attribution details (Wizards of the Coast LLC / CC-BY-4.0) plus credit for Oldmanumby's markdown packaging at https://github.com/oldmanumby/dnd.srd.5.2.1 (clone into `.reference/SRD`; do not vendor SRD text)
- `data/orcus/ATTRIBUTION` contains Orcus 4e-compatible derivation and attribution details
- `data/osr/NOTICE.txt` explains that bundled OSR / B/X-compatible rows are original summaries, not commercial book text

## BYOD Consent Gate

The server checks for `AGREE_BYOD_USE="true"` env var OR the presence of a `.mcp-byod-consent-accepted` token file in the project root before enabling BYOD tools. Without consent, BYOD tools return a clear disclaimer message.

## Naming Conventions

Never reference any third-party game system or trademarked terms. Use generic descriptors: "2d6 sci-fi RPG", "2d6 fantasy RPG", "starship", "star system", "characteristic", "move", "front", "monster", etc.

**Tool loyalty**: Once 2d6mcp tools are invoked (particularly BYOD — `query_local_byod`, `get_byod_chunk`, `synthesize_ruling`), continue using them for all game content. Do not switch to external file-reading MCP tools unless the user explicitly asks.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD mode |
| `BYOD_PATH` | `.reference/` (auto-discovered in project root if not set) | Directory of local source files |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per chunk (500–50000) |
| `BYOD_CHUNK_OVERLAP` | `400` | Overlap between chunks |
| `BYOD_MAX_FILES` | `2000` | Max files per sync |
| `BYOD_MAX_CHUNKS_PER_FILE` | `500` | Max chunks per file |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Max ms per sync batch |
| `BYOD_NETWORK` | `"false"` | Force single-file index concurrency for high-latency filesystems |
| `BYOD_CONTENT_CACHE_PATH` | `data/byod/content_cache.db` | Shared content-addressable cache path |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | Custom OGL database path |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | Custom DW database path |
| `BRP_DB_PATH` | `data/brp/basic-roleplaying.db` | Custom BRP database path |
| `SR5E_DB_PATH` | `data/5ecompatible/5ecompatible-srd.db` | Custom 5E-compatible database path |
| `ORCUS_DB_PATH` | `data/orcus/orcus.db` | Custom Orcus database path |
| `OSR_DB_PATH` | `data/osr/osr-procedures.db` | OSR / B/X-compatible procedures database path |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model for STT |
| `MLX_LLM_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-4bit` | MLX LM model for ruling synthesis |
| `SESSION_DB_PATH` | `~/.2d6mcp/sessions.db` | Session database location |
| `STT_BACKEND` | `mlx` | STT backend: `mlx` (macOS) or `whispercpp` (Win/Linux) |
| `LLM_BACKEND` | `mlx` | LLM backend: `mlx` (macOS), `llamacpp`, or `ollama`. On win32, default mlx falls back to ollama when `/api/tags` answers. |
| `WHISPERCPP_MODEL` | `ggml-large-v3-turbo.bin` | whisper.cpp model path (Win/Linux) |
| `LLAMACPP_MODEL` | `Llama-3.2-3B-Instruct.Q4_K_M.gguf` | llama.cpp model path (Win/Linux) |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama daemon base URL (`LLM_BACKEND=ollama`) |
| `OLLAMA_MODEL` | `llama3.2:3b` | Ollama model name (`LLM_BACKEND=ollama`) |
| `LIVE_TRANSCRIPT_DB` | — | Path to an external companion SQLite file (`meetings` + `segments`). Allowlisted for `ingest_live_transcript`. |
| `LIVE_TRANSCRIPT_ALLOW_PATHS` | — | Extra allowlisted files/directories for companion SQLite or NDJSON (colon or semicolon separated; Windows drive letters kept intact). |

### Security Note

**Never commit secrets to the repository.** The MCP server reads secrets from environment variables only — never from committed files. Discord webhook URLs live in `.mcp-discord-webhooks.json` (gitignored).

## Development Workflow

These rules apply to **all AI coding agents** working on this repository. Follow them strictly across sessions. Deviations cause merge conflicts, broken builds, and exposed secrets.

### Branch and Commit Discipline

1. **Always create a feature branch.** Start work with `git checkout -b feature/<descriptive-name>`. Never commit directly to `main`.

2. **Atomic commits.** One logical change per commit. If you fix a bug, improve docs, and refactor code in the same session, make three commits.

3. **Conventional commit messages:**
   ```
   type(scope): brief description
   
   feat(dice): add d66 table rolling
   fix(security): resolve ReDoS in quality filter regex
   docs(readme): update monorepo architecture diagram
   ```
   Map to lockstep bumps (`VERSIONING.md`): `fix`/`docs`/`chore`/`test` → patch; `feat` → minor; `BREAKING CHANGE`/`!` → minor on 0.x, major after 1.0.0. Never invent `1.0.0` unless asked. Use `npm run version:bump` — do not edit package versions by hand.

4. **Before committing — verify what changed.** Run `git status --short` and `git diff --stat`. Only stage files you intend to change. Never `git add -A` blindly.

### Pre-Commit Checklist

Run these **before every commit** that includes code changes:

```bash
npm run typecheck    # tsc --build across all packages
npm test             # vitest test suite
npm run build        # full compilation (tsc --build)
npm run version:check  # lockstep versions still match root
```

### Security Before Every Commit

1. **Check for exposed secrets:**
   ```bash
   git diff --staged | grep -iE '(token|secret|password|key)\s*[=:]\s*["\x27][a-zA-Z0-9_-]{8,}'
   ```
   If this returns anything, the diff contains hardcoded credentials. Remove them.

2. **Verify Discord webhook config is gitignored:**
   ```bash
   git check-ignore .mcp-discord-webhooks.json
   ```
   Must return the file path (meaning it is ignored).

3. **Verify no build artifacts are staged:**
   ```bash
   git diff --staged --name-only | grep -E '\.tsbuildinfo$|dist/'
   ```
   Must return nothing.

### PR and Merge Workflow

1. **Push the feature branch** and open a PR against `main`.

2. **PR description** must include:
   - What changed (2-3 sentences)
   - Files affected (list key files)
   - Test results (`npm test` output)
   - Breaking changes (if any)

3. **Do not self-merge without review.** A second pair of eyes catches things you missed — especially security issues and path mismatches. Wait for approval before merging.

4. **After merge, delete the feature branch.** `git branch -d feature/<name>` for local, `git push origin --delete feature/<name>` for remote.

### Documentation Discipline

When you add or change features, update documentation **in the same commit**:

| Change type | Update these files |
|---|---|
| New MCP tool | `AGENTS.md` tools table, `README.md` tools table, harness files |
| New env var | `AGENTS.md` env var tables, `README.md`, `.env.example` |
| Architecture change | `AGENTS.md` architecture diagram, `README.md`, `CONTRIBUTING.md` |
| Security change | `SECURITY.md`, `.env.example` |
| Version bump | `CHANGELOG.md` (Keep a Changelog), `npm run version:bump`, lockstep `package.json` / `server.json` |

### Testing

- Run `npm test` before every commit. All tests must pass.
- If you add new logic to `packages/shared/`, add corresponding tests in `tests/`.
- Never commit code that breaks the build or any test.
