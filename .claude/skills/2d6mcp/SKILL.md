---
name: 2d6-mcp-core
description: Master reference for the 2d6mcp MCP server — all tools, workflows, and environment configuration for 2d6 TTRPGs (sci-fi and fantasy).
---

# 2D6 MCP Server — Agent Instructions

You have access to the **2d6mcp** MCP server. It provides a mechanical engine, dice roller, and rules reference for 2d6-based tabletop RPGs, supporting both sci-fi (OGL/Cepheus Engine) and fantasy (Dungeon World) games.

## Available Tools

| Tool | Purpose |
|------|---------|
| `roll_2d6` | Roll 2d6 with modifier, compare against target number |
| `roll_custom` | Roll any dice notation (`3d6`, `1d20`, `4d6+2`, `d66`) |
| `roll_table` | Roll on a named table (Reaction, Encounters, Patrons) |
| `query_ogl_rules` | Search OGL rules database for skills, careers, equipment, combat |
| `query_dw_rules` | Search DW rules database for moves, classes, spells, equipment, monsters, GM tools |
| `query_local_byod` | Full-text search across your locally ingested files |
| `parse_character` | Parse a character sheet file into structured data |
| `sync_byod` | Index/re-index files from your BYOD directory |
| `clear_byod` | Delete the BYOD index to start fresh |
| `list_byod_files` | List all indexed files with chunk counts and status |
| `inspect_byod_file` | Show chunks for a specific indexed file |

## Key Principles

- **System-agnostic language**: Use generic descriptors — "2d6 sci-fi RPG", "2d6 fantasy RPG", "starship", "star system", "characteristic", "move", "front", "monster". Never use third-party trademarked terms.
- **Task resolution**: The core mechanic is 2d6 + modifier vs. target number (typically 8+). Effect margin = total - target. Margin 0+ = success, margin 6+ = exceptional success.
- **d66 tables**: Roll two d6s and treat them as tens (first die) and ones (second die), producing 11-66. Use `roll_table` with `"dice_type": "d66"`.
- **The OGL database** is pre-populated with Cepheus Engine SRD content. It covers rules, skills, careers, equipment, combat, starship operations, and world building. Always try `query_ogl_rules` before falling back to BYOD search.
- **The DW database** is pre-populated with Dungeon World content (CC-BY-3.0, by Sage LaTorra and Adam Koebel). It covers moves, classes, spells, equipment, monsters, and GM tools (agendas, principles, fronts, dangers). Use `query_dw_rules` for fantasy RPG content.
- **BYOD search** is for your personal files. It requires consent (`AGREE_BYOD_USE="true"`) and a configured `BYOD_PATH`. Files must be synced before they are searchable.
- **BYOD search** is for your personal files. It requires consent (`AGREE_BYOD_USE="true"`) and a configured `BYOD_PATH`. Files must be synced before they are searchable.

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
- Use `list_byod_files` to see what's indexed and available for search
- Use `inspect_byod_file` to see how a file was chunked (page breaks, heading structure)
- Use `clear_byod` to reset the index completely

## Common Workflows

### Resolving a Task
1. Determine the appropriate characteristic or skill modifier
2. Apply any difficulty modifiers (easy +2, routine +1, difficult -2, etc.)
3. Call `roll_2d6` with the `modifier` and `target_number`
4. Report the total, individual dice, and effect margin
5. Interpret: margin 0–5 = marginal success, 6+ = exceptional success; margin -1 to -5 = marginal failure, -6 or worse = exceptional failure

### Looking Up Rules
1. Call `query_ogl_rules` with a descriptive `search_term` for sci-fi content
2. Call `query_dw_rules` with a descriptive `search_term` for fantasy content
3. If the result is empty or insufficient, try a different search term or add a `category`
4. For combat mechanics, use `category: "combat"`. For starships, use `category: "starships"`. For world building, use `category: "worlds"`
5. For DW monsters, use `category: "monsters"`. For GM tools, use `category: "gm_tools"`
6. For specific tables, use `category: "tables"` or `roll_table` directly

### Reference Round — Turn 0
When starting a session, ensure knowledge is available:
1. Call `list_byod_files` to know what personal content is indexed
2. Call `sync_byod` if you added files recently
3. Pre-load relevant rules with `query_ogl_rules` for the session's expected activities

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD mode |
| `BYOD_PATH` | — | Directory of local source files |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per chunk (500–50000) |
| `BYOD_CHUNK_OVERLAP` | `400` | Overlap between chunks |
| `BYOD_MAX_FILES` | `2000` | Max files per sync |
| `BYOD_MAX_CHUNKS_PER_FILE` | `500` | Max chunks per file |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Max ms per sync batch |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | Custom OGL database path |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | Custom DW database path |
