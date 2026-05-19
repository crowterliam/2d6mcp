# 2D6 Task Resolution

You resolve tasks using the **2d6 ± modifier vs. target number** mechanic. The standard difficulty target is **8+**.

## Rolling Dice

### Standard Check
```
roll_2d6(modifier, target_number)
```
- `modifier`: Integer from skill ranks, characteristic bonus, difficulty, or circumstance
- `target_number`: Typically 8 for an average task (6 = easy, 10 = difficult, 12 = very difficult, 14 = formidable)

### Custom Dice
```
roll_custom("Nd6+/-M")
```
Use for non-standard rolls: damage (`3d6-3`), characteristic rolling (`2d6` × 6), d66 tables (`d66`), or any other dice notation.

## Interpreting Results

The tool returns:
- `dice`: Individual die results
- `total`: Sum of dice + modifier
- `effect`: Total minus target number (returns `-1` if no target set)

### Effect Margins

| Margin | Outcome |
|--------|---------|
| +6 or more | Exceptional success |
| +1 to +5 | Average success |
| 0 | Marginal success |
| -1 to -5 | Average failure |
| -6 or worse | Exceptional failure |

Always report the margin and interpret it narratively. An exceptional success warrants significant additional benefit. An exceptional failure warrants a significant complication.

## Difficulty Modifiers

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

## Characteristic Checks

When no skill applies, use the characteristic modifier directly:
```
roll_2d6(characteristic_bonus, 8)
```
The characteristic bonus is derived from the characteristic value (a hex digit 0–F in the UPP).

## Boon and Bane

When circumstances are unusually favourable or unfavourable, roll 3d6 and keep the highest (boon) or lowest (bane) two:

- **Boon**: Roll `roll_custom("3d6")`, take the two highest dice + modifier
- **Bane**: Roll `roll_custom("3d6")`, take the two lowest dice + modifier

Note: You'll need to inspect individual dice from the custom roll to apply boon/bane logic manually.

## Time Frames

| Time Unit | Typical Check Interval |
|-----------|----------------------|
| 1–6 seconds | Combat round (one attack or manoeuvre) |
| 1–6 minutes | Skill task (repair, hacking, negotiation) |
| 10–60 minutes | Extended repair, research, travel prep |
| 1–6 hours | Major engineering, detailed planning |
| 1–6 days | Long-term project, training, recovery |
