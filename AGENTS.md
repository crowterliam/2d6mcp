# 2D6 MCP — Agent Instructions

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

## Project Identity

This project provides two deployment modes for a 2d6-based tabletop RPG AI assistant:

1. **Self-Hosted MCP Server** (`packages/server/`) — stdio transport, local MLX, BYOD, session DB, 32 tools
2. **Hosted Cloudflare Worker** (`apps/worker/`) — Discord bot, Workers AI (Whisper + Qwen3 MoE), D1, R2, OAuth2

Both modes share the same rules databases (OGL/Cepheus Engine SRD for sci-fi, Dungeon World CC-BY-3.0 for fantasy, Basic Roleplaying SRD for percentile RPGs, 5E-compatible SRD CC-BY-4.0 for d20 fantasy), dice engine, prompt templates, and quality filters via `packages/shared/`.

The project is system-agnostic and avoids all third-party trademarks.

## Architecture

```
2d6mcp/                          # npm workspaces monorepo
├── apps/
│   └── worker/                  # Cloudflare Worker (Hono + Workers AI + D1 + R2)
├── packages/
│   ├── server/                  # MCP server (stdio transport, local MLX, BYOD)
│   ├── shared/                  # @2d6mcp/shared — dice, keywords, prompts, quality filter
│   ├── ogl/                     # @2d6mcp/ogl — OGL SQLite queries
│   ├── dw/                      # @2d6mcp/dw — DW SQLite queries
│   ├── brp/                     # @2d6mcp/brp — BRP SQLite queries
│   └── 5ecompatible/            # @2d6mcp/5ecompatible — 5E-compatible SQLite queries
├── data/
│   ├── ogl/cepheus.db           # Bundled OGL database
│   ├── dw/dungeon-world.db      # Bundled DW database
│   ├── brp/basic-roleplaying.db # Bundled BRP database
│   └── 5ecompatible/5ecompatible-srd.db  # Bundled 5E-compatible database
└── tests/                       # Vitest test suite (209 tests)
```

## Build & Test Commands

```bash
npm install              # install all workspace dependencies
npm run build            # compile all packages (tsc --build)
npm run start            # run MCP server (packages/server/dist/index.js)
npm test                 # run test suite (vitest, 209 tests)
npm run test:watch       # run tests in watch mode
npm run test:coverage    # run tests with coverage
npm run setup            # create BYOD consent token
npm run populate-ogl     # regenerate OGL SQLite database
npm run populate-dw      # regenerate DW SQLite database
npm run populate-brp     # regenerate BRP SQLite database
npm run populate-5ecompatible  # regenerate 5E-compatible SQLite database
```

### Worker-specific commands (in `apps/worker/`)

```bash
npm run dev              # wrangler dev (local dev server)
npm run deploy           # wrangler deploy (production)
npm run db:migrate       # run D1 schema migration
npm run db:migrate:local # run D1 migration against local dev DB
```

## Agent Modes

Specialised agent instructions are available for multiple AI coding harnesses:

### Kilo Code (`.kilo/agent/`)

| Agent File | Domain |
|-----------|--------|
| `.kilo/agent/2d6mcp.md` | Master reference — all tools, workflows, environment vars |
| `.kilo/agent/2d6mcp-task-resolution.md` | Dice rolling, effect margins, difficulty, boon/bane |
| `.kilo/agent/2d6mcp-rules-reference.md` | Rules lookup, table rolling, OGL + BYOD search |
| `.kilo/agent/2d6mcp-character-creation.md` | UPP, characteristics, career paths, skills |
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
| `.claude/skills/2d6mcp-task-resolution/SKILL.md` | Dice rolling, effect margins, difficulty, boon/bane |
| `.claude/skills/2d6mcp-rules-reference/SKILL.md` | Rules lookup, table rolling, OGL + BYOD search |
| `.claude/skills/2d6mcp-character-creation/SKILL.md` | UPP, characteristics, career paths, skills |
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
  server.ts         # Server class, tool registration
  config.ts         # Environment config + BYOD gate
  cli.ts            # CLI entry for setup/populate commands
  dice/
    roller.ts       # Dice notation parser, 2d6 resolution (IMPORTS from @2d6mcp/shared)
    tables.ts       # d66 / 2d6 table rolling
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
  byod/
    gate.ts         # Consent gate check
    ingest.ts       # File walking, PDF/text/md parsing
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
    mlx-synthesize.ts  # MLX LM + llama.cpp backend dispatch, quality filter
    backends/
      llamacpp.ts      # llama.cpp LLM backend (Win/Linux)
  session/
    database.ts        # Session SQLite (transcripts, rulings, progress)
    schema.sql.ts      # DDL for sessions, segments, rulings, transcription_progress
  tools/               # Componentised tool handlers
    helpers.ts         # Shared helpers, keyword extraction, fuzzy matching
    definitions.ts     # All tool JSON schemas
    index.ts           # Handler dispatch table

