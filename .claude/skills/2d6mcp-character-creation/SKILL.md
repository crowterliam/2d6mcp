---
name: 2d6-mcp-character-creation
description: Multi-system character creation — UPP, characteristics, career paths, classes, and skills for the 2d6mcp MCP server.
---

# 2D6 Multi-System Character Creation & Handling

Character creation and parsing is supported across all game systems. The `parse_character` tool extracts structured data from any character sheet file text or JSON. Below are the system-specific workflows.

## 2d6 Sci-Fi RPG (OGL/Cepheus Engine)

### Character Sheet Parsing

```
parse_character(file_path)
```

Parses a character sheet file (text or JSON) and returns structured data: `name`, `career`, `upp`, `characteristics` (strength, dexterity, endurance, intellect, education, social), and `skills` array.

### UPP Format

The Universal Personality Profile is an 8-character hex string:
```
A7B942-A
││││││ │
││││││ └── Social Standing (0–F)
│││││└──── Education (0–F)  
││││└───── Intellect (0–F)
│││└────── Endurance (0–F)
││└─────── Dexterity (0–F)
│└──────── Strength (0–F)
└───────── (reserved/age indicator)
```

### Characteristic Bonuses

| Value | Bonus | Descriptor |
|-------|-------|------------|
| 0 | -3 | Nonexistent |
| 1–2 | -2 | Feeble |
| 3–5 | -1 | Below average |
| 6–8 | +0 | Average |
| 9–11 | +1 | Above average |
| 12–14 | +2 | Exceptional |
| 15 | +3 | Heroic |

### Career Paths

Look up careers with `query_ogl_rules("navy", category: "careers")`. Each career entry includes qualification, survival, advancement, skill tables, ranks, and mustering-out benefits.

### Character Creation Workflow

1. **Roll characteristics**: Six `roll_custom("2d6")` calls
2. **Choose a career**: Query career options with `query_ogl_rules(..., category: "careers")`
3. **Qualify**: `roll_2d6(characteristic_modifier, qualification_target)`
4. **Survive each term**: `roll_2d6(survival_modifier, survival_target)`
5. **Advance**: `roll_2d6(advancement_modifier, advancement_target)` (optional)
6. **Roll on skill tables**: Use `roll_table("Skill Table Name", "1d6")`
7. **Muster out**: Roll on mustering-out benefits table
8. **Buy equipment**: Look up gear with `query_ogl_rules(..., category: "equipment")`

### Skills

Skills have levels 0–4+. Level 0 = basic competence. Each level above 0 adds its value as a positive DM. Common skills: Admin, Advocate, Animals, Astrogation, Athletics, Broker, Carouse, Comms, Computers, Deception, Diplomat, Drive, Engineer, Explosives, Flyer, Gambler, Gunner, Gun Combat, Heavy Weapons, Investigate, Jack of All Trades, Language, Leadership, Mechanic, Medic, Melee, Navigation, Persuade, Pilot, Profession, Recon, Science, Seafarer, Stealth, Steward, Streetwise, Survival, Tactics, Vacc Suit, Zero-G.

## 2d6 Fantasy RPG (Dungeon World)

DW character creation uses classes and moves rather than UPP:

1. **Choose a class**: `query_dw_rules("wizard", category: "classes")` for class description, starting moves, gear, base HP, and damage
2. **Roll stats**: Assign array of scores (16, 15, 13, 12, 9, 8) to STR, DEX, CON, INT, WIS, CHA
3. **Choose race**: Each class lists race options with additional moves
4. **Assign alignment**: Each class provides alignment options that grant XP triggers
5. **Choose bonds**: Write connections to other party members
6. **Select gear**: From class-provided loadout and dungeon gear options — `query_dw_rules("dungeon rations", category: "equipment")` for details

### Key Differences from 2d6 Sci-Fi
- No UPP — characteristics use standard 3-18 range with modifiers
- No career path system — single class with alignment and bonds
- HP is class-based (e.g., Wizard 4+CON, Fighter 10+CON)
- Damage is class die (d4 to d10), not weapon-based
- All resolution uses 2d6 + stat modifier, no skill levels

## Percentile RPG (BRP/Call of Cthulhu)

BRP character creation uses percentile characteristics and skills:

1. **Roll characteristics**: `query_brp_rules("characteristics", category: "characteristics")` for stat definitions
2. **Calculate derived stats**: Hit points, damage bonus, idea/luck/know rolls — use `query_brp_rules("derived", category: "characteristics")`
3. **Choose profession**: `query_brp_rules("soldier", category: "professions")` for skill packages
4. **Allocate skill points**: Base chances from profession + personal interest points
5. **Select equipment**: `query_brp_rules("sword", category: "weapons")` or `query_brp_rules("armor", category: "armor")`

**Resolution**: `roll_percentile(target)` where target = skill percentage

## d20 Fantasy RPG (5E-Compatible)

5E character creation uses the d20 system:

1. **Generate ability scores**: `roll_custom("4d6")` (drop lowest) six times, or use point buy/standard array
2. **Choose species**: `query_5ecompatible_rules("elf", category: "rules")` for traits
3. **Choose class**: `query_5ecompatible_rules("fighter", category: "classes")` for features, proficiencies, hit dice
4. **Choose feats** (if allowed): `query_5ecompatible_rules("tough", category: "feats")`
5. **Select spells** (if caster): `query_5ecompatible_rules("fireball", category: "spells")`

**Resolution**: `roll_d20(modifier, target, advantage?, disadvantage?)`

## 4E-Compatible RPG (Orcus)

Orcus character creation uses the d20 system with class traditions:

1. **Choose class and tradition**: `query_orcus_rules("Commander", category: "classes")` — each class has a tradition (role within the class)
2. **Assign key abilities**: Each class lists a primary key ability
3. **Select trained skills**: From class-provided list
4. **Calculate defenses**: AC, Fortitude, Reflex, Will — provided in class data
5. **Choose feats**: `query_orcus_rules("Athame", category: "feats")`

**Resolution**: `roll_d20(modifier, target, advantage?, disadvantage?)` — target is the relevant defense score
