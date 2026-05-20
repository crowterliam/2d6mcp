---
name: 2d6-mcp-rules-reference
description: Rules lookup, table rolling, OGL and BYOD search strategies for the 2d6mcp MCP server.
---

# 2D6 Rules Reference

You have access to a pre-populated OGL rules database (Cepheus Engine SRD) and optionally your own BYOD files.

## OGL Database Search

```
query_ogl_rules(search_term, category?)
```

### Categories

| Category | Contains |
|----------|----------|
| `rules` | Core rules, task resolution, hazards, encounters |
| `skills` | Skill descriptions and specialities |
| `careers` | Career tables, qualification, survival, advancement, ranks |
| `equipment` | Armour, weapons, augments, medical gear, computers, survival gear |
| `tables` | Named random tables |
| `combat` | Personal combat rules, damage, healing |
| `starships` | Starship operations, space combat, critical hits, boarding |
| `worlds` | World building, UWP creation, trade codes, starports |
| `categories` | List of all available categories |
| `list_tables` | List of all named tables |

### Examples
```
query_ogl_rules("laser rifle")                    → equipment match
query_ogl_rules("combat", category: "rules")      → combat rules only
query_ogl_rules("navy", category: "careers")      → navy career path
query_ogl_rules("Astrogation", category: "skills") → skill description
```

## Table Rolling

```
roll_table(table_name, dice_type?)
```

Roll on a named table using the specified dice type. Available tables include Reaction, Personal Encounter, Patron Encounter, Rumour, Starship Encounter, Animal Encounter, Starport Encounter, Trade Goods, and many more. Use `query_ogl_rules("", category: "list_tables")` to see all.

## BYOD Search

```
query_local_byod(search_term)
```

Searches your personally ingested PDFs, text files, and markdown files. Requires BYOD consent and a configured `BYOD_PATH`. Files must be synced with `sync_byod` first. Multi-word queries try AND first, then OR for broad matching. Prefix searches with `*` (e.g., `combat*`). Max 20 results. Returns snippets — use `get_byod_chunk` for full content.

```
get_byod_chunk(file_path, chunk_index)
```

Retrieves the full chunk content for a specific file and chunk index. Use after `query_local_byod` returns snippets and you need the complete text for inference.

## Search Strategy

1. **Always start with OGL**: `query_ogl_rules` is faster and covers the core rules
2. **Be specific**: Search for the exact mechanic name or equipment item
3. **Try categories**: If a broad search returns too much, narrow with a `category`
4. **Fall back to BYOD**: If OGL doesn't have what you need, try `query_local_byod`
5. **Combine searches**: For a complete picture, query both OGL and BYOD
6. **Get full content**: `query_local_byod` returns snippets. Use `get_byod_chunk(file_path, chunk_index)` to retrieve the full chunk for inference