apps/worker/src/
  index.ts             # Hono entry, CORS, route mounting
  env.ts               # Typed Cloudflare bindings (AI, D1, R2, secrets)
  types.ts             # Shared types for D1 rows, API payloads, JWT
  middleware/
    auth.ts            # JWT verification, Discord Ed25519 (tweetnacl)
    jwt.ts             # Web Crypto API JWT sign/verify
    rate-limit.ts      # D1-backed per-guild rate limiting
  routes/
    interactions.ts    # Discord Interactions endpoint (slash commands)
    api.ts             # /api/ask, /api/roll, /api/transcribe, /api/warm, /api/health
    auth.ts            # Discord OAuth2 (/api/auth/login, /callback, /me)
    billing.ts         # Stripe checkout, portal, webhook
    guild.ts           # Guild-scoped session CRUD
  services/
    whisper.ts         # Workers AI Whisper wrapper
    llm.ts             # Workers AI Qwen3 MoE + Llama 3.2 3B fallback
    synthesize.ts      # FTS5 rules search → prompt → LLM → quality filter
  db/
    schema.sql         # D1 schema: guilds, sessions, transcripts, rulings, FTS5 rules
    queries.ts         # Typed prepared statements

packages/shared/src/
  index.ts             # Re-exports all modules
  dice.ts              # parseDiceNotation, roll2d6, rollCustom
  tables.ts            # rollOnTable, normalizeDiceType, rollD66
  keywords.ts          # extractKeywords, fuzzyAlternatives, fuzzyKeywordList, STOPWORDS
  prompts.ts           # DEFAULT_SYSTEM_PROMPT, SYSTEM_PROMPT_LARGE, quality filter
  types.ts             # Shared interfaces (RulingResult, RulingSource, etc.)
