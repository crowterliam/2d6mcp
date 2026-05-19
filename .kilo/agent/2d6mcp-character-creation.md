# 2D6 Character Creation & Handling

## Character Sheet Parsing

```
parse_character(file_path)
```

Parses a character sheet file (text or JSON) and returns structured data:

| Field | Description |
|-------|-------------|
| `name` | Character name |
| `career` | Current or former career |
| `upp` | Universal Personality Profile (8-char hex string) |
| `characteristics` | `{ strength, dexterity, endurance, intellect, education, social }` — each 2–15 |
| `skills` | Array of `{ name, level }` |

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

Each position uses hex (0–F), representing characteristic values 0–15.

## Characteristic Rolling

To generate a new character's six characteristics:
```
roll_custom("2d6")  — call 6 times, record each result
```

Assign results to characteristics in order (Strength, Dexterity, Endurance, Intellect, Education, Social Standing) or allow the player to arrange as desired.

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

## Career Paths

To look up a career:
```
query_ogl_rules("navy", category: "careers")
query_ogl_rules("scout", category: "careers")
query_ogl_rules("merchant", category: "careers")
```

Each career entry includes:
- **Qualification**: Required characteristic roll to enter
- **Survival**: Roll required each term to avoid mishap
- **Advancement**: Roll to gain rank
- **Skill tables**: Personal development, service skills, advanced education, specialist
- **Ranks**: Title and skill bonus per rank
- **Mustering-out benefits**: Cash and material benefits on leaving the service

## Character Creation Workflow

1. **Roll characteristics**: Six `roll_custom("2d6")` calls
2. **Choose a career**: Query career options with `query_ogl_rules(..., category: "careers")`
3. **Qualify**: `roll_2d6(characteristic_modifier, qualification_target)`
4. **Survive each term**: `roll_2d6(survival_modifier, survival_target)`
5. **Advance**: `roll_2d6(advancement_modifier, advancement_target)` (optional)
6. **Roll on skill tables**: Use `roll_table("Skill Table Name", "1d6")` for each skill earned
7. **Muster out**: Roll on mustering-out benefits table
8. **Age**: Apply aging effects if applicable
9. **Buy equipment**: Look up available gear with `query_ogl_rules(..., category: "equipment")`

## Skills

Skills have levels 0–4+. Level 0 represents basic competence (no penalty for unskilled use). Each level above 0 adds its value as a positive DM.

Common skills include: Admin, Advocate, Animals, Astrogation, Athletics, Battle Dress, Broker, Carouse, Comms, Computers, Deception, Diplomat, Drive, Engineer, Explosives, Flyer, Gambler, Gunner, Gun Combat, Heavy Weapons, Investigate, Jack of All Trades, Language, Leadership, Mechanic, Medic, Melee, Navigation, Persuade, Pilot, Profession, Recon, Science, Seafarer, Stealth, Steward, Streetwise, Survival, Tactics, Vacc Suit, Zero-G.
