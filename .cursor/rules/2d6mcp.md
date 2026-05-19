# 2D6 MCP Server — Agent Instructions

You have access to a Model Context Protocol (MCP) server called **2d6mcp**. It provides a mechanical engine, dice roller, and rules reference for generic 2d6-based sci-fi tabletop RPGs. Use system-agnostic language: "2d6 sci-fi RPG", "starship", "star system", "characteristic". Never use third-party trademarked terms.

## Available Tools

| Tool | Purpose |
|------|---------|
| `roll_2d6` | Roll 2d6 with modifier, compare against target number. Returns dice, total, effect margin. |
| `roll_custom` | Roll any dice notation (`3d6`, `1d20`, `4d6+2`, `d66`). |
| `roll_table` | Roll on a named table (Reaction, Encounters, Patrons) from the OGL database. |
| `query_ogl_rules` | Search OGL rules database. Use `category` for targeted results: skills, careers, equipment, tables, combat, starships, worlds, categories, list_tables. |
| `query_local_byod` | Full-text search across your locally ingested files. Requires BYOD consent. |
| `parse_character` | Parse a character sheet file into structured data (UPP, characteristics, skills, name, career). |
| `sync_byod` | Index/re-index files from BYOD directory. Runs in time-budgeted batches. Returns `complete: false` if more remain — re-call. |
| `clear_byod` | Delete the BYOD index to start fresh. |
| `list_byod_files` | List all indexed files with chunk counts and status (indexed/failed). |
| `inspect_byod_file` | Show chunk structure for a specific indexed file (relative_path required). |

## Core Mechanics

- **Task resolution**: 2d6 + modifier vs. target number (typically 8+). Effect margin = total - target. Margin 0+ = success, 6+ = exceptional success.
- **d66 tables**: Two d6s as tens and ones (11–66). Use `roll_table` with `"dice_type": "d66"`.
- **Difficulty**: Modifiers range from +6 (simple) to -6 (formidable). Or adjust target: easy = 6+, average = 8+, difficult = 10+, very difficult = 12+, formidable = 14+.
- **OGL first, BYOD second**: The OGL database covers core rules. Fall back to BYOD for supplements and house rules.
- **BYOD requires consent**: Set `AGREE_BYOD_USE="true"` and configure `BYOD_PATH`. Files must be synced before searchable.

## Key Workflows

### Task Resolution
1. Determine modifier (skill + characteristic bonus + difficulty)
2. Call `roll_2d6(modifier, target)` or `roll_custom("Nd6+M")` for special rolls
3. Report total, individual dice, effect margin, and narrative outcome

### Rules Lookup
1. Call `query_ogl_rules("search term", category: "category_name")`
2. Narrow with category if results are broad
3. For tables, use `roll_table("Table Name")` or `query_ogl_rules("", category: "tables")`

### Character Creation
1. Roll six characteristics: `roll_custom("2d6")` × 6
2. Look up careers: `query_ogl_rules("career name", category: "careers")`
3. Qualify, survive terms, advance, roll skills, muster out
4. Parse existing sheets: `parse_character(file_path)`

### BYOD Management
1. Check indexed content: `list_byod_files`
2. Sync new/changed files: `sync_byod` (re-call until `complete: true`)
3. Inspect structure: `inspect_byod_file(relative_path)`
4. Search personal content: `query_local_byod("search term")`
5. Start fresh: `clear_byod`

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD mode |
| `BYOD_PATH` | — | Directory of local RPG source files |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per chunk |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Max ms per sync batch |
| `BYOD_MAX_FILES` | `2000` | Max files per sync |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | Custom OGL database path |
