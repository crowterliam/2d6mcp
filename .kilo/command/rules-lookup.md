# /rules — Quick Rules Lookup and AI Ruling

Query the 2d6mcp rules databases, synthesize AI rulings, and manage game sessions.

## Usage

```
/rules <search_term> [in <category>]
/rules table <table_name>
/rules byod <search_term>
/rules dw <search_term> [in <category>]
/rules brp <search_term> [in <category>]
/rules 5e <search_term> [in <category>]
/rules 4e <search_term> [in <category>]
/rules ai <question>
/rules resolve [<minutes>]
```

## Examples

```
/rules combat
/rules "laser rifle" in equipment
/rules navy in careers
/rules dw "hack and slash"
/rules dw wizard in classes
/rules brp "characteristics" in characteristics
/rules 5e fireball in spells
/rules 4e Commander in classes
/rules table "Reaction Table"
/rules byod "house rules initiative"
/rules ai "Can I grapple while prone?"
/rules resolve
/rules resolve 3
```

## Behaviour

- Without `in`, queries all categories in OGL
- `in` narrows to: rules, skills, careers, equipment, tables, combat, starships, worlds, categories, list_tables
- `dw` searches the Dungeon World database (moves, classes, spells, equipment, monsters, gm_tools)
- `brp` searches the Basic Roleplaying database (characteristics, skills, professions, weapons, armor, spot_rules, foes)
- `5e` searches the 5E-compatible database (spells, monsters, classes, feats, rules)
- `4e` searches the Orcus 4e-compatible database (classes, monsters, feats, rules)
- `table` rolls on and displays the named table. Use `system` to specify database (ogl/dw/brp/5ecompatible/orcus).
- `byod` searches your personal files (requires BYOD consent)
- `ai` uses `synthesize_ruling` to auto-look up rules from all databases and produce a cited ruling
- `resolve` uses `resolve_from_context` to take recent session transcript, detect the rules question, look up rules, and synthesize a ruling
- `resolve <minutes>` specifies how many minutes of transcript to use as context (default: 2)

## Session Integration

Start a session to scope BYOD searches and enable the `resolve` command:

```
session_start(name: "Session 12", byod_system: "call of cthulhu")
```

The `byod_system` parameter ensures `synthesize_ruling` and `resolve_from_context` only search files from that game system. Omit to search all BYOD content.

## Audio Transcription

Transcribe recorded game sessions directly:

```
/transcribe <file_path>
```

For large files (3+ minutes), this runs in chunked mode. Each call processes one chunk — repeat until complete. Auto-logs to the current session if one is active.
