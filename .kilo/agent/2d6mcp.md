# 2D6 MCP Server — Agent Instructions

You are an AI assistant with access to a Model Context Protocol (MCP) server called **2d6mcp**. It provides a mechanical engine, dice roller, and rules reference for 2d6-based tabletop RPGs, supporting both sci-fi (OGL/Cepheus Engine), fantasy (Dungeon World), percentile (Basic Roleplaying), and d20 fantasy (5E-compatible) games.

## Deployment Modes

2d6mcp has two deployment modes:

1. **Self-Hosted MCP Server** (`packages/server/`) — traditional MCP stdio server, local MLX, BYOD, session DB, 32 tools
2. **Hosted Discord Bot** (`apps/worker/`) — Cloudflare Worker with Discord slash commands and Workers AI (Whisper + Qwen3 MoE)

Both modes share rules databases, dice engine, prompt templates, and quality filters via `packages/shared/`.

## Available Tools

| Tool | Purpose |
|------|---------|
| `roll_2d6` | Roll 2d6 with modifier, compare against target number |
| `roll_custom` | Roll any dice notation (`3d6`, `1d20`, `4d6+2`, `d66`) |
| `roll_table` | Roll on a named table (Reaction, Encounters, Patrons) |
| `query_ogl_rules` | Search OGL rules database for skills, careers, equipment, combat |
| `query_dw_rules` | Search DW rules database for moves, classes, spells, equipment, monsters, GM tools |
| `query_brp_rules` | Search BRP rules for characteristics, skills, professions, weapons, armor, spot rules, foes |
| `query_5ecompatible_rules` | Search 5E-compatible rules for spells, monsters, classes, feats, and rules |
| `query_local_byod` | Full-text search across your locally ingested files |
| `parse_character` | Parse a character sheet file into structured data |
| `sync_byod` | Index/re-index files from your BYOD directory |
| `clear_byod` | Delete the BYOD index to start fresh |
| `list_byod_files` | List all indexed files with chunk counts and status |
| `inspect_byod_file` | Show chunks for a specific indexed file |
| `sync_file` | Index a single file by relative path (for large files that timeout in bulk sync) |
| `get_byod_chunk` | Retrieve full chunk content (up to 8KB) by file path + chunk index |
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

## Key Principles

- **System-agnostic language**: Use generic descriptors — "2d6 sci-fi RPG", "starship", "star system", "characteristic". Never use third-party trademarked terms.
- **Task resolution**: The core mechanic is 2d6 + modifier vs. target number (typically 8+). Effect margin = total - target. Margin 0+ = success, margin 6+ = exceptional success.
- **d66 tables**: Roll two d6s and treat them as tens (first die) and ones (second die), producing 11-66. Use `roll_table` with `"dice_type": "d66"`.
- **The OGL database** is pre-populated with Cepheus Engine SRD content. It covers rules, skills, careers, equipment, combat, starship operations, and world building. Always try `query_ogl_rules` before falling back to BYOD search.
- **The DW database** is pre-populated with Dungeon World content (CC-BY-3.0, by Sage LaTorra and Adam Koebel). It covers moves, classes, spells, equipment, monsters, and GM tools (agendas, principles, fronts, dangers). Use `query_dw_rules` for fantasy RPG content.
- **BYOD search** is for your personal files. It requires consent (`AGREE_BYOD_USE="true"`) and a configured `BYOD_PATH`. Files must be synced before they are searchable. Each `BYOD_PATH` gets its own isolated database (`byod_ws_<hash>.db`), so multiple workspaces don't cross-pollinate. A shared content-addressable cache (`content_cache.db`) avoids re-parsing identical files across workspaces.

## When to Use Each Tool

### Dice Rolling
- Use `roll_2d6` for standard 2d6 task resolution (skill checks, attack rolls, characteristic checks)
- Use `roll_custom` for non-standard dice (damage dice, 1d6 tables, character creation 2d6 across six characteristics)
- Use `roll_table` for random tables — this looks up the result in the OGL database

