# /roll — Quick Dice Roll

Roll dice using the 2d6mcp MCP server.

## Usage

```
/roll <notation> [vs <target>]
/roll <modifier> vs <target>
/roll table <table_name> [dice <type>]
```

## Examples

```
/roll 2d6+2 vs 8          → standard skill check
/roll 3d6                 → damage roll
/roll 4d6+2               → custom dice
/roll -2 vs 8             → 2d6 with negative modifier
/roll table "Reaction Table"
/roll table "Personal Encounter" dice d66
```

## Behaviour

If no target is given, calls `roll_custom` for the notation or `roll_2d6` for modifier-only.
If `table` is specified, calls `roll_table` with the given name and dice type.
Reports the total, individual dice, effect margin (if target given), and outcome.
