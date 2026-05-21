# 2D6 Rules Reference

You have access to a pre-populated OGL rules database (Cepheus Engine SRD), a Dungeon World database (CC-BY-3.0), optionally your own BYOD files, and AI ruling synthesis. Use these tools to look up game mechanics and generate cited rulings.

## AI Ruling Synthesis

```
synthesize_ruling(question, rules_system?, session_id?, rules_context?)
```

Take a natural-language rules question, auto-look up relevant rules from OGL, DW, and BYOD databases, then synthesize a cited ruling using the local MLX LLM. Requires `mlx_lm.generate` to be installed.

**Key behaviour:**
- If `rules_context` is provided, uses it directly (skip auto-lookup)
- If omitted, searches OGL (sci-fi) and/or DW (fantasy) based on `rules_system` ("ogl", "dw", or "auto")
- BYOD is searched if consent is given — search is scoped by `byod_system` if the session was started with one
- Returns: question, ruling text with `[Source]` citations, model used, latency, and snippet of the rules context used
- Rulings include `[Verify: ...]` warnings when numbers in the ruling don't appear in the source text (quality filter)

```
resolve_from_context(session_id, context_minutes?)
```

Full producer pipeline: takes the last N minutes of session transcript, searches rules, synthesizes a ruling, and logs it. Use when the GM wants a ruling on what was just discussed — no need to formulate the question.

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

## Dungeon World Database Search

```
query_dw_rules(search_term, category?)
```

Search the Dungeon World rules database for moves, classes, spells, equipment, monsters, or GM tools.

### Categories

| Category | Contains |
|----------|----------|
| `moves` | Basic and special moves, descriptions, stat, 10+/7-9/6- results |
| `classes` | Class descriptions, starting moves, gear, base HP, damage |
| `spells` | Wizard and cleric spells, level, tags, descriptions |
| `equipment` | Weapons, armour, gear, tags, cost, weight, damage |
| `monsters` | Monster stat blocks, tags, damage, HP, armour, instinct, moves |
| `gm_tools` | GM agendas, principles, fronts, dangers, steadings |
| `rules` | Core rules, play examples |

### Examples
```
query_dw_rules("hack and slash")              → basic move
query_dw_rules("wizard", category: "classes") → wizard class
query_dw_rules("fireball", category: "spells") → wizard spell
query_dw_rules("goblin", category: "monsters") → monster stat block
query_dw_rules("front", category: "gm_tools")  → campaign front rules
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

### BYOD System Filter

When you start a session with `byod_system` set (e.g., `"call of cthulhu"`, `"traveller"`), all BYOD searches in `synthesize_ruling` and `resolve_from_context` are automatically filtered to files whose names contain that system. This prevents cross-system contamination — Trail of Cthulhu results won't appear when you're running Call of Cthulhu.

Start a session with the filter:
```
session_start(name: "Session 1", byod_system: "call of cthulhu")
```

### Search Details
- Returns matching chunks with highlighted snippets
- Use `get_byod_chunk(relative_path, chunk_index)` to retrieve the full chunk text (up to 8KB) for results that matter
- Multi-word queries try AND first, then OR for broad matching
- Use prefix searches with `*` (e.g., `combat*` matches combat, combative, etc.)
- Maximum 20 results returned per query
- When `byod_system` is set, results are filtered to filenames containing all words from the system name

## Audio Transcription

```
transcribe_audio(file_path, session_id?, chunk_size_seconds?)
```

Transcribe an audio file (WAV, MP3, M4A, FLAC) using local MLX Whisper. Requires `mlx_whisper` and `ffmpeg` to be installed.

**Chunked mode** (files over 3 minutes): The tool processes audio in 2-minute chunks. Each call transcribes one chunk and returns incremental results. Call again with the same `file_path` and `session_id` to continue until `complete` is true.

- Response includes `complete: false` with a note telling you to call again
- If `session_id` is provided, each chunk is auto-logged as a transcript segment with `source: "voice"`
- Progress is tracked per file — interrupted transcriptions can be resumed
- On completion, the full text is rebuilt from session transcript segments (no re-transcription)

## Search Strategy

1. **Always start with OGL or DW**: The built-in databases are faster and cover the core rules
2. **Be specific**: Search for the exact mechanic name or equipment item
3. **Try categories**: If a broad search returns too much, narrow with a `category`
4. **Use AI synthesis for natural questions**: `synthesize_ruling` auto-looks up rules and produces a cited answer
5. **Fall back to BYOD**: If OGL/DW doesn't have what you need, try `query_local_byod`
6. **Scope BYOD with byod_system**: Start sessions with the correct system name to avoid wrong-system results
7. **Combine searches**: For a complete picture, query both OGL/DW and BYOD — `synthesize_ruling` does this automatically
8. **Get full content**: Use `get_byod_chunk` to retrieve complete chunk text for results that matter

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

The Dungeon World database covers:

- **Moves**: Basic moves (Hack and Slash, Volley, Defy Danger, Defend, Spout Lore, Discern Realities, Parley), special moves, 10+/7-9/6- results for each
- **Classes**: Bard, Cleric, Druid, Fighter, Paladin, Ranger, Thief, Wizard — starting moves, gear, base HP, damage, alignment
- **Spells**: Cleric and Wizard spells by level, tags, full descriptions
- **Equipment**: Weapons, armour, dungeon gear, poison, services — tags, cost, weight, damage
- **Monsters**: Full stat blocks with tags, HP, armour, damage, instinct, moves, organisation
- **GM Tools**: Agendas, principles, fronts, dangers (types, impulses, moves), steadings
