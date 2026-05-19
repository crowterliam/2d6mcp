# /rules — Quick Rules Lookup

Query the 2d6mcp OGL rules database and BYOD index.

## Usage

```
/rules <search_term> [in <category>]
/rules table <table_name>
/rules byod <search_term>
```

## Examples

```
/rules combat
/rules "laser rifle" in equipment
/rules navy in careers
/rules "critical hit" in starships
/rules table "Reaction Table"
/rules byod "house rules initiative"
```

## Behaviour

- Without `in`, queries all categories
- `in` narrows to: rules, skills, careers, equipment, tables, combat, starships, worlds, categories, list_tables
- `table` rolls on and displays the named table
- `byod` searches your personal files (requires BYOD consent)
- Reports results with highlighted matches
