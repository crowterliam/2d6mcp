# 2D6 MCP Server — Agent Instructions

You have access to a Model Context Protocol (MCP) server called **2d6mcp**. It provides a mechanical engine, dice roller, and rules reference for 2d6-based tabletop RPGs, supporting both sci-fi (OGL/Cepheus Engine), fantasy (Dungeon World), percentile (Basic Roleplaying), and d20 fantasy (5E-compatible) games. Use system-agnostic language: "2d6 sci-fi RPG", "2d6 fantasy RPG", "starship", "star system", "characteristic", "move", "front", "monster". Never use third-party trademarked terms.

## Deployment Modes

2d6mcp has two deployment modes:

1. **Self-Hosted MCP Server** (`packages/server/`) — traditional MCP stdio server, local MLX, BYOD, session DB, 32 tools
2. **Hosted Discord Bot** (`apps/worker/`) — Cloudflare Worker with Discord slash commands and Workers AI (Whisper + Qwen3 MoE)

Both modes share rules databases, dice engine, prompt templates, and quality filters via `packages/shared/`.

**Tool loyalty**: Once you invoke 2d6mcp tools (particularly BYOD), continue using them for all game content. Do not switch to external file-reading MCP tools (PDF readers, etc.) unless the user explicitly asks you to examine a file outside the indexed BYOD content.

## Available Tools

| Tool | Purpose |
|------|---------|
| `roll_2d6` | Roll 2d6 with modifier, compare against target number. Returns dice, total, effect margin. |
| `roll_d20` | Roll d20 with modifier, advantage/disadvantage, AC/DC comparison. Returns dice, hit/miss, critical (nat 20), fumble (nat 1). |
| `roll_percentile` | Roll d100 with BRP-style roll-under. Returns tens/ones dice, total, success, critical (≤5%), fumble (96-100). |
| `roll_damage` | Roll damage dice with optional type (e.g., `"2d6+3 fire"`, `"1d8 piercing"`). Returns dice, total, damage type. |
| `roll_custom` | Roll any dice notation (`3d6`, `1d20`, `4d6+2`, `d66`). |
| `roll_table` | Roll on a named table from any rules system. Use `system` param (ogl/dw/brp/5ecompatible/orcus) to specify database. |
| `query_ogl_rules` | Search OGL rules database. Use `category` for targeted results: skills, careers, equipment, tables, combat, starships, worlds, categories, list_tables. |
| `query_dw_rules` | Search DW rules database. Use `category` for targeted results: moves, classes, spells, equipment, monsters, gm_tools, rules. |
| `query_brp_rules` | Search BRP rules for characteristics, skills, professions, weapons, armor, spot rules, foes |
| `query_5ecompatible_rules` | Search 5E-compatible rules for spells, monsters, classes, feats, and rules |
| `query_orcus_rules` | Search Orcus 4e-compatible rules for classes, monsters, feats, and core rules |
| `query_local_byod` | Full-text search across your locally ingested files. Requires BYOD consent. |
| `parse_character` | Parse a character sheet file into structured data (UPP, characteristics, skills, name, career). |
| `sync_byod` | Index/re-index files from BYOD directory. Runs in time-budgeted batches. Returns `complete: false` if more remain — re-call. |
| `clear_byod` | Delete the BYOD index to start fresh. |
| `list_byod_files` | List all indexed files with chunk counts and status (indexed/failed). |
| `inspect_byod_file` | Show chunk structure for a specific indexed file (relative_path required). |
| `sync_file` | Index a single file by relative path (for large files or selective indexing). |
| `get_byod_chunk` | Retrieve full chunk content by file path + chunk index. |
| `discord_post` | Post messages to Discord webhooks with smart routing based on context tags. |
| `discord_add_webhook` | Add a Discord webhook with name, URL, tags, and description. |
| `discord_remove_webhook` | Remove a stored Discord webhook by name. |
| `discord_list_webhooks` | List all configured webhooks (URLs partially masked). |
| `discord_test_webhook` | Send a test message to verify webhook connectivity. |
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

- **Task resolution by system**:
  - **2d6 (OGL/DW)**: 2d6 + modifier vs. target (typically 8+). Effect margin = total - target. Use `roll_2d6`.
  - **d20 (5E/Orcus)**: d20 + modifier vs. AC/DC. Nat 20 = critical hit, nat 1 = fumble. Use `roll_d20` with advantage/disadvantage.
  - **d100 (BRP/CoC)**: Roll under target. ≤5% = critical, 96-100 = fumble. Use `roll_percentile`.
  - **Damage**: Use `roll_damage("2d6+3 fire")` for weapon damage.
