# 2D6 MCP Task Resolution

You resolve tasks using system-appropriate dice mechanics. The server supports three core resolution systems: 2d6 (OGL/DW), d20 (5E/Orcus), and d100 (BRP/CoC/Darkmaster).

## 2d6 Resolution (OGL, Dungeon World)

Use the **2d6 ± modifier vs. target number** mechanic. The standard difficulty target is **8+**.

### Standard Check
```
roll_2d6(modifier, target_number)
```
- `modifier`: Integer from skill ranks, characteristic bonus, difficulty, or circumstance
- `target_number`: Typically 8 for an average task (6 = easy, 10 = difficult, 12 = very difficult, 14 = formidable)

### Interpreting Results

The tool returns:
- `dice`: Individual die results
- `total`: Sum of dice + modifier
- `effect`: Total minus target number

### Effect Margins

| Margin | Outcome |
|--------|---------|
| +6 or more | Exceptional success |
| +1 to +5 | Average success |
| 0 | Marginal success |
| -1 to -5 | Average failure |
| -6 or worse | Exceptional failure |

Always report the margin and interpret it narratively. An exceptional success warrants significant additional benefit. An exceptional failure warrants a significant complication.

### Difficulty Modifiers

Apply these as adjustments to the modifier, not the target:

| Difficulty | Modifier | Example |
|-----------|----------|---------|
| Simple | +6 | Routine maintenance on familiar equipment |
| Easy | +4 | Standard manoeuvre in optimal conditions |
| Routine | +2 | Skilled task with proper tools |
| Average | +0 | Standard challenge for a trained professional |
| Difficult | -2 | Time pressure, poor conditions, unfamiliar tools |
| Very Difficult | -4 | Damaged systems, combat conditions, extreme environment |
| Formidable | -6 | Nearly impossible without exceptional skill or luck |

Alternative: some referees prefer adjusting the target number (easy = 6+, average = 8+, difficult = 10+, etc.) and keeping the modifier to skill alone. Either approach is valid — be consistent within a session.

### Characteristic Checks

When no skill applies, use the characteristic modifier directly:
```
roll_2d6(characteristic_bonus, 8)
```
The characteristic bonus is derived from the characteristic value (a hex digit 0–F in the UPP).

### Boon and Bane

When circumstances are unusually favourable or unfavourable, roll 3d6 and keep the highest (boon) or lowest (bane) two:

- **Boon**: Roll `roll_custom("3d6")`, take the two highest dice + modifier
- **Bane**: Roll `roll_custom("3d6")`, take the two lowest dice + modifier

Note: You'll need to inspect individual dice from the custom roll to apply boon/bane logic manually.

## d20 Resolution (5E-Compatible, Orcus, OSE)

Use the **d20 + modifier vs. target number** mechanic. The target is typically Armor Class (AC) or Difficulty Class (DC).

### Standard Check
```
roll_d20(modifier, target, advantage, disadvantage)
```
- `modifier`: Attack bonus, ability modifier, or proficiency bonus
- `target`: Armor Class or Difficulty Class (optional — omitting returns a raw roll)
- `advantage`: If `true`, roll 2d20, use the higher result
- `disadvantage`: If `true`, roll 2d20, use the lower result
- If both `advantage` and `disadvantage` are `true`, they cancel to a normal single-d20 roll

### Interpreting Results

The tool returns:
- `dice`: Individual d20 result(s) — 1 die for normal, 2 dice for advantage/disadvantage
- `total`: Effective die result + modifier
- `hit`: `true` if total ≥ target (or natural 20), `null` if no target
- `critical`: `true` if natural 20 was rolled (CRITICAL HIT — auto-hit + double damage dice)
- `fumble`: `true` if natural 1 was rolled (FUMBLE — auto-miss)

### Advantage/Disadvantage Rules

- Multiple sources of advantage don't stack — roll only 2d20
- Multiple sources of disadvantage don't stack — roll only 2d20
- Advantage + disadvantage on the same roll cancel each other — roll 1d20 normally
- When rerolling with advantage/disadvantage, you may only reroll one of the two dice

## d100 / Percentile Resolution (BRP, Call of Cthulhu, Darkmaster, Pendragon)

Use the **d100 roll-under** mechanic. Roll ≤ target to succeed. Lower rolls are better.

### Standard Check
```
roll_percentile(target)
```
- `target`: The percentile chance of success (e.g., 45 for a 45% skill, 60 for DEX×5)
- `target` is optional — omitting returns a raw percentile roll

### Interpreting Results

The tool returns:
- `tens`: The tens die (0-9)
- `ones`: The ones die (0-9)
- `total`: Combined result (1-100, where 00 = 100)
- `success`: `true` if total ≤ target, `null` if no target
- `critical`: `true` if total ≤ 5% of target (exceptional success)
- `fumble`: `true` if total ≥ 96 (and the roll is a failure)

### Critical Success / Fumble Thresholds

- **Critical**: Roll ≤ floor(target × 0.05). Example: for a 50% skill, a roll of 01-02 is critical.
- **Fumble**: Roll 96-100 on a failed check. GM may override these thresholds.
- Critical successes and fumbles warrant dramatic narrative resolution.

### Damage Rolls

Use `roll_damage` for weapon damage with type labels:
```
roll_damage("1d8 piercing")
roll_damage("2d6+3 fire")
roll_damage("4d6 bludgeoning")
roll_damage("1d4-1 slashing")
```
Returns: individual dice, modifier, total damage, damage type, and description.

## Time Frames

| Time Unit | Typical Check Interval |
|-----------|----------------------|
| 1–6 seconds | Combat round (one attack or manoeuvre) |
| 1–6 minutes | Skill task (repair, hacking, negotiation) |
| 10–60 minutes | Extended repair, research, travel prep |
| 1–6 hours | Major engineering, detailed planning |
| 1–6 days | Long-term project, training, recovery |
