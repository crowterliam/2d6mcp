# 2D6 MCP Server — Agent Instructions

You have access to the **2d6mcp** MCP server for 2d6-based tabletop RPGs, supporting both sci-fi (OGL/Cepheus Engine) and fantasy (Dungeon World) games. Use system-agnostic language — never use third-party trademarked terms.

## Available Tools

| Tool | Purpose |
|------|---------|
| `roll_2d6` | Roll 2d6 with modifier vs. target. Returns dice, total, effect margin. |
| `roll_custom` | Roll any dice notation (`3d6`, `1d20`, `4d6+2`, `d66`). |
| `roll_table` | Roll on a named table from the OGL database. |
| `query_ogl_rules` | Search OGL rules by term and optional category. |
| `query_dw_rules` | Search DW rules by term and optional category (moves, classes, spells, equipment, monsters, gm_tools, rules). |
| `query_local_byod` | Full-text search personal ingested files (requires consent). |
| `parse_character` | Parse character sheet into structured data. |
| `sync_byod` | Index BYOD files in time-budgeted batches. Re-call if `complete: false`. |
| `clear_byod` | Delete BYOD index to start fresh. |
| `list_byod_files` | List indexed files with status and chunk counts. |
| `inspect_byod_file` | Show chunk structure for a specific file. |
| `sync_file` | Index a single file by relative path. |
| `get_byod_chunk` | Retrieve full chunk content by file path + chunk index. |
| `discord_post` | Post messages to Discord webhooks with smart routing. |
| `discord_add_webhook` | Add a Discord webhook. |
| `discord_remove_webhook` | Remove a stored Discord webhook. |
| `discord_list_webhooks` | List configured webhooks. |
| `discord_test_webhook` | Test webhook connectivity. |

## Core Mechanics

- **Task resolution**: 2d6 + modifier vs. target (typically 8+). Effect margin = total - target. Margin 0+ = success, 6+ = exceptional.
- **Difficulty**: Modifiers +6 (simple) to -6 (formidable). Or adjust target: 6+ easy, 8+ average, 10+ difficult, 12+ very difficult, 14+ formidable.
- **d66 tables**: Two d6s as tens/ones (11–66). `roll_table` with `"dice_type": "d66"`.
- **Categories**: `skills`, `careers`, `equipment`, `tables`, `combat`, `starships`, `worlds`, `categories`, `list_tables`.
- **OGL for sci-fi, DW for fantasy**: The OGL database covers sci-fi rules. The DW database covers fantasy rules (moves, classes, spells, monsters, GM tools). Fall back to BYOD for personal content.
- **BYOD consent**: `AGREE_BYOD_USE="true"` and `BYOD_PATH` required.

## Key Workflows

**Task resolution**: `roll_2d6(modifier, target)` or `roll_custom("Nd6+M")`. Report margin and outcome.

**Rules lookup**: `query_ogl_rules("term", category: "category")` for sci-fi. `query_dw_rules("term", category: "category")` for fantasy. Narrow with category for targeted results.

**Character creation**: Six `roll_custom("2d6")` for characteristics. `query_ogl_rules("name", category: "careers")` for careers. `parse_character(path)` for existing sheets.

**BYOD**: `list_byod_files` to check indexed content → `sync_byod` (repeat until `complete: true`) → `query_local_byod("term")` to search → `get_byod_chunk(file_path, chunk_index)` for full content from snippets. Single file: `sync_file(relative_path)`. Inspect with `inspect_byod_file(path)`. Reset with `clear_byod`.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD |
| `BYOD_PATH` | — | RPG files directory |
| `BYOD_CHUNK_SIZE` | `8000` | Chars per chunk |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Max ms per sync batch |
| `BYOD_CONTENT_CACHE_PATH` | — | Shared content cache (deduplicates across workspaces) |
| `BYOD_MAX_FILES` | `2000` | Max files per sync |
