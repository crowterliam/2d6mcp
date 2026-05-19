# 2D6 MCP Server — Agent Instructions

You are an AI assistant with access to a Model Context Protocol (MCP) server called **2d6mcp**. It provides a mechanical engine, dice roller, and rules reference for generic 2d6-based sci-fi tabletop RPGs.

## Available Tools

| Tool | Purpose |
|------|---------|
| `roll_2d6` | Roll 2d6 with modifier, compare against target number |
| `roll_custom` | Roll any dice notation (`3d6`, `1d20`, `4d6+2`, `d66`) |
| `roll_table` | Roll on a named table (Reaction, Encounters, Patrons) |
| `query_ogl_rules` | Search OGL rules database for skills, careers, equipment, combat |
| `query_local_byod` | Full-text search across your locally ingested files |
| `parse_character` | Parse a character sheet file into structured data |
| `sync_byod` | Index/re-index files from your BYOD directory |
| `clear_byod` | Delete the BYOD index to start fresh |
| `list_byod_files` | List all indexed files with chunk counts and status |
| `inspect_byod_file` | Show chunks for a specific indexed file |

## Key Principles

- **System-agnostic language**: Use generic descriptors — "2d6 sci-fi RPG", "starship", "star system", "characteristic". Never use third-party trademarked terms.
- **Task resolution**: The core mechanic is 2d6 + modifier vs. target number (typically 8+). Effect margin = total - target. Margin 0+ = success, margin 6+ = exceptional success.
- **d66 tables**: Roll two d6s and treat them as tens (first die) and ones (second die), producing 11-66. Use `roll_table` with `"dice_type": "d66"`.
- **The OGL database** is pre-populated with Cepheus Engine SRD content. It covers rules, skills, careers, equipment, combat, starship operations, and world building. Always try `query_ogl_rules` before falling back to BYOD search.
- **BYOD search** is for your personal files. It requires consent (`AGREE_BYOD_USE="true"`) and a configured `BYOD_PATH`. Files must be synced before they are searchable.

## When to Use Each Tool

### Dice Rolling
- Use `roll_2d6` for standard 2d6 task resolution (skill checks, attack rolls, characteristic checks)
- Use `roll_custom` for non-standard dice (damage dice, 1d6 tables, character creation 2d6 across six characteristics)
- Use `roll_table` for random tables — this looks up the result in the OGL database

### Rules Lookup
- Use `query_ogl_rules` as primary rules reference. Specify a `category` for targeted results (skills, careers, equipment, combat, starships, worlds, tables, categories, list_tables)
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
1. Call `query_ogl_rules` with a descriptive `search_term`
2. If the result is empty or insufficient, try a different search term or add a `category`
3. For combat mechanics, use `category: "combat"`. For starships, use `category: "starships"`. For world building, use `category: "worlds"`
4. For specific tables, use `category: "tables"` or `roll_table` directly

### Creating a Character
1. Roll 2d6 six times for characteristics (use `roll_custom` with `"2d6"`)
2. Look up available careers with `query_ogl_rules` using `category: "careers"`
3. Parse character sheets with `parse_character` to extract UPP hex codes
4. A UPP is an 8-character hex string encoding six characteristics: Strength, Dexterity, Endurance, Intellect, Education, and Social Standing

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
