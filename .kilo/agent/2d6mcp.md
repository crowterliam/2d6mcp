# 2D6 MCP Server — Agent Instructions

You are an AI assistant with access to a Model Context Protocol (MCP) server called **2d6mcp**. It provides a mechanical engine, dice roller, and rules reference for 2d6-based tabletop RPGs, supporting both sci-fi (OGL/Cepheus Engine), fantasy (Dungeon World), percentile (Basic Roleplaying), and d20 fantasy (5E-compatible) games.

## Overview

2d6mcp is a self-hosted MCP server (`packages/server/`) with local MLX/llama.cpp, BYOD, session DB, and Discord webhook posting.

It shares rules databases, dice engine, prompt templates, and quality filters via `packages/shared/`.

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



## Key Principles

- **System-agnostic language**: Use generic descriptors — "2d6 sci-fi RPG", "starship", "star system", "characteristic". Never use third-party trademarked terms.
- **Task resolution by system**:
  - **2d6 systems** (OGL, DW): 2d6 + modifier vs. target number (typically 8+). Effect margin = total - target. Use `roll` with mechanic `2d6`.
  - **d20 systems** (5E, Orcus): d20 + modifier vs. AC/DC. Natural 20 = critical hit, natural 1 = fumble. Supports advantage/disadvantage. Use `roll` with mechanic `d20`.
  - **d100 systems** (BRP, CoC 7e, Darkmaster): Roll under target percentile. ≤5% of target = critical success, 96-100 = fumble. Use `roll` with mechanic `percentile`.
  - **Damage**: Use `roll(notation: "2d6+3 fire", mechanic: "damage")` for damage with type labels. Use `roll` with mechanic `raw` for any other dice notation.
- **d66 tables**: Roll two d6s and treat them as tens (first die) and ones (second die), producing 11-66. Use `roll_table` with `"dice_type": "d66"`.
- **The OGL database** is pre-populated with Cepheus Engine SRD content. It covers rules, skills, careers, equipment, combat, starship operations, and world building. Always try `query_rules` with `system: "ogl"` before falling back to BYOD search.
- **The DW database** is pre-populated with Dungeon World content (CC-BY-3.0, by Sage LaTorra and Adam Koebel). It covers moves, classes, spells, equipment, monsters, and GM tools (agendas, principles, fronts, dangers). Use `query_rules` with `system: "dw"` for fantasy RPG content.
- **The BRP database** is pre-populated with Basic Roleplaying SRD. It covers characteristics, skills, professions, weapons, armor, spot rules, and sample foes. Use `query_rules` with `system: "brp"` for percentile RPG content.
- **The 5E-compatible database** is pre-populated with 5E-compatible SRD. It covers spells, monsters, classes, feats, and core rules. Use `query_rules` with `system: "5ecompatible"` for d20 fantasy content.
- **The Orcus database** is pre-populated with Orcus 4e-compatible SRD. It covers classes, monsters, feats, and core rules. Use `query_rules` with `system: "orcus"` for 4e-compatible content.
- **BYOD search** is for your personal files. It requires consent (`AGREE_BYOD_USE="true"`) and a configured `BYOD_PATH`. Files must be synced before they are searchable. Each `BYOD_PATH` gets its own isolated database (`byod_ws_<hash>.db`), so multiple workspaces don't cross-pollinate. A shared content-addressable cache (`content_cache.db`) avoids re-parsing identical files across workspaces.

## When to Use Each Tool

### Dice Rolling
- Use `roll` with mechanic `2d6` for standard 2d6 task resolution (skill checks, attack rolls, characteristic checks)
- Use `roll` with mechanic `d20` for d20-based fantasy RPG resolution (5E, 4E, Orcus, OSE) — supports advantage/disadvantage, AC comparison, critical hits/fumbles
- Use `roll` with mechanic `percentile` for BRP/percentile RPG resolution (Call of Cthulhu, Basic Roleplaying, Against the Darkmaster, Pendragon) — supports roll-under with critical success/fumble
- Use `roll` with mechanic `damage` for damage dice with optional type labels (`"2d6+3 fire"`, `"1d8 piercing"`, `"4d6"`)
- Use `roll` with mechanic `raw` for non-standard dice (damage dice, 1d6 tables, character creation 2d6 across six characteristics)
- Use `roll_table` for random tables — this looks up the result in the OGL database

