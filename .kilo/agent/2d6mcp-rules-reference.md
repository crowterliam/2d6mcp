# 2D6 Rules Reference

You have access to a pre-populated OGL rules database (Cepheus Engine SRD) and optionally your own BYOD files. Use these tools to look up game mechanics.

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

When no category is specified, the search queries ALL categories and returns combined results.

### Examples
```
query_ogl_rules("laser rifle")                    → equipment match
query_ogl_rules("combat", category: "rules")      → combat rules only
query_ogl_rules("navy", category: "careers")      → navy career path
query_ogl_rules("Astrogation", category: "skills") → skill description
query_ogl_rules("critical hit", category: "starships") → ship damage tables
```

## Table Rolling

```
roll_table(table_name, dice_type?)
```

Roll on a named table using the specified dice type. The result includes the dice outcome, the matched table entry, and the full description.

### Available Tables (partial list)
- `Reaction Table` (2d6)
- `Personal Encounter` (2d6)
- `Patron Encounter` (2d6)
- `Rumour Table` (1d6)
- `Starship Encounter` (2d6)
- `Animal Encounter` (2d6)
- `Starport Encounter` (2d6)
- `Trade Goods` (1d6)

Use `query_ogl_rules("", category: "list_tables")` to see all available tables.

### Dice Types
- `1d6` — single d6 (1–6)
- `2d6` — two d6 summed (2–12)
- `d66` — two d6 as tens/ones (11–66)
- `1d3` — half d6 rounded up (1–3)
- `2d3` — two d3 summed (2–6)

## BYOD Search

```
query_local_byod(search_term)
```

Searches your personally ingested PDFs, text files, and markdown files. Requires BYOD consent and a configured `BYOD_PATH`. Files must be synced with `sync_byod` first.

### Search Details
- Returns matching chunks with highlighted snippets (64-character highlights)
- Use `get_byod_chunk(relative_path, chunk_index)` to retrieve the full chunk text (up to 8KB) for results that matter
- Multi-word queries try AND first, then OR for broad matching
- Use prefix searches with `*` (e.g., `combat*` matches combat, combative, etc.)
- Maximum 20 results returned per query

## Search Strategy

1. **Always start with OGL**: `query_ogl_rules` is faster and covers the core rules
2. **Be specific**: Search for the exact mechanic name or equipment item
3. **Try categories**: If a broad search returns too much, narrow with a `category`
4. **Fall back to BYOD**: If OGL doesn't have what you need, try `query_local_byod`
5. **Combine searches**: For a complete picture, query both OGL and BYOD
6. **Get full content**: Use `get_byod_chunk` to retrieve complete chunk text for results that matter

## Content Coverage

The OGL database covers:

- **Characteristics & Skills**: All six characteristics, 40+ skills with specialities
- **Careers**: Qualification, survival, advancement, ranks, and mustering-out for 12+ careers
- **Personal Combat**: Initiative, attack rolls, damage, armour, cover, healing
- **Equipment**: Armour types, weapons (melee and ranged), augments, medical supplies, computers, survival gear, vehicles
- **Starships**: Design (hulls, drives, weapons), space combat, critical hits, boarding actions
- **World Building**: UWP generation, starports, trade codes, government types, law levels, passenger and freight tables
- **Encounters**: Personal, starship, starport, patron, animal encounter tables
- **Trade & Commerce**: Trade goods, freight, passenger types
