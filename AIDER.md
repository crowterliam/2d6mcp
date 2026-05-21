# Aider Convention: 2D6 MCP Server

This project is a Model Context Protocol (MCP) server for 2d6-based TTRPGs, supporting both sci-fi (OGL/Cepheus Engine) and fantasy (Dungeon World) games.

## Project Conventions

- **Tool loyalty**: Once 2d6mcp BYOD tools are invoked (`query_local_byod`, `get_byod_chunk`, `synthesize_ruling`), continue using them for all game content. Do not switch to external file-reading tools unless the user explicitly asks.
- **Naming**: Use system-agnostic language. Never reference third-party trademarks. Say "2d6 sci-fi RPG", "2d6 fantasy RPG", "starship", "star system", "characteristic", "move", "front", "monster".
- **Build**: `npm run build` (TypeScript → `dist/`). Test with `npm run start`.
- **License**: Source code is AGPL-3.0. Game data under `data/ogl/` is OGL v1.0a. Game data under `data/dw/` is CC-BY-3.0. See `LICENSE.md`.
- **Structure**: `src/dice/` (mechanics), `src/ogl/` (sci-fi rule database), `src/dw/` (fantasy rule database), `src/byod/` (file ingestion + content cache), `src/character/` (parsing), `src/audio/` (MLX Whisper transcription), `src/rulings/` (MLX LM synthesis), `src/session/` (session database), `src/tools/` (componentised handlers). Agent instructions in `.kilo/agent/`, `.claude/skills/`, `.cursor/rules/`, `.cline/rules/`, `.windsurfrules`.

## Available MCP Tools

| Tool | Purpose |
|------|---------|
| `roll_2d6` | 2d6 + modifier vs. target, effect margin |
| `roll_custom` | Any dice notation |
| `roll_table` | Named table from OGL database |
| `query_ogl_rules` | Search OGL rules (skills, careers, equipment, combat, starships, worlds) |
| `query_dw_rules` | Search DW rules (moves, classes, spells, equipment, monsters, GM tools) |
| `query_local_byod` | Search personal ingested files |
| `parse_character` | Parse character sheet to structured data |
| `sync_byod` | Index BYOD files (time-budgeted, re-call until complete) |
| `clear_byod` | Delete BYOD index |
| `list_byod_files` | List indexed files with status |
| `inspect_byod_file` | Show chunk structure for a file |
| `sync_file` | Index a single file by relative path |
| `get_byod_chunk` | Retrieve full chunk content by file path + chunk index |
| `discord_post` | Post messages to Discord webhooks with smart routing |
| `discord_add_webhook` | Add a Discord webhook with name, URL, tags |
| `discord_remove_webhook` | Remove a stored Discord webhook by name |
| `discord_list_webhooks` | List all configured webhooks (URLs masked) |
| `discord_test_webhook` | Send a test message to verify webhook connectivity |
| `synthesize_ruling` | Synthesize a rules ruling using local MLX LLM. Auto-looks up OGL/DW/BYOD rules, returns a cited ruling. Requires `mlx_lm.generate`. |
| `resolve_from_context` | Full producer pipeline: take recent session transcript, detect rules question, look up rules, synthesize ruling, log it. |
| `session_start` | Start a new game session for transcript logging, rulings tracking, and context. Returns a session ID. |
| `session_end` | End the active game session. |
| `session_list` | List all recorded game sessions, most recent first. |
| `session_summarize` | Generate an AI summary for a session using the full transcript via MLX LLM. |
| `log_transcript` | Log a transcript segment to the current session — what was just said at the table. |
| `get_session_context` | Get recent transcript segments and rulings from a session — the last N minutes of game context. |
| `search_transcript` | Full-text search across session transcripts — find what was said about a topic. |
| `transcribe_audio` | Transcribe an audio file using local MLX Whisper. Requires `mlx_whisper` to be installed. |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD |
| `BYOD_PATH` | — | RPG files directory |
| `BYOD_CHUNK_SIZE` | `8000` | Chars per chunk |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Sync batch time limit |
| `BYOD_MAX_FILES` | `2000` | Max files per sync |
| `BYOD_CONTENT_CACHE_PATH` | `data/byod/content_cache.db` | Shared content cache database |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | OGL database path |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | DW database path |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model for STT |
| `MLX_LLM_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-4bit` | MLX LM model for ruling synthesis |
| `SESSION_DB_PATH` | `~/.2d6mcp/sessions.db` | Session database location |
