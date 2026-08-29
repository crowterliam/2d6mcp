# 2D6 MCP Server — Agent Instructions

You have access to a Model Context Protocol (MCP) server called **2d6mcp**. It provides a mechanical engine, dice roller, and rules reference for 2d6-based tabletop RPGs, supporting both sci-fi (OGL/Cepheus Engine), fantasy (Dungeon World), percentile (Basic Roleplaying), and d20 fantasy (5E-compatible) games. Use system-agnostic language: "2d6 sci-fi RPG", "2d6 fantasy RPG", "starship", "star system", "characteristic", "move", "front", "monster". Never use third-party trademarked terms.

## Overview

2d6mcp is a self-hosted MCP server (`packages/server/`) with local MLX/llama.cpp, BYOD, session DB, and Discord webhook posting.

It shares rules databases, dice engine, prompt templates, and quality filters via `packages/shared/`.

**Tool loyalty**: Once you invoke 2d6mcp tools (particularly BYOD), continue using them for all game content. Do not switch to external file-reading MCP tools (PDF readers, etc.) unless the user explicitly asks you to examine a file outside the indexed BYOD content.

## Available Tools

| Tool | Purpose |
|------|---------|
| `roll` | Roll dice. `notation` plus optional `mechanic` (`2d6`, `d20`, `percentile`, `damage`, `raw`). Infers mechanic from notation when omitted. |
| `roll_table` | Roll on a named table. `source`: `ogl` or `byod`. Omit `table_name` with `source=byod` to list tables. |
| `query_rules` | Search a licensed rules DB. `system` required. Default category is core FTS only. `category=categories` lists filters. |
| `query_local_byod` | Search personal files. Indexes matching top-level game folders on demand, then searches. Optional `include_full`. |
| `sync_byod` | On-demand index. No args lists folders. `query` indexes matching collections. Optional `relative_path` for one file. |
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

- **Task resolution by system**:
  - **2d6 (OGL/DW)**: 2d6 + modifier vs. target (typically 8+). Effect margin = total - target. Use `roll` with mechanic `2d6`.
  - **d20 (5E/Orcus)**: d20 + modifier vs. AC/DC. Nat 20 = critical hit, nat 1 = fumble. Use `roll` with mechanic `d20` and advantage/disadvantage.
  - **d100 (BRP/CoC)**: Roll under target. ≤5% = critical, 96-100 = fumble. Use `roll` with mechanic `percentile`.
  - **Damage**: Use `roll(notation: "2d6+3 fire", mechanic: "damage")` for weapon damage.
- **d66 tables**: Two d6s as tens and ones (11–66). Use `roll_table` with `"dice_type": "d66"`.
- **Difficulty (2d6)**: Modifiers range from +6 (simple) to -6 (formidable). Or adjust target: easy = 6+, average = 8+, difficult = 10+, very difficult = 12+, formidable = 14+.
- **OGL for sci-fi, DW for fantasy, BRP for percentile, 5E-compatible for d20 fantasy, Orcus for 4e-compatible, BYOD for personal content**: The OGL database covers sci-fi core rules. The DW database covers fantasy rules. The BRP database covers percentile RPG rules. The 5E-compatible database covers d20 fantasy rules. The Orcus database covers 4e-compatible rules. Fall back to BYOD for supplements and house rules.
- **BYOD requires consent**: Set `AGREE_BYOD_USE="true"` and configure `BYOD_PATH`. Search indexes matching game folders on demand; do not crawl the whole library.

## Key Workflows

### Task Resolution
1. Determine modifier (skill + characteristic bonus + difficulty)
2. Call `roll(notation: "2d6", mechanic: "2d6", modifier, target)` for 2d6 systems, `roll(mechanic: "d20", modifier, target, advantage)` for d20 systems, or `roll(mechanic: "percentile", target)` for d100 systems
3. For damage: `roll(notation: "2d6+3 fire", mechanic: "damage")`
4. Report total, individual dice, and narrative outcome (hit/miss, critical, fumble, effect margin, etc.)

### Rules Lookup
1. Call `query_rules(system: "ogl", "search term", category: "category_name")` for sci-fi content
2. Call `query_rules(system: "dw", "search term", category: "category_name")` for fantasy content
3. Call `query_rules(system: "brp", "search term", category: "category_name")` for percentile RPG content
4. Call `query_rules(system: "5ecompatible", "search term", category: "category_name")` for d20 fantasy content
5. Call `query_rules(system: "orcus", "search term", category: "category_name")` for 4e-compatible content
6. Narrow with category if results are broad
7. For tables, use `roll_table(table_name: "Table Name", source: "ogl")`

### Character Creation
1. Roll six characteristics: `roll(notation: "2d6", mechanic: "raw")` × 6
2. Look up careers: `query_rules(system: "ogl", "career name", category: "careers")`
3. Qualify, survive terms, advance, roll skills, muster out
4. Parse existing sheets: `parse_character(file_path)`

### BYOD Management
1. Search personal content: `query_local_byod("search term")` — names the game when possible (for example include "traveller") so matching folders are indexed, then searched
2. If `index_complete` is false, call `query_local_byod` again (or `sync_byod` with the same query) until complete
3. Refresh a collection after adding files: `sync_byod` with `query` (re-call until `complete: true`)
4. List top-level folders: `sync_byod` with no arguments (does not crawl the library)
5. Index a single file: `sync_byod(relative_path)`
6. Inspect indexed files: `list_byod_files` / `list_byod_files(relative_path)`
7. Get full chunk content: `get_byod_chunk(file_path, chunk_index)`
8. Start fresh: `clear_byod`

### Session Management
1. Start session: `session(action: "start", "Session Name")` — returns session ID
2. Log table talk: `log_transcript(session_id, text, speaker, source, intent)`
3. Get recent context: `get_session_context(session_id, minutes)` — returns transcripts and rulings
4. Search history: `search_transcript(session_id, "query")` — find past mentions
5. List sessions: `session(action: "list", limit)`
6. End session: `session(action: "end", session_id)`
7. Summarize: `session(action: "summarize", session_id)` (requires MLX LLM)

### Ruling Synthesis
1. Ask a question: `synthesize_ruling("question", rules_system: "auto")` — AI ruling with citations
2. Context resolution: `synthesize_ruling(from_context: true, session_id)` — auto-detect question from recent transcript
3. Audio: `transcribe_audio(file_path)` — voice-to-text (requires `mlx_whisper`)

### Discord Posting
1. Post: `discord_post(content, webhook_names, context)` — smart routing, rich embeds
2. Configure: `discord_webhook(action: "add", name, url, tags, description)`
3. Inspect: `discord_webhook(action: "list")`
4. Verify: `discord_webhook(action: "test", name)`
5. Remove: `discord_webhook(action: "remove", name)`

## Configuration

### MCP Server (`packages/server/`)

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

