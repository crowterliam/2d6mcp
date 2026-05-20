# Aider Convention: 2D6 MCP Server

This project is a Model Context Protocol (MCP) server for 2d6-based TTRPGs, supporting both sci-fi (OGL/Cepheus Engine) and fantasy (Dungeon World) games.

## Project Conventions

- **Naming**: Use system-agnostic language. Never reference third-party trademarks. Say "2d6 sci-fi RPG", "2d6 fantasy RPG", "starship", "star system", "characteristic", "move", "front", "monster".
- **Build**: `npm run build` (TypeScript → `dist/`). Test with `npm run start`.
- **License**: Source code is AGPL-3.0. Game data under `data/ogl/` is OGL v1.0a. Game data under `data/dw/` is CC-BY-3.0. See `LICENSE.md`.
- **Structure**: `src/dice/` (mechanics), `src/ogl/` (sci-fi rule database), `src/dw/` (fantasy rule database), `src/byod/` (file ingestion + content cache), `src/character/` (parsing). Agent instructions in `.kilo/agent/`, `.claude/skills/`, `.cursor/rules/`, `.cline/rules/`, `.windsurfrules`.

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
