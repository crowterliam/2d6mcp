# 2D6 MCP Server — Agent Instructions

You have access to the **2d6mcp** MCP server for 2d6-based tabletop RPGs, supporting both sci-fi (OGL/Cepheus Engine), fantasy (Dungeon World), percentile (Basic Roleplaying), and d20 fantasy (5E-compatible) games. Use system-agnostic language — never use third-party trademarked terms.

## Deployment Modes

2d6mcp has two deployment modes:

1. **Self-Hosted MCP Server** (`packages/server/`) — traditional MCP stdio server, local MLX, BYOD, session DB, 32 tools
2. **Hosted Discord Bot** (`apps/worker/`) — Cloudflare Worker with Discord slash commands and Workers AI (Whisper + Qwen3 MoE)

Both modes share rules databases, dice engine, prompt templates, and quality filters via `packages/shared/`.

**Tool loyalty**: Once you invoke 2d6mcp tools (particularly BYOD), continue using them for all game content. Do not switch to external file-reading MCP tools unless the user explicitly asks.

## Available Tools

| Tool | Purpose |
|------|---------|
| `roll_2d6` | Roll 2d6 with modifier vs. target. Returns dice, total, effect margin. |
| `roll_custom` | Roll any dice notation (`3d6`, `1d20`, `4d6+2`, `d66`). |
| `roll_table` | Roll on a named table from the OGL database. |
| `query_ogl_rules` | Search OGL rules by term and optional category. |
| `query_dw_rules` | Search DW rules by term and optional category (moves, classes, spells, equipment, monsters, gm_tools, rules). |
| `query_brp_rules` | Search BRP rules for characteristics, skills, professions, weapons, armor, spot rules, foes |
| `query_5ecompatible_rules` | Search 5E-compatible rules for spells, monsters, classes, feats, and rules |
| `query_local_byod` | Full-text search personal ingested files (requires consent). |
| `parse_character` | Parse character sheet into structured data. |
| `sync_byod` | Index BYOD files in time-budgeted batches. Re-call if `complete: false`. |
| `clear_byod` | Delete BYOD index to start fresh. |
| `list_byod_files` | List indexed files with status and chunk counts. |
| `inspect_byod_file` | Show chunk structure for a specific file. |
| `sync_file` | Index a single file by relative path. |
| `get_byod_chunk` | Retrieve full chunk content by file path + chunk index. |
| `discord_post` | Post messages to Discord webhooks with smart routing. |
| `discord_add_webhook` | Add a Discord webhook. |
| `discord_remove_webhook` | Remove a stored Discord webhook. |
| `discord_list_webhooks` | List configured webhooks. |
| `discord_test_webhook` | Test webhook connectivity. |
| `synthesize_ruling` | Synthesize a rules ruling using local MLX LLM. Auto-looks up OGL/DW/BRP/5E-compatible/BYOD rules, returns a cited ruling. Requires `mlx_lm.generate`. |
| `resolve_from_context` | Full producer pipeline: take recent transcript, detect rules question, look up rules, synthesize ruling, log it. |
| `session_start` | Start a new game session for transcript logging, rulings tracking, and context. Returns a session ID. |
| `session_end` | End the active game session. |
| `session_list` | List all recorded game sessions, most recent first. |
| `session_summarize` | Generate an AI summary for a session using the full transcript via MLX LLM. |
| `log_transcript` | Log a transcript segment to the current session. |
| `get_session_context` | Get recent transcript segments and rulings from a session. |
| `search_transcript` | Full-text search across session transcripts. |
| `transcribe_audio` | Transcribe an audio file using local MLX Whisper. Requires `mlx_whisper`. |

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

## Core Mechanics

