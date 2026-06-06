---
name: 2d6-mcp-rules-reference
description: Rules lookup, table rolling, OGL and BYOD search strategies for the 2d6mcp MCP server.
---

# 2D6 Rules Reference

You have access to five pre-populated rules databases (OGL/Cepheus Engine SRD for sci-fi, Dungeon World CC-BY-3.0 for fantasy, Basic Roleplaying BRP OGL v1.0 for percentile, 5E-compatible SRD CC-BY-4.0 for d20 fantasy, and Orcus OGL v1.0a for 4e-compatible), plus your own BYOD files and AI ruling synthesis.

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

## DW Database Search

```
query_dw_rules(search_term, category?)
```

### Categories

| Category | Contains |
|----------|----------|
| `moves` | Basic, special, and GM moves |
| `classes` | Character classes and compendium classes |
| `spells` | Wizard and cleric spells |
| `equipment` | Weapons, armor, gear, services |
| `monsters` | Monsters by type and environment |
| `gm_tools` | Agendas, principles, fronts, dangers, steading rules |
| `rules` | Core rules, tags, playbook rules |

### Examples
```
query_dw_rules("hack and slash")               → move description
query_dw_rules("wizard", category: "classes")   → wizard class
query_dw_rules("goblin", category: "monsters")  → goblin stat block
query_dw_rules("front", category: "gm_tools")   → front creation rules
```

## BRP Database Search

```
query_brp_rules(search_term, category?)
```

### Categories

| Category | Contains |
|----------|----------|
| `characteristics` | STR, CON, SIZ, INT, POW, DEX, APP |
| `skills` | Skill descriptions and specializations |
| `professions` | Profession templates and skill packages |
| `weapons` | Melee and ranged weapons |
| `armor` | Armor types and protection values |
| `spot_rules` | Spot rules for combat, damage, healing |
| `foes` | Creatures and NPC foes |

### Examples
```
query_brp_rules("dodge", category: "skills")          → dodge skill
query_brp_rules("sword", category: "weapons")          → sword stats
query_brp_rules("armor", category: "armor")            → armor types
query_brp_rules("combat", category: "spot_rules")      → combat spot rules
```

## 5E-compatible Database Search

```
query_5ecompatible_rules(search_term, category?)
```

### Categories

| Category | Contains |
|----------|----------|
| `spells` | Spell descriptions by level |
| `monsters` | Monster stat blocks |
| `classes` | Class features and progression |
| `feats` | Feat descriptions and prerequisites |
| `rules` | Core rules and conditions |

## 4E-Compatible (Orcus) Database Search

```
query_orcus_rules(search_term, category?)
```

Search the Orcus 4e-compatible rules database for classes, monsters, feats, and core rules.

### Categories

| Category | Contains |
|----------|----------|
| `classes` | Character classes, traditions, roles, key abilities, defenses |
| `monsters` | Monster stat blocks, level info, origin types, traits, actions |
| `feats` | Feat descriptions, prerequisites, category, benefits |
| `rules` | Core rules, skill checks, ability checks, extended challenges |

### Examples
```
query_orcus_rules("Commander", category: "classes")           → class features
query_orcus_rules("dragon", category: "monsters")              → monster stat block
```

### Examples
```
query_5ecompatible_rules("fireball", category: "spells")     → spell description
query_5ecompatible_rules("goblin", category: "monsters")     → monster stat block
query_5ecompatible_rules("tough", category: "feats")         → feat description
```

## Table Rolling

```
roll_table(table_name, dice_type?, system?)
```

Roll on a named table from any rules system. Use the `system` parameter to specify which database to search (ogl/dw/brp/5ecompatible/orcus, default: ogl). Available dice types: `1d6`, `2d6`, `d66`, `1d3`, `2d3`, `d4`, `d8`, `d10`, `d12`, `d20`, `d100`. Use `query_ogl_rules("", category: "list_tables")` to see all available OGL tables.

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

1. **Match the system**: Use the appropriate tool — `query_ogl_rules` (sci-fi), `query_dw_rules` (fantasy), `query_brp_rules` (percentile), `query_5ecompatible_rules` (d20 fantasy), or `query_orcus_rules` (4e-compatible)
2. **Be specific**: Search for the exact mechanic name or equipment item
3. **Try categories**: If a broad search returns too much, narrow with a `category`
4. **Fall back to BYOD**: If core rules don't have what you need, try `query_local_byod`
5. **Combine searches**: For a complete picture, query both the system database and BYOD
6. **Get full content**: `query_local_byod` returns snippets. Use `get_byod_chunk(file_path, chunk_index)` to retrieve the full chunk for inference

## Content Coverage

### OGL (Cepheus Engine SRD)
Rules, skills, careers, equipment, combat, starship operations, world building, and random tables for 2d6 sci-fi RPGs.

### DW (Dungeon World CC-BY-3.0)
Moves, classes, spells, equipment, monsters, and GM tools (agendas, principles, fronts, dangers) for 2d6 fantasy RPGs.

### BRP (Basic Roleplaying BRP OGL v1.0)
Characteristics, skills, professions, weapons, armor, spot rules, and foes for percentile-based RPGs.

### 5E-compatible (5E-compatible SRD CC-BY-4.0)
Spells, monsters, classes, feats, and core rules for d20 fantasy RPGs.

### 4E-compatible (Orcus OGL v1.0a)
Classes, monsters, feats, and core rules for 4e-compatible RPGs. Includes character classes with traditions and roles, full monster stat blocks with AC/Fort/Ref/Will defenses, and feat-driven character progression.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | Custom OGL database path |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | Custom DW database path |
| `BRP_DB_PATH` | `data/brp/basic-roleplaying.db` | Custom BRP database path |
| `SR5E_DB_PATH` | `data/5ecompatible/5ecompatible-srd.db` | Custom 5E-compatible database path |
| `ORCUS_DB_PATH` | `data/orcus/orcus.db` | Custom Orcus database path |
