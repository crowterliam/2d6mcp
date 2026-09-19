# 2D6 MCP — AI GM Assistant

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![MCP](https://lobehub.com/badge/mcp/crowterliam-2d6mcp)](https://lobehub.com/mcp/crowterliam-2d6mcp)

A system-agnostic Model Context Protocol (MCP) server providing a mechanical engine, dice roller, rules reference, and AI-powered rulings assistant for tabletop RPGs. Supports sci-fi (OGL/Cepheus Engine SRD), fantasy (Dungeon World, CC-BY-3.0), generic percentile (Basic Roleplaying SRD, BRP OGL v1.0), and d20 fantasy (5E-compatible SRD, CC-BY-4.0) games.

## Features

- **Dice Engine** — `2d6+1`, `3d6`, `d66`, target numbers, effect margins
- **OGL Rules Database** — Generated on first use from bundled seed data: Cepheus Engine SRD (OGL v1.0a)
- **Dungeon World Database** — Generated on first use from bundled seed data: moves, classes, spells, monsters, GM tools (CC-BY-3.0)
- **Basic Roleplaying Database** — Generated on first use from bundled seed data: BRP SRD 1.0.2 characteristics, skills, professions, weapons, armor, spot rules (BRP OGL v1.0)
- **5E-Compatible Database** — Generated on first use from bundled seed data: d20 fantasy SRD classes, spells, monsters, feats, and rules (CC-BY-4.0)
- **AI Rulings** — Ask rules questions, get cited answers from OGL/DW/BRP/5E-compatible/BYOD sources. Powered by local MLX, llama.cpp, or Ollama
- **Discord webhooks** — Post rulings and table output to Discord channels from the MCP server
- **BYOD Indexing** — Ingest your own PDF/text/markdown files for local full-text search
- **Session Management** — Start/end sessions, log transcripts, search what was said at the table
- **Local STT/LLM** — MLX on macOS; whisper.cpp, llama.cpp, or Ollama on Windows/Linux

## Quick Start

```bash
git clone https://github.com/crowterliam/2d6mcp.git
cd 2d6mcp
npm install
npm run build
npm run setup          # create consent token for BYOD mode
npm run populate-ogl   # generate the OGL rules database
npm run populate-dw    # generate the Dungeon World rules database
npm run populate-brp   # generate the Basic Roleplaying rules database
npm run populate-5ecompatible  # generate the 5E-compatible rules database from .reference/SRD
npm run populate-orcus      # generate the Orcus database
npm run populate-osr        # generate OSR / B/X-compatible procedures (original summaries, not book text)
npm run start          # run the MCP server (stdio transport)
```

`populate-5ecompatible` reads a local clone at `.reference/SRD`. Clone the structured markdown tree **maintained by Oldmanumby** (packaging only — they did not author the SRD text; Wizards of the Coast LLC / CC-BY-4.0 remains the SRD 5.2.1 attribution):

```bash
git clone https://github.com/oldmanumby/dnd.srd.5.2.1 .reference/SRD
```

See [`data/5ecompatible/SRD-NOTICE.txt`](data/5ecompatible/SRD-NOTICE.txt). Do not vendor that markdown tree into git.

## MCP Client Configuration

LobeHub and other clients that expect an npm package can use:

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "npx",
      "args": ["-y", "crowterliam-2d6mcp"]
    }
  }
}
```

Docker (stdio):

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "2d6mcp"]
    }
  }
}
```

```bash
docker build -t 2d6mcp .
```

