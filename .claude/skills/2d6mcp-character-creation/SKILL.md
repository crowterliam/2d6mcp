---
name: 2d6-mcp-character-creation
description: UPP, characteristics, career paths, and skills for the 2d6mcp MCP server.
---

# 2D6 Character Creation & Handling

## Character Sheet Parsing

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

## Characteristic Bonuses

| Value | Bonus | Descriptor |
|-------|-------|------------|
| 0 | -3 | Nonexistent |
| 1–2 | -2 | Feeble |
| 3–5 | -1 | Below average |
| 6–8 | +0 | Average |
| 9–11 | +1 | Above average |
| 12–14 | +2 | Exceptional |
| 15 | +3 | Heroic |

## Career Paths

Look up careers with `query_ogl_rules("navy", category: "careers")`. Each career entry includes qualification, survival, advancement, skill tables, ranks, and mustering-out benefits.

## Character Creation Workflow

1. **Roll characteristics**: Six `roll_custom("2d6")` calls
2. **Choose a career**: Query career options with `query_ogl_rules(..., category: "careers")`
3. **Qualify**: `roll_2d6(characteristic_modifier, qualification_target)`
4. **Survive each term**: `roll_2d6(survival_modifier, survival_target)`
5. **Advance**: `roll_2d6(advancement_modifier, advancement_target)` (optional)
6. **Roll on skill tables**: Use `roll_table("Skill Table Name", "1d6")`
7. **Muster out**: Roll on mustering-out benefits table
8. **Buy equipment**: Look up gear with `query_ogl_rules(..., category: "equipment")`

## Skills

Skills have levels 0–4+. Level 0 = basic competence. Each level above 0 adds its value as a positive DM.

Common skills: Admin, Advocate, Animals, Astrogation, Athletics, Broker, Carouse, Comms, Computers, Deception, Diplomat, Drive, Engineer, Explosives, Flyer, Gambler, Gunner, Gun Combat, Heavy Weapons, Investigate, Jack of All Trades, Language, Leadership, Mechanic, Medic, Melee, Navigation, Persuade, Pilot, Profession, Recon, Science, Seafarer, Stealth, Steward, Streetwise, Survival, Tactics, Vacc Suit, Zero-G.