- **Task resolution**: 2d6 + modifier vs. target (typically 8+). Effect margin = total - target. Margin 0+ = success, 6+ = exceptional.
- **Difficulty**: Modifiers +6 (simple) to -6 (formidable). Or adjust target: 6+ easy, 8+ average, 10+ difficult, 12+ very difficult, 14+ formidable.
- **d66 tables**: Two d6s as tens/ones (11–66). `roll_table` with `"dice_type": "d66"`.
- **Categories**: `skills`, `careers`, `equipment`, `tables`, `combat`, `starships`, `worlds`, `categories`, `list_tables`.
- **OGL for sci-fi, DW for fantasy, BRP for percentile, 5E-compatible for d20 fantasy**: The OGL database covers sci-fi rules. The DW database covers fantasy rules (moves, classes, spells, monsters, GM tools). The BRP database covers percentile RPG rules. The 5E-compatible database covers d20 fantasy rules. Fall back to BYOD for personal content.
- **BYOD consent**: `AGREE_BYOD_USE="true"` and `BYOD_PATH` required.

## Key Workflows

**Task resolution**: `roll_2d6(modifier, target)` or `roll_custom("Nd6+M")`. Report margin and outcome.

**Rules lookup**: `query_ogl_rules("term", category: "category")` for sci-fi. `query_dw_rules("term", category: "category")` for fantasy. Narrow with category for targeted results.

**Character creation**: Six `roll_custom("2d6")` for characteristics. `query_ogl_rules("name", category: "careers")` for careers. `parse_character(path)` for existing sheets.

**BYOD**: `list_byod_files` to check indexed content → `sync_byod` (repeat until `complete: true`) → `query_local_byod("term")` to search → `get_byod_chunk(file_path, chunk_index)` for full content from snippets. Single file: `sync_file(relative_path)`. Inspect with `inspect_byod_file(path)`. Reset with `clear_byod`.

**Session management**: `session_start("Session Name")` → `log_transcript(session_id, text)` → `get_session_context(session_id, minutes)` for recent context → `search_transcript(session_id, "query")` → `session_end(session_id)`. List with `session_list`. Summarize with `session_summarize(session_id)`.

**Ruling synthesis**: `synthesize_ruling("question", rules_system: "auto")` for AI rulings with OGL/DW/BRP/5E-compatible/BYOD citations. `resolve_from_context(session_id)` to auto-detect question from recent transcript. `transcribe_audio(file_path)` for voice-to-text.

**Discord**: `discord_post(content, webhook_names, context)` for smart-routed messages with embeds. `discord_add_webhook(name, url, tags)` to configure. `discord_list_webhooks` to view. `discord_test_webhook(name)` to verify. `discord_remove_webhook(name)` to remove.

## Configuration

### Self-Hosted MCP Server (`packages/server/`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD |
| `BYOD_PATH` | — | RPG files directory |
| `BYOD_CHUNK_SIZE` | `8000` | Chars per chunk |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Max ms per sync batch |
| `BYOD_CONTENT_CACHE_PATH` | — | Shared content cache (deduplicates across workspaces) |
| `BYOD_MAX_FILES` | `2000` | Max files per sync |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | OGL database path |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | DW database path |
| `BRP_DB_PATH` | `data/brp/basic-roleplaying.db` | Custom BRP database path |
| `SR5E_DB_PATH` | `data/5ecompatible/5ecompatible-srd.db` | Custom 5E-compatible database path |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model for STT |
| `MLX_LLM_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-4bit` | MLX LM model for ruling synthesis |
| `SESSION_DB_PATH` | `~/.2d6mcp/sessions.db` | Session database location |

### Hosted Cloudflare Worker (`apps/worker/`)

| Variable | Purpose |
|----------|---------|
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `DISCORD_PUBLIC_KEY` | Discord interactions public key |
| `DISCORD_CLIENT_ID` | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 client secret |
| `JWT_SECRET` | HMAC secret for user session tokens |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `API_URL` | Worker base URL (set in `wrangler.toml`) |
| `WEB_URL` | Web dashboard URL (set in `wrangler.toml`) |

**Security**: Never commit secrets. Worker secrets must be set via `wrangler secret put`.