From a local clone:

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/absolute/path/to/2d6mcp/packages/server/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/path/to/your/rpg/files"
      }
    }
  }
}
```

Smithery: `smithery.yaml` at the repository root launches `packages/server/dist/index.js` over stdio.

## BYOD — Non-Commercial Use Disclosure

BYOD (Bring Your Own Documents) mode enables local file ingestion for personal, non-commercial use only. By enabling BYOD (`AGREE_BYOD_USE="true"` or `npm run setup`), you confirm that:

- You are the legal owner of the imported files or hold a valid license to use them.
- This tool is provided strictly for personal, non-commercial automation and referencing.
- The developers of this software do not condone piracy or the unauthorized distribution of copyrighted tabletop roleplaying materials.

## Tools

| Tool | Description |
|------|-------------|
| `roll` | Roll dice. `notation` plus optional `mechanic` (`2d6`, `d20`, `percentile`, `damage`, `raw`, `coc`). Infers mechanic from notation when omitted. Optional `difficulty` operator target presets (`average=8`, `difficult=10`, `very_difficult=12`, `impossible=16`). |
| `roll_table` | Roll on a named table. `source`: `ogl`, `osr`, or `byod`. Omit `table_name` with `source=byod` or `source=osr` to list tables. |
| `query_rules` | Search a licensed rules DB. `system` required. Default category is core FTS only. `category=categories` lists filters. |
| `query_local_byod` | Search personal files. Indexes matching top-level game folders on demand, then searches. Optional `include_full`. Optional `relative_path` / `root` pin. |
| `sync_byod` | On-demand index. No args lists folders. `query` indexes matching collections. `relative_path` or `root` indexes a file or a directory under `BYOD_PATH` (walk stays inside that folder). |
| `clear_byod` | Delete the BYOD index. |
| `list_byod_files` | List indexed files. Optional `relative_path` inspects one file. |
| `get_byod_chunk` | Retrieve full chunk content by path + chunk index. |
| `parse_character` | Parse a character sheet (`file_path` or pasted `sheet_text`) |
| `discord_post` | Post messages to Discord webhooks with smart routing |
| `discord_webhook` | Manage webhooks: `action` add, remove, list, or test |
| `session` | Manage sessions: `action` start, end, list, delete, or summarize. Optional `table_label` on start/list. |
| `log_transcript` | Log a transcript segment to a session |
| `get_session_context` | Get recent transcript segments and rulings (`session_id` or `table_label`) |
| `search_transcript` | Search transcripts (`session_id` or `table_label`). Unquoted tokens are AND; quotes are exact phrases |
| `synthesize_ruling` | Cited rules ruling. Prefers BYOD when `byod_system` is set; pass `rules_context` from BYOD chunks |
| `transcribe_audio` | Transcribe audio. Files over 180 seconds are chunked. Last chunk sets `complete: true` |
| `ingest_live_transcript` | Ingest a live companion transcript (`companion_sqlite`, `ndjson_file`, or `watch_dir`) into a session. `action`: poll, status, or reset_cursor |

## Prompts

| Prompt | Purpose |
|--------|---------|
| `skill-check` | 2d6 task check via `roll` |
| `d20-check` | d20 attack or ability check via `roll` |
| `percentile-check` | d100 roll-under via `roll` |
| `lookup-rules` | Licensed rules search via `query_rules` |
| `create-character` | Character creation using `roll` and `query_rules` |
| `start-session` | Start a logged session |
| `ask-ruling` | Cited ruling via `synthesize_ruling` |
| `index-documents` | On-demand BYOD ingest via `sync_byod` |

## Resources

Attachable context at `2d6mcp://info`, `2d6mcp://tools`, `2d6mcp://prompts`, `2d6mcp://systems`, `2d6mcp://docs/quickstart`, `2d6mcp://docs/environment`, `2d6mcp://license`, `2d6mcp://session/current`, and `2d6mcp://rules/{system}` for each licensed database.

## Architecture

