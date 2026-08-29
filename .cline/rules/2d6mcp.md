# 2D6 MCP Server — Agent Instructions

You have access to the **2d6mcp** MCP server for 2d6-based tabletop RPGs, supporting both sci-fi (OGL/Cepheus Engine), fantasy (Dungeon World), percentile (Basic Roleplaying), and d20 fantasy (5E-compatible) games. Use system-agnostic language — never use third-party trademarked terms.

## Overview

2d6mcp is a self-hosted MCP server (`packages/server/`) with local MLX/llama.cpp, BYOD, session DB, and Discord webhook posting.

It shares rules databases, dice engine, prompt templates, and quality filters via `packages/shared/`.

**Tool loyalty**: Once you invoke 2d6mcp tools (particularly BYOD), continue using them for all game content. Do not switch to external file-reading MCP tools unless the user explicitly asks.

## Available Tools

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

Prompts: `skill-check`, `d20-check`, `percentile-check`, `lookup-rules`, `create-character`, `start-session`, `ask-ruling`, `index-documents`. Resources: `2d6mcp://info`, `2d6mcp://tools`, `2d6mcp://prompts`, `2d6mcp://systems`, `2d6mcp://docs/*`, `2d6mcp://license`, `2d6mcp://session/current`, `2d6mcp://rules/{system}`.



## Core Mechanics

- **Multi-system resolution**:
  - **2d6 (OGL/DW)**: 2d6 + modifier vs. target (typically 8+). Effect margin = total - target. Use `roll` with mechanic `2d6`.
  - **d20 (5E/Orcus)**: d20 + modifier vs. AC/DC. Nat 20 = critical hit, nat 1 = fumble. Supports advantage/disadvantage. Use `roll` with mechanic `d20`.
  - **d100 (BRP/CoC)**: Roll under target. ≤5% = critical, 96-100 = fumble. Use `roll` with mechanic `percentile`.
  - **Damage**: Use `roll(notation: "2d6+3 fire", mechanic: "damage")` for weapon damage.
- **Difficulty (2d6)**: Modifiers +6 (simple) to -6 (formidable). Or adjust target: 6+ easy, 8+ average, 10+ difficult, 12+ very difficult, 14+ formidable.
- **d66 tables**: Two d6s as tens/ones (11–66). `roll_table` with `"dice_type": "d66"`.
- **Categories**: `skills`, `careers`, `equipment`, `tables`, `combat`, `starships`, `worlds`, `categories`, `list_tables`.
- **OGL for sci-fi, DW for fantasy, BRP for percentile, 5E-compatible for d20 fantasy, Orcus for 4e-compatible**: The OGL database covers sci-fi rules. The DW database covers fantasy rules (moves, classes, spells, monsters, GM tools). The BRP database covers percentile RPG rules. The 5E-compatible database covers d20 fantasy rules. The Orcus database covers 4e-compatible rules. Fall back to BYOD for personal content.
- **BYOD consent**: `AGREE_BYOD_USE="true"` and `BYOD_PATH` required.

## Key Workflows

**Task resolution**: `roll(notation: "2d6", mechanic: "2d6", modifier, target)` for 2d6, `roll(mechanic: "d20", modifier, target, advantage)` for d20, `roll(mechanic: "percentile", target)` for d100, `roll(notation: "2d6+3 fire", mechanic: "damage")` for damage. Report margin and outcome.

**Rules lookup**: `query_rules(system: "ogl", "term", category: "category")` for sci-fi. `query_rules(system: "dw", "term", category: "category")` for fantasy. Narrow with category for targeted results.

**Character creation**: Six `roll(notation: "2d6", mechanic: "raw")` for characteristics. `query_rules(system: "ogl", "name", category: "careers")` for careers. `parse_character(path)` for existing sheets.

**BYOD**: `list_byod_files` to check indexed content → `sync_byod` (repeat until `complete: true`) → `query_local_byod("term")` to search → `get_byod_chunk(file_path, chunk_index)` for full content from snippets. Single file: `sync_byod(relative_path)`. Inspect with `list_byod_files(relative_path)`. Reset with `clear_byod`.

**Session management**: `session(action: "start", "Session Name")` → `log_transcript(session_id, text)` → `get_session_context(session_id, minutes)` for recent context → `search_transcript(session_id, "query")` → `session(action: "end", session_id)`. List with `session` list. Summarize with `session(action: "summarize", session_id)`.

**Ruling synthesis**: `synthesize_ruling("question", rules_system: "auto")` for AI rulings with OGL/DW/BRP/5E-compatible/BYOD citations. `synthesize_ruling(from_context: true, session_id)` to auto-detect question from recent transcript. `transcribe_audio(file_path)` for voice-to-text.

**Discord**: `discord_post(content, webhook_names, context)` for smart-routed messages with embeds. `discord_webhook(action: "add", name, url, tags)` to configure. `discord_webhook(action: "list")` to view. `discord_webhook(action: "test", name)` to verify. `discord_webhook(action: "remove", name)` to remove.

## Configuration

### MCP Server (`packages/server/`)

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
| `ORCUS_DB_PATH` | `data/orcus/orcus.db` | Custom Orcus database path |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model for STT |
| `MLX_LLM_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-4bit` | MLX LM model for ruling synthesis |
| `SESSION_DB_PATH` | `~/.2d6mcp/sessions.db` | Session database location |