### Rules Lookup
- Use `query_rules` with `system: "ogl"` as primary sci-fi rules reference. Specify a `category` for targeted results (skills, careers, equipment, combat, starships, worlds, tables, categories, list_tables)
- Use `query_rules` with `system: "dw"` for fantasy/Dungeon World content. Specify a `category` for targeted results (moves, classes, spells, equipment, monsters, gm_tools, rules)
- Use `query_rules` with `system: "brp"` for percentile/BRP content. Specify a `category` for targeted results (characteristics, skills, professions, weapons, armor, spot_rules, foes)
- Use `query_rules` with `system: "5ecompatible"` for d20 fantasy content. Specify a `category` for targeted results (spells, monsters, classes, feats, rules)
- Use `query_rules` with `system: "orcus"` for 4e-compatible content. Specify a `category` for targeted results (classes, monsters, feats, rules)
- Use `query_local_byod` when you need content from your personal files (supplements, house rules, campaign notes)
- Use `roll_table` with a table name to both roll on it AND see the full table entries. Use `source`: `ogl` or `byod`.

### Character Handling
- Use `parse_character` to read a character sheet file and extract UPP, characteristics, skills, name, and career

### BYOD Management
- Use `sync_byod` after adding or modifying files in your BYOD directory
- Use `sync_byod` with `relative_path` for selective indexing of large files that timeout during bulk sync
- Use `list_byod_files` to see what's indexed and available for search
- Use `list_byod_files` with `relative_path` to see how a file was chunked (page breaks, heading structure)
- Use `get_byod_chunk` to retrieve full chunk content after `query_local_byod` returns snippets
- Use `clear_byod` to reset the index completely

### Session Management
- Use `session` start to begin a new game session — logs transcripts, rulings, and context
- Use `log_transcript` to record what was said at the table during play
- Use `get_session_context` to recall the last N minutes of game context (transcript + rulings)
- Use `search_transcript` to find what was said about a specific topic across the session
- Use `session` list to browse recorded sessions
- Use `session` end to close the active session
- Use `session` summarize to generate an AI summary of the full session transcript (requires MLX LLM)

### Ruling Synthesis
- Use `synthesize_ruling` to ask a rules question and get an AI-generated cited ruling based on OGL/DW/BRP/5E-compatible/BYOD rules (requires `mlx_lm.generate`)
- Use `synthesize_ruling` with `from_context` to run the full pipeline — take recent transcript, detect the rules question, look up rules, synthesize a ruling, and log it to the session
- Use `transcribe_audio` to convert recorded audio to text using local MLX Whisper (requires `mlx_whisper`)

### Discord Posting
- Use `discord_post` to send messages to Discord with smart routing based on context tags and rich embeds
- Use `discord_webhook` add to configure a new Discord webhook
- Use `discord_webhook` remove to remove a stored webhook
- Use `discord_webhook(action: "list")` to view all configured webhooks
- Use `discord_webhook` test to verify webhook connectivity

## Common Workflows

### Resolving a Task
1. Determine the appropriate characteristic or skill modifier
2. Apply any difficulty modifiers (easy +2, routine +1, difficult -2, etc.)
3. Call `roll` with mechanic `2d6`, `modifier`, and `target`
4. Report the total, individual dice, and effect margin
5. Interpret: margin 0–5 = marginal success, 6+ = exceptional success; margin -1 to -5 = marginal failure, -6 or worse = exceptional failure

### Looking Up Rules
1. Call `synthesize_ruling` with a natural-language question — it auto-searches OGL/DW/BRP/5E-compatible/BYOD and returns a cited ruling
2. For direct manual search: call `query_rules` with `system: "ogl"` with a descriptive `search_term`
3. If the result is empty or insufficient, try a different search term or add a `category`
4. For combat mechanics, use `category: "combat"`. For starships, use `category: "starships"`
5. For fantasy content, use `query_rules` with `system: "dw"` with appropriate categories
6. For personal supplements, use `query_local_byod` (requires BYOD consent)
7. For specific tables, use `category: "tables"` or `roll_table` directly

### Creating a Character
1. Roll 2d6 six times for characteristics (use `roll` with notation `"2d6"`)
2. Look up available careers with `query_rules` with `system: "ogl"` using `category: "careers"`
3. Parse character sheets with `parse_character` to extract UPP hex codes
4. A UPP is an 8-character hex string encoding six characteristics: Strength, Dexterity, Endurance, Intellect, Education, and Social Standing

### Reference Round — Turn 0
When starting a session, ensure knowledge is available:
1. Call `session` start with the appropriate `rules_system` and `byod_system` (e.g., `byod_system: "call of cthulhu"`) to scope BYOD searches
2. Call `list_byod_files` to know what personal content is indexed
3. Call `sync_byod` if you added files recently
4. Pre-load relevant rules with `synthesize_ruling` or `query_rules` with `system: "ogl"` for the session's expected activities

## Environment Variables

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
| `ORCUS_DB_PATH` | `data/orcus/orcus.db` | Custom Orcus database path |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model for STT |
| `MLX_LLM_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-4bit` | MLX LM model for ruling synthesis |
| `SESSION_DB_PATH` | `~/.2d6mcp/sessions.db` | Session database location |