```
2d6mcp/
├── packages/
│   ├── server/          # MCP server — stdio transport, local MLX, BYOD, session DB
│   ├── shared/          # @2d6mcp/shared — dice, keywords, prompts, quality filter
│   ├── ogl/             # @2d6mcp/ogl — OGL rules database + queries
│   ├── dw/              # @2d6mcp/dw — DW rules database + queries
│   ├── brp/             # @2d6mcp/brp — BRP rules database + queries
│   ├── 5ecompatible/    # @2d6mcp/5ecompatible — 5E-compatible rules database + queries
│   ├── orcus/           # @2d6mcp/orcus — Orcus d20-compatible rules database + queries
│   └── osr/             # @2d6mcp/osr — B/X-style procedures (original summaries; books via BYOD)
├── data/                # SQLite databases (shared)
├── tests/               # Vitest test suite
├── tsconfig.base.json
└── package.json         # npm workspaces root
```

## Agent Modes

This project includes AI agent instructions for common coding assistants. See `.kilo/agent/` for domain-specific modes:

| Agent File | Domain |
|-----------|--------|
| `.kilo/agent/2d6mcp.md` | Master reference — all tools, workflows, environment vars |
| `.kilo/agent/2d6mcp-task-resolution.md` | Dice rolling, effect margins, difficulty, boon/bane |
| `.kilo/agent/2d6mcp-rules-reference.md` | Rules lookup, table rolling, OGL + BYOD search |
| `.kilo/agent/2d6mcp-character-creation.md` | UPP, characteristics, career paths, skills |
| `.kilo/agent/2d6mcp-byod.md` | BYOD sync, listing, inspection, troubleshooting |

Slash commands are in `.kilo/command/` for quick access to common operations.

## Build & Test

```bash
npm install           # install all workspace dependencies
npm run build         # compile all packages (tsc --build)
npm test              # run the Vitest suite
npm run typecheck     # type-check without emitting
npm run start         # run the MCP server (packages/server/dist/index.js)
npm run sync-byod     # list BYOD collections; pass a query or --root to index that scope
npm run version:check # assert lockstep SemVer across workspaces
```