- **d66 tables**: Two d6s as tens and ones (11–66). Use `roll_table` with `"dice_type": "d66"`.
- **Difficulty (2d6)**: Modifiers range from +6 (simple) to -6 (formidable). Or adjust target: easy = 6+, average = 8+, difficult = 10+, very difficult = 12+, formidable = 14+.
- **OGL for sci-fi, DW for fantasy, BRP for percentile, 5E-compatible for d20 fantasy, Orcus for 4e-compatible, BYOD for personal content**: The OGL database covers sci-fi core rules. The DW database covers fantasy rules. The BRP database covers percentile RPG rules. The 5E-compatible database covers d20 fantasy rules. The Orcus database covers 4e-compatible rules. Fall back to BYOD for supplements and house rules.
- **BYOD requires consent**: Set `AGREE_BYOD_USE="true"` and configure `BYOD_PATH`. Files must be synced before searchable.

## Key Workflows

### Task Resolution
1. Determine modifier (skill + characteristic bonus + difficulty)
2. Call `roll_2d6(modifier, target)` for 2d6 systems, `roll_d20(modifier, target, advantage)` for d20 systems, or `roll_percentile(target)` for d100 systems
3. For damage: `roll_damage("2d6+3 fire")`
4. Report total, individual dice, and narrative outcome (hit/miss, critical, fumble, effect margin, etc.)

### Rules Lookup
1. Call `query_ogl_rules("search term", category: "category_name")` for sci-fi content
2. Call `query_dw_rules("search term", category: "category_name")` for fantasy content
3. Call `query_brp_rules("search term", category: "category_name")` for percentile RPG content
4. Call `query_5ecompatible_rules("search term", category: "category_name")` for d20 fantasy content
5. Call `query_orcus_rules("search term", category: "category_name")` for 4e-compatible content
6. Narrow with category if results are broad
7. For tables, use `roll_table("Table Name", system: "system_name")`

### Character Creation
1. Roll six characteristics: `roll_custom("2d6")` × 6
2. Look up careers: `query_ogl_rules("career name", category: "careers")`
3. Qualify, survive terms, advance, roll skills, muster out
4. Parse existing sheets: `parse_character(file_path)`

### BYOD Management
1. Check indexed content: `list_byod_files`
2. Sync new/changed files: `sync_byod` (re-call until `complete: true`)
3. Inspect structure: `inspect_byod_file(relative_path)`
4. Search personal content: `query_local_byod("search term")`
5. Index a single file: `sync_file(relative_path)`
6. Get full chunk content: `get_byod_chunk(file_path, chunk_index)` (after search returns snippets)
7. Start fresh: `clear_byod`

### Session Management
1. Start session: `session_start("Session Name")` — returns session ID
2. Log table talk: `log_transcript(session_id, text, speaker, source, intent)`
3. Get recent context: `get_session_context(session_id, minutes)` — returns transcripts and rulings
4. Search history: `search_transcript(session_id, "query")` — find past mentions
5. List sessions: `session_list(limit)`
6. End session: `session_end(session_id)`
7. Summarize: `session_summarize(session_id)` (requires MLX LLM)

### Ruling Synthesis
1. Ask a question: `synthesize_ruling("question", rules_system: "auto")` — AI ruling with citations
2. Context resolution: `resolve_from_context(session_id)` — auto-detect question from recent transcript
3. Audio: `transcribe_audio(file_path)` — voice-to-text (requires `mlx_whisper`)

### Discord Posting
1. Post: `discord_post(content, webhook_names, context)` — smart routing, rich embeds
2. Configure: `discord_add_webhook(name, url, tags, description)`
3. Inspect: `discord_list_webhooks`
4. Verify: `discord_test_webhook(name)`
5. Remove: `discord_remove_webhook(name)`

## Configuration

### Self-Hosted MCP Server (`packages/server/`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD mode |
| `BYOD_PATH` | — | Directory of local RPG source files |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per chunk |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Max ms per sync batch |
| `BYOD_CONTENT_CACHE_PATH` | — | Shared content cache path (deduplicates across workspaces) |
| `BYOD_MAX_FILES` | `2000` | Max files per sync |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | Custom OGL database path |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | Custom DW database path |
| `BRP_DB_PATH` | `data/brp/basic-roleplaying.db` | Custom BRP database path |
| `SR5E_DB_PATH` | `data/5ecompatible/5ecompatible-srd.db` | Custom 5E-compatible database path |
| `ORCUS_DB_PATH` | `data/orcus/orcus.db` | Custom Orcus database path |
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
