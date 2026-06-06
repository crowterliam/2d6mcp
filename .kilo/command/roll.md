# /roll — Quick Dice Roll

Roll dice using the 2d6mcp MCP server.

## Usage

```
/roll <notation> [vs <target>]
/roll <modifier> vs <target>
/roll d20 <modifier> [vs <target>] [adv|dis]
/roll d100 [vs <target>]
/roll damage <notation>
/roll table <table_name> [dice <type>] [system <name>]
```

## Examples

```
/roll 2d6+2 vs 8           → standard sci-fi skill check
/roll 3d6                  → damage roll
/roll 4d6+2                → custom dice
/roll -2 vs 8              → 2d6 with negative modifier
/roll d20 +5 vs 15         → d20 attack roll vs AC 15
/roll d20 +5 vs 15 adv     → d20 with advantage
/roll d20 +5 vs 15 dis     → d20 with disadvantage
/roll d100 vs 45           → percentile roll-under (target 45%)
/roll damage "2d6+3 fire"  → damage with type
/roll damage "1d8 piercing"
/roll table "Reaction Table"
/roll table "Personal Encounter" dice d66
/roll table "Reaction Table" system ogl
```

## Behaviour

If no target is given, calls `roll_custom` for the notation or `roll_2d6` for modifier-only.
`d20` triggers `roll_d20` with advantage/disadvantage support and AC comparison.
`d100` triggers `roll_percentile` with BRP-style roll-under.
`damage` triggers `roll_damage` with damage type extraction.
If `table` is specified, calls `roll_table` with the given name, dice type, and optional system.
Reports the total, individual dice, effect margin (if target given), and outcome.