Versioning is **SemVer 2.0 lockstep** (root + every `packages/*` share one version). MCP `server.version` is read from root `package.json`. See [VERSIONING.md](VERSIONING.md) for bump rules and [CHANGELOG.md](CHANGELOG.md) for release notes. Do not npm publish from this repo until the maintainer explicitly approves it.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGREE_BYOD_USE` | `"false"` | Set to `"true"` to enable BYOD mode |
| `BYOD_PATH` | — | Path to directory containing local RPG source files |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per chunk (500–50000) |
| `BYOD_CHUNK_OVERLAP` | `400` | Overlap between consecutive chunks |
| `BYOD_MAX_FILES` | `2000` | Maximum files to process per sync |
| `BYOD_MAX_CHUNKS_PER_FILE` | `500` | Maximum chunks from any single file |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Milliseconds per sync batch |
| `BYOD_NETWORK` | `"false"` | Force single-file index concurrency for high-latency filesystems |
| `BYOD_CONTENT_CACHE_PATH` | `data/byod/content_cache.db` | Shared content cache database |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | Path to custom OGL SQLite database |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | Path to custom DW SQLite database |
| `BRP_DB_PATH` | `data/brp/basic-roleplaying.db` | Path to custom BRP SQLite database |
| `SR5E_DB_PATH` | `data/5ecompatible/5ecompatible-srd.db` | Path to custom 5E-compatible SQLite database |
| `ORCUS_DB_PATH` | `data/orcus/orcus.db` | Path to custom Orcus SQLite database |
| `OSR_DB_PATH` | `data/osr/osr-procedures.db` | Path to OSR / B/X-compatible procedures database |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model |
| `MLX_LLM_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-4bit` | MLX LLM model |
| `SESSION_DB_PATH` | `~/.2d6mcp/sessions.db` | Session database location |
| `STT_BACKEND` | `mlx` | STT backend: `mlx` or `whispercpp` |
| `LLM_BACKEND` | `mlx` | LLM backend: `mlx`, `llamacpp`, or `ollama`. On Windows, default mlx falls back to ollama when `/api/tags` answers. |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama daemon URL (`LLM_BACKEND=ollama`) |
| `OLLAMA_MODEL` | `llama3.2:3b` | Ollama model name (`LLM_BACKEND=ollama`) |
| `LIVE_TRANSCRIPT_DB` | — | External companion SQLite path for `ingest_live_transcript` (`meetings` + `segments`) |
| `LIVE_TRANSCRIPT_ALLOW_PATHS` | — | Extra allowlisted paths for companion SQLite/NDJSON (colon or semicolon separated) |

## Live transcript companion

2d6mcp does not capture system loopback or microphone audio. Use an external live-transcript companion, or an NDJSON fixture for smoke tests without that app installed.

Companion SQLite schema: `meetings` (`id`, `title`, `started_at`, `duration_s`, …) and `segments` (`id`, `meeting_id`, `start_ms`, `end_ms`, `speaker`, `text`).

1. Run a compatible companion separately, or write NDJSON. `ndjson_file` works without a companion app.
2. Set `LIVE_TRANSCRIPT_DB` to the SQLite file and/or `LIVE_TRANSCRIPT_ALLOW_PATHS` for fixture files. Windows drive letters in those lists are kept intact.
3. Start a session with `session` `action: start`.
4. Poll `ingest_live_transcript` (`action: poll` or `ingest`) with that `session_id`. New segments are logged as voice/narration. Repeat during play; the per-session cursor is incremental and idempotent.
5. `action: status` shows the cursor; `action: reset_cursor` clears it. Paths outside the project root, `BYOD_PATH`, `LIVE_TRANSCRIPT_ALLOW_PATHS`, and `LIVE_TRANSCRIPT_DB` are rejected.

Outbound webhook tools are unchanged. System loopback / mic capture is out of scope for 2d6mcp.

## Session labels

`query_rules(system=ogl)` is 2d6 sci-fi SRD — not old-school fantasy. For B/X-style procedures use `system=osr` plus BYOD for the operator's local OSR/B/X shelf PDFs.

Set an optional durable `table_label` on `session` start so `get_session_context`, `search_transcript`, and `session list` can filter one table without mixing transcripts.

| Example | `rules_system` | `table_label` | Notes |
|---------|-----------------|---------------|-------|
| Sci-fi SRD table | `ogl` | `table-b` | Trade/encounter ticks via `roll_table(source=ogl)` — see recipes below |
| Personal files (BYOD) | `byod` | `table-b` | `byod_system` = collection folder; pin `root=parent/line` |
| B/X-style table | `osr` | `table-a` | `byod_system=osr`; full books via BYOD |
| Percentile table | `brp` | `campaign-label` | `roll(mechanic="coc", …)` for Hard/Extreme, bonus/penalty, SAN, opposed POW |

### Personal files (BYOD)

BYOD tooling is system-agnostic. `sync_byod` / `query_local_byod` / `root` / `relative_path` / `byod_system` work for any operator shelf folder. Pin with `root`/`relative_path` to stay inside one nested folder and avoid sibling collections.

`rules_system=byod` (or a session with `byod_system` set) means rulings prefer indexed personal files. Pass `rules_context` from `get_byod_chunk` into `synthesize_ruling` when you already have chunks.

Optional `roll` `difficulty` presets are generic operator targets (`average=8`, `difficult=10`, `very_difficult=12`, `impossible=16`). Ignored when `target` is set. `parse_character` needs `file_path` under the project or `BYOD_PATH`, or pasted `sheet_text`. `search_transcript` treats unquoted tokens as AND.

### OSR lookup vs commercial books

- Mid-session procedures: `query_rules(system=osr)` and `roll_table(source=osr)` (Monster Reaction, Morale Check, Hireling Reaction, Wandering Encounter Tick). Bundled text is original 2d6mcp AGPL wording, not a book dump.
- Full commercial books are BYOD only: local-only, consent-gated (`AGREE_BYOD_USE`), never uploaded, never committed. Example path (docs only): `/path/to/rpg-shelf`. `sync_byod(query="old-school")` then `query_local_byod`.
- Optional: `npm run populate-osr -- --source-dir <notes>` imports operator `.md`/`.txt` into the local DB. PDFs stay in BYOD. Never commit book PDFs or extracted dumps. Commercial rulebooks stay on the operator's licensed shelf.

### Multi-shelf BYOD

Consent (`AGREE_BYOD_USE` or `npm run setup`) is required. Point `BYOD_PATH` at the parent of game folders so each top-level directory is a collection. `sync_byod` with no args lists those folders; `query` or `system` indexes matches only; `relative_path` or `root` indexes a nested folder such as `parent/line`. High-latency mounts: `BYOD_NETWORK=true`. `query_local_byod` accepts the same `root` / `relative_path` pin so a family name does not search `edition-5-sibling`.

### Sci-fi trade and encounter recipes (`source=ogl`)

Do not paste commercial core-book text. Use the bundled OGL tables and these agent recipes:

1. List tables: `query_rules(system=ogl, category=list_tables)` or `roll_table(source=ogl)` with a known name.
2. Passage / patrons / random persons: `roll_table(table_name="Patron Encounter")`, `roll_table(table_name="Personal Encounter")`.
3. Wilderness or starship encounter ticks: `query_rules(system=ogl, search_term="encounter", category=worlds)` and `category=starships`.
4. Freight/trade: `query_rules(system=ogl, search_term="freight", category=trade)` (aliases: `Trade & Commerce`, `commerce`). Returns Open SRD freight rate (Cr1,000/ton per jump), speculative trade, passengers, and mail. Broker: `category=skills`. Trade codes/routes: `category=worlds`. `category=list_tables` has no commercial freight-lot matrix — use Population/starport as a guide, or BYOD if the operator indexed a licensed book.

### Percentile (CoC 7e-style) helpers

`roll(mechanic="coc", target=50, bonus_dice=1, penalty_dice=0, san_success="1", san_fail="1d6", opposed_target=40)` reports Hard (`floor(skill/2)`), Extreme (`floor(skill/5)`), success level, optional SAN loss, and opposed winner. Bonus and penalty dice cancel. Discord posting remains draft-only / operator-yes.

## License

This project uses a multi-license architecture:

- **Source code** (`packages/**`, root config files): [AGPL-3.0-only](LICENSE)
- **OGL game data** (`data/ogl/**`): [OGL v1.0a](OGL-1.0a.txt)
- **Dungeon World data** (`data/dw/**`): [CC-BY-3.0](data/dw/CC-BY-3.0.txt)
- **Basic Roleplaying data** (`data/brp/**`): [BRP Open Game License v1.0](data/brp/BRP-OGL-1.0.txt)
- **5E-compatible SRD data** (`data/5ecompatible/**`): [CC-BY-4.0](data/5ecompatible/SRD-NOTICE.txt). Populate clones Oldmanumby's markdown packaging into `.reference/SRD` ([oldmanumby/dnd.srd.5.2.1](https://github.com/oldmanumby/dnd.srd.5.2.1)); Oldmanumby did not author the SRD text.
- **OSR / B/X-compatible procedures** (`data/osr/**`): original 2d6mcp summaries ([NOTICE](data/osr/NOTICE.txt), AGPL); commercial rulebooks via BYOD only

The BRP logo (`BRP.png` in the project root and `data/brp/BRP.png`) is a trademark of Chaosium Inc., displayed in compliance with Section 15 of the BRP Open Game License v1.0.

![BRP logo](BRP.png)

You are granted permission to reproduce the logo only for the purpose of labeling derivative works under the BRP OGL.

Full license documentation: [LICENSE.md](LICENSE.md)

---

Copyright © 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