```

## Available Tools

### MCP Server Tools (Self-Hosted, `packages/server/`)

| Tool | Purpose |
|------|---------|
| `roll_2d6` | Roll 2d6 with modifier, compare against target |
| `roll_custom` | Roll any dice notation (`3d6`, `d66`, `4d6+2`) |
| `roll_table` | Roll on a named table from OGL database |
| `query_ogl_rules` | Search OGL rules for skills, careers, equipment, tables |
| `query_dw_rules` | Search DW rules for moves, classes, spells, equipment, monsters, GM tools |
| `query_brp_rules` | Search BRP rules for characteristics, skills, professions, weapons, armor, spot rules, foes |
| `query_5ecompatible_rules` | Search 5E-compatible rules for spells, monsters, classes, feats |
| `query_local_byod` | Full-text search across personal ingested files |
| `parse_character` | Parse character sheet into structured data |
| `sync_byod` | Index/re-index files from BYOD directory |
| `clear_byod` | Delete BYOD index to start fresh |
| `list_byod_files` | List indexed files with status and chunk counts |
| `inspect_byod_file` | Show chunk structure for a specific file |
| `sync_file` | Index a single file by relative path (for large files that timeout in bulk sync) |
| `get_byod_chunk` | Retrieve full chunk content by file path + chunk index |
| `discord_post` | Post messages to Discord webhooks with smart routing based on context tags |
| `discord_add_webhook` | Add a Discord webhook with name, URL, tags, and description |
| `discord_remove_webhook` | Remove a stored Discord webhook by name |
| `discord_list_webhooks` | List all configured webhooks (URLs partially masked) |
| `discord_test_webhook` | Send a test message to verify webhook connectivity |
| `synthesize_ruling` | Synthesize a rules ruling using local MLX LLM. Auto-looks up OGL/DW/BRP/5E-compatible/BYOD rules, returns a cited ruling. Requires `mlx_lm.generate`. |
| `resolve_from_context` | Full producer pipeline: take recent session transcript, detect rules question, look up rules, synthesize ruling, log it. |
| `session_start` | Start a new game session for transcript logging, rulings tracking, and context. Returns a session ID. |
| `session_end` | End the active game session. |
| `session_list` | List all recorded game sessions, most recent first. |
| `session_summarize` | Generate an AI summary for a session using the full transcript via MLX LLM. |
| `log_transcript` | Log a transcript segment to the current session — what was just said at the table. |
| `get_session_context` | Get recent transcript segments and rulings from a session — the last N minutes of game context. |
| `search_transcript` | Full-text search across session transcripts — find what was said about a topic. |
| `transcribe_audio` | Transcribe an audio file using local MLX Whisper. Requires `mlx_whisper` to be installed. |
| `list_transcriptions` | List all in-progress audio transcriptions with chunk progress. |
| `clear_transcription` | Reset transcription progress for a specific file, or clear all state. |
| `delete_session` | Permanently delete a session and all its transcript segments and rulings. |

### Discord Bot Commands (Hosted, `apps/worker/`)

| Command | Description |
|---------|-------------|
| `/ask <question>` | AI ruling with FTS5 rules search + Qwen3 MoE + quality filter |
| `/roll <notation>` | Dice rolling |
| `/session start <name>` | Start a game session |
| `/session end` | End the current session |
| `/session context [minutes]` | View recent transcript and rulings |
| `/search <query>` | FTS search across session transcripts |
| `/help` | Show available commands |

## Session Management & Ruling Synthesis

### Self-Hosted (MLX)

- **Session lifecycle**: Start with `session_start`, log with `log_transcript`, end with `session_end`.
- **BYOD system scoping**: Pass `byod_system` to `session_start` to filter BYOD searches.
- **Ruling synthesis**: `synthesize_ruling` auto-looks up OGL/DW/BRP/5E-compatible/BYOD rules, passes to MLX LLM, returns cited ruling with quality filter.
- **Audio transcription**: `transcribe_audio` processes files in 2-minute chunks with progress tracking. Call repeatedly until `complete: true`.

### Hosted (Cloudflare Workers AI)

- **Discord slash commands**: `/ask` defers response (3s Discord timeout), calls Workers AI Qwen3 MoE, follows up with embed.
- **FTS5 rules search**: D1 FTS5 queries with phrase-pair detection and OGL-preference weighting.
- **Quality filter**: Shared `filterRulingQuality` from `@2d6mcp/shared` validates numbers against source text.
- **Rate limiting**: 1 `/ask` per 10 seconds per guild, D1-backed counters.

## Cross-Platform Backends

### Self-Hosted

| Platform | STT Backend | LLM Backend |
|---|---|---|
| macOS (default) | `mlx` (MLX Whisper) | `mlx` (MLX LM) |
| Windows/Linux | `whispercpp` (whisper.cpp) | `llamacpp` (llama.cpp) |

### Hosted

| Service | Model |
|---|---|
| STT | `@cf/openai/whisper-large-v3-turbo` (Workers AI) |
| LLM | `@cf/qwen/qwen3-30b-a3b-fp8` (Workers AI, primary) |
| LLM fallback | `@cf/meta/llama-3.2-3b-instruct` (Workers AI) |

## Multi-License Architecture

- All `.ts` source files: AGPL-3.0
- All files under `data/ogl/`: OGL v1.0a
- All files under `data/dw/`: CC-BY-3.0
- All files under `data/brp/`: BRP OGL v1.0
- All files under `data/5ecompatible/`: CC-BY-4.0
- `LICENSE.md` describes the firewall in detail
- `OGL-1.0a.txt` contains the full OGL text with Cepheus SRD copyright attributions
- `data/dw/CC-BY-3.0.txt` contains the full CC-BY-3.0 license text
- `data/dw/ATTRIBUTION` contains Dungeon World derivation and attribution details
- `data/5ecompatible/SRD-NOTICE.txt` contains 5E-compatible SRD attribution details

## BYOD Consent Gate

The server checks for `AGREE_BYOD_USE="true"` env var OR the presence of a `.mcp-byod-consent-accepted` token file in the project root before enabling BYOD tools. Without consent, BYOD tools return a clear disclaimer message. BYOD is self-hosted only — not available in the hosted Cloudflare Worker.

## Naming Conventions

Never reference any third-party game system or trademarked terms. Use generic descriptors: "2d6 sci-fi RPG", "2d6 fantasy RPG", "starship", "star system", "characteristic", "move", "front", "monster", etc.

**Tool loyalty**: Once 2d6mcp tools are invoked (particularly BYOD — `query_local_byod`, `get_byod_chunk`, `synthesize_ruling`), continue using them for all game content. Do not switch to external file-reading MCP tools unless the user explicitly asks.

## Environment Variables

### Self-Hosted MCP Server

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD mode |
| `BYOD_PATH` | `.reference/` (auto-discovered in project root if not set) | Directory of local source files |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per chunk (500–50000) |
| `BYOD_CHUNK_OVERLAP` | `400` | Overlap between chunks |
| `BYOD_MAX_FILES` | `2000` | Max files per sync |
| `BYOD_MAX_CHUNKS_PER_FILE` | `500` | Max chunks per file |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Max ms per sync batch |
| `BYOD_CONTENT_CACHE_PATH` | `data/byod/content_cache.db` | Shared content-addressable cache path |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | Custom OGL database path |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | Custom DW database path |
| `BRP_DB_PATH` | `data/brp/basic-roleplaying.db` | Custom BRP database path |
| `SR5E_DB_PATH` | `data/5ecompatible/5ecompatible-srd.db` | Custom 5E-compatible database path |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model for STT |
| `MLX_LLM_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-4bit` | MLX LM model for ruling synthesis |
| `SESSION_DB_PATH` | `~/.2d6mcp/sessions.db` | Session database location |
| `STT_BACKEND` | `mlx` | STT backend: `mlx` (macOS) or `whispercpp` (Win/Linux) |
| `LLM_BACKEND` | `mlx` | LLM backend: `mlx` (macOS) or `llamacpp` (Win/Linux) |
| `WHISPERCPP_MODEL` | `ggml-large-v3-turbo.bin` | whisper.cpp model path (Win/Linux) |
| `LLAMACPP_MODEL` | `Llama-3.2-3B-Instruct.Q4_K_M.gguf` | llama.cpp model path (Win/Linux) |

### Hosted Cloudflare Worker

| Variable | Purpose |
|----------|---------|
| `DISCORD_BOT_TOKEN` | Discord bot token (set via `wrangler secret put`) |
| `DISCORD_PUBLIC_KEY` | Discord interactions public key |
| `DISCORD_CLIENT_ID` | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 client secret |
| `JWT_SECRET` | HMAC secret for user session tokens |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `API_URL` | Worker base URL (set in `wrangler.toml`) |
| `WEB_URL` | Web dashboard URL (set in `wrangler.toml`) |

### Security Note

**Never commit secrets to the repository.** `wrangler.toml` is gitignored — use `wrangler.toml.example` as a template. All secrets for the Cloudflare Worker must be set via `wrangler secret put`. `.dev.vars` is gitignored for local development. The self-hosted MCP server reads secrets from environment variables only — never from committed files.
