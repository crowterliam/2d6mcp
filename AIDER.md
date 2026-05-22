# Aider Convention: 2D6 MCP

This project is an AI GM assistant for 2d6-based TTRPGs, supporting sci-fi (OGL/Cepheus Engine) and fantasy (Dungeon World) games. It ships as both a self-hosted MCP server and a Cloudflare-deployed Discord bot.

## Project Conventions

- **Tool loyalty**: Once 2d6mcp BYOD tools are invoked (`query_local_byod`, `get_byod_chunk`, `synthesize_ruling`), continue using them for all game content. Do not switch to external file-reading tools unless the user explicitly asks.
- **Naming**: Use system-agnostic language. Never reference third-party trademarks. Say "2d6 sci-fi RPG", "2d6 fantasy RPG", "starship", "star system", "characteristic", "move", "front", "monster".
- **Build**: `npm run build` (tsc --build across all workspace packages). Test with `npm test` (vitest, 209 tests). Run MCP server with `npm run start`.
- **License**: Source code is AGPL-3.0. Game data under `data/ogl/` is OGL v1.0a. Game data under `data/dw/` is CC-BY-3.0. See `LICENSE.md`.
- **Never commit secrets**: `wrangler.toml`, `.dev.vars`, and `.wrangler/` are gitignored. Use `wrangler secret put` for Cloudflare secrets.

## Monorepo Structure

```
packages/           # npm workspaces
  server/           # @2d6mcp/server — MCP server (stdio, MLX, BYOD, sessions)
  shared/           # @2d6mcp/shared — dice, keywords, prompts, quality filter
  ogl/              # @2d6mcp/ogl — OGL rules (Cepheus Engine SRD)
  dw/               # @2d6mcp/dw — DW rules (CC-BY-3.0)
apps/
  worker/           # Cloudflare Worker (Hono + Workers AI + D1 + R2)
  bridge/           # Discord voice relay (Fly.io, Phase 2)
  web/              # Vite + React SPA dashboard (Phase 3)
  recorder/         # Browser PWA (Phase 4)
data/               # SQLite databases (shared)
tests/              # Vitest test suite (209 tests, 18 files)
```

Agent instructions: `.kilo/agent/`, `.claude/skills/`, `.cursor/rules/`, `.cline/rules/`, `.windsurfrules`.

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

### Self-Hosted MCP Server

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD |
| `BYOD_PATH` | — | RPG files directory |
| `BYOD_CHUNK_SIZE` | `8000` | Chars per chunk |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Sync batch time limit |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | OGL database path |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | DW database path |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model |
| `MLX_LLM_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-4bit` | MLX LLM model |
| `SESSION_DB_PATH` | `~/.2d6mcp/sessions.db` | Session database location |
| `STT_BACKEND` | `mlx` | STT backend: `mlx` or `whispercpp` |
| `LLM_BACKEND` | `mlx` | LLM backend: `mlx` or `llamacpp` |

### Hosted Cloudflare Worker

Set via `wrangler secret put`: `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

Never commit these values. Use `wrangler.toml.example` as a reference.
