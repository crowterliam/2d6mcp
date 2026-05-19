# Aider Convention: 2D6 MCP Server

This project is a Model Context Protocol (MCP) server for generic 2d6-based sci-fi TTRPGs.

## Project Conventions

- **Naming**: Use system-agnostic language. Never reference third-party trademarks. Say "2d6 sci-fi RPG", "starship", "star system", "characteristic".
- **Build**: `npm run build` (TypeScript → `dist/`). Test with `npm run start`.
- **License**: Source code is AGPL-3.0. Game data under `data/ogl/` is OGL v1.0a. See `LICENSE.md`.
- **Structure**: `src/dice/` (mechanics), `src/ogl/` (rule database), `src/byod/` (file ingestion), `src/character/` (parsing). Agent instructions in `.kilo/agent/`, `.claude/skills/`, `.cursor/rules/`, `.cline/rules/`, `.windsurfrules`.

## Available MCP Tools

| Tool | Purpose |
|------|---------|
| `roll_2d6` | 2d6 + modifier vs. target, effect margin |
| `roll_custom` | Any dice notation |
| `roll_table` | Named table from OGL database |
| `query_ogl_rules` | Search OGL rules (skills, careers, equipment, combat, starships, worlds) |
| `query_local_byod` | Search personal ingested files |
| `parse_character` | Parse character sheet to structured data |
| `sync_byod` | Index BYOD files (time-budgeted, re-call until complete) |
| `clear_byod` | Delete BYOD index |
| `list_byod_files` | List indexed files with status |
| `inspect_byod_file` | Show chunk structure for a file |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD |
| `BYOD_PATH` | — | RPG files directory |
| `BYOD_CHUNK_SIZE` | `8000` | Chars per chunk |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Sync batch time limit |
| `BYOD_MAX_FILES` | `2000` | Max files per sync |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | OGL database path |
