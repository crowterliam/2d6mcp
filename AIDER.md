# Aider Convention: 2D6 MCP

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

This project is an AI GM assistant for 2d6-based TTRPGs, supporting sci-fi (OGL/Cepheus Engine), fantasy (Dungeon World), percentile (Basic Roleplaying), and d20 fantasy (5E-compatible) games. It ships as a self-hosted MCP server.

## Project Conventions

- **Tool loyalty**: Once 2d6mcp BYOD tools are invoked (`query_local_byod`, `get_byod_chunk`, `synthesize_ruling`), continue using them for all game content. Do not switch to external file-reading tools unless the user explicitly asks.
- **Naming**: Use system-agnostic language. Never reference third-party trademarks. Say "2d6 sci-fi RPG", "2d6 fantasy RPG", "starship", "star system", "characteristic", "move", "front", "monster".
- **Build**: `npm run build` (tsc --build across all workspace packages). Test with `npm test` (vitest). Run MCP server with `npm run start`.
- **License**: Source code is AGPL-3.0. Game data under `data/ogl/` is OGL v1.0a. Game data under `data/dw/` is CC-BY-3.0. Game data under `data/brp/` is BRP OGL v1.0. Game data under `data/5ecompatible/` is CC-BY-4.0. See `LICENSE.md`.
- **Never commit secrets**: Discord webhook URLs live in `.mcp-discord-webhooks.json` (gitignored).

## Monorepo Structure

```
packages/           # npm workspaces
  server/           # @2d6mcp/server — MCP server (stdio, MLX, BYOD, sessions)
  shared/           # @2d6mcp/shared — dice, keywords, prompts, quality filter
  ogl/              # @2d6mcp/ogl — OGL rules (Cepheus Engine SRD)
  dw/               # @2d6mcp/dw — DW rules (CC-BY-3.0)
  brp/              # @2d6mcp/brp — BRP rules (Basic Roleplaying SRD)
  5ecompatible/     # @2d6mcp/5ecompatible — 5E-compatible rules (CC-BY-4.0)
  orcus/            # @2d6mcp/orcus — Orcus d20-compatible rules (OGL v1.0a)
data/               # SQLite databases (shared)
tests/              # Vitest test suite
```

Agent instructions: `.kilo/agent/`, `.claude/skills/`, `.cursor/rules/`, `.cline/rules/`, `.windsurfrules`.

## Available MCP Tools

| Tool | Purpose |
|------|---------|
| `roll` | Roll dice. `notation` plus optional `mechanic` (`2d6`, `d20`, `percentile`, `damage`, `raw`). Infers mechanic from notation when omitted. |
| `roll_table` | Roll on a named table. `source`: `ogl` or `byod`. Omit `table_name` with `source=byod` to list tables. |
| `query_rules` | Search a licensed rules DB. `system` required. Default category is core FTS only. `category=categories` lists filters. |
| `query_local_byod` | Search ingested personal files. Returns `chunkIndex`. Optional `include_full`. |
| `sync_byod` | Index BYOD files. Optional `relative_path` for a single file. |
| `clear_byod` | Delete the BYOD index. |
| `list_byod_files` | List indexed files. Optional `relative_path` inspects one file. |
| `get_byod_chunk` | Retrieve full chunk content by path + chunk index. |
| `parse_character` | Parse a character sheet into structured data. |
| `discord_post` | Post to Discord webhooks with smart routing and embeds. |
| `discord_webhook` | Manage webhooks: `action` add, remove, list, or test. |
| `session` | Manage sessions: `action` start, end, list, delete, or summarize. |
| `log_transcript` | Log a transcript segment to a session. |
| `get_session_context` | Get recent transcript and rulings. |
| `search_transcript` | Search session transcripts with SQL LIKE (not FTS5). |
| `synthesize_ruling` | Cited rules ruling. Optional `from_context` uses recent transcript. Default `rules_system` from the session when `session_id` is set. |
| `transcribe_audio` | Transcribe audio. Files over 180 seconds are chunked. `action`: transcribe, list, or clear. Last chunk sets `complete: true`. |


## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD |
| `BYOD_PATH` | — | RPG files directory |
| `BYOD_CHUNK_SIZE` | `8000` | Chars per chunk |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Sync batch time limit |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | OGL database path |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | DW database path |
| `BRP_DB_PATH` | `data/brp/basic-roleplaying.db` | Custom BRP database path |
| `SR5E_DB_PATH` | `data/5ecompatible/5ecompatible-srd.db` | Custom 5E-compatible database path |
| `ORCUS_DB_PATH` | `data/orcus/orcus.db` | Custom Orcus database path |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model |
| `MLX_LLM_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-4bit` | MLX LLM model |
| `SESSION_DB_PATH` | `~/.2d6mcp/sessions.db` | Session database location |
| `STT_BACKEND` | `mlx` | STT backend: `mlx` or `whispercpp` |
| `LLM_BACKEND` | `mlx` | LLM backend: `mlx` or `llamacpp` |