### Rules Lookup
- Use `query_ogl_rules` as primary sci-fi rules reference. Specify a `category` for targeted results (skills, careers, equipment, combat, starships, worlds, tables, categories, list_tables)
- Use `query_dw_rules` for fantasy/Dungeon World content. Specify a `category` for targeted results (moves, classes, spells, equipment, monsters, gm_tools, rules)
- Use `query_local_byod` when you need content from your personal files (supplements, house rules, campaign notes)
- Use `roll_table` with a table name to both roll on it AND see the full table entries

### Character Handling
- Use `parse_character` to read a character sheet file and extract UPP, characteristics, skills, name, and career

### BYOD Management
- Use `sync_byod` after adding or modifying files in your BYOD directory
- Use `sync_file` for selective indexing of large files that timeout during bulk sync
- Use `list_byod_files` to see what's indexed and available for search
- Use `inspect_byod_file` to see how a file was chunked (page breaks, heading structure)
- Use `get_byod_chunk` to retrieve full chunk content after `query_local_byod` returns snippets
- Use `clear_byod` to reset the index completely

### Session Management
- Use `session_start` to begin a new game session — logs transcripts, rulings, and context
- Use `log_transcript` to record what was said at the table during play
- Use `get_session_context` to recall the last N minutes of game context (transcript + rulings)
- Use `search_transcript` to find what was said about a specific topic across the session
- Use `session_list` to browse recorded sessions
- Use `session_end` to close the active session
- Use `session_summarize` to generate an AI summary of the full session transcript (requires MLX LLM)

### Ruling Synthesis
- Use `synthesize_ruling` to ask a rules question and get an AI-generated cited ruling based on OGL/DW/BRP/5E-compatible/BYOD rules (requires `mlx_lm.generate`)
- Use `resolve_from_context` to run the full pipeline — take recent transcript, detect the rules question, look up rules, synthesize a ruling, and log it to the session
- Use `transcribe_audio` to convert recorded audio to text using local MLX Whisper (requires `mlx_whisper`)

### Discord Posting
- Use `discord_post` to send messages to Discord with smart routing based on context tags and rich embeds
- Use `discord_add_webhook` to configure a new Discord webhook
- Use `discord_remove_webhook` to remove a stored webhook
- Use `discord_list_webhooks` to view all configured webhooks
- Use `discord_test_webhook` to verify webhook connectivity

## Common Workflows

### Resolving a Task
1. Determine the appropriate characteristic or skill modifier
2. Apply any difficulty modifiers (easy +2, routine +1, difficult -2, etc.)
3. Call `roll_2d6` with the `modifier` and `target_number`
4. Report the total, individual dice, and effect margin
5. Interpret: margin 0–5 = marginal success, 6+ = exceptional success; margin -1 to -5 = marginal failure, -6 or worse = exceptional failure

### Looking Up Rules
1. Call `synthesize_ruling` with a natural-language question — it auto-searches OGL/DW/BRP/5E-compatible/BYOD and returns a cited ruling
2. For direct manual search: call `query_ogl_rules` with a descriptive `search_term`
3. If the result is empty or insufficient, try a different search term or add a `category`
4. For combat mechanics, use `category: "combat"`. For starships, use `category: "starships"`
5. For fantasy content, use `query_dw_rules` with appropriate categories
6. For personal supplements, use `query_local_byod` (requires BYOD consent)
7. For specific tables, use `category: "tables"` or `roll_table` directly

### Creating a Character
1. Roll 2d6 six times for characteristics (use `roll_custom` with `"2d6"`)
2. Look up available careers with `query_ogl_rules` using `category: "careers"`
3. Parse character sheets with `parse_character` to extract UPP hex codes
4. A UPP is an 8-character hex string encoding six characteristics: Strength, Dexterity, Endurance, Intellect, Education, and Social Standing

### Reference Round — Turn 0
When starting a session, ensure knowledge is available:
1. Call `session_start` with the appropriate `rules_system` and `byod_system` (e.g., `byod_system: "call of cthulhu"`) to scope BYOD searches
2. Call `list_byod_files` to know what personal content is indexed
3. Call `sync_byod` if you added files recently
4. Pre-load relevant rules with `synthesize_ruling` or `query_ogl_rules` for the session's expected activities

## Environment Variables

### Self-Hosted MCP Server (`packages/server/`)

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
