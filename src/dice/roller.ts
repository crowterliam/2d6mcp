import { z } from "zod";

export interface DiceRoll {
  count: number;
  sides: number;
  modifier: number;
}

export interface Roll2d6Result {
  dice: number[];
  modifier: number;
  total: number;
  target: number | null;
  effect: number | null;
  success: boolean | null;
  description: string;
}

const DICE_REGEX = /^(\d+)?d(\d+)([+-]\d+)?$/i;

export function parseDiceNotation(notation: string): DiceRoll {
  const match = notation.replace(/\s/g, "").match(DICE_REGEX);
  if (!match) {
    throw new Error(
      `Invalid dice notation: "${notation}". Expected format like "2d6", "3d6+2", or "d66".`
    );
  }
  let sides = parseInt(match[2], 10);
  let count = match[1] ? parseInt(match[1], 10) : 1;
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  if (sides === 66) {
    sides = 6;
    count = 2;
  }

  if (sides < 2) throw new Error("Dice must have at least 2 sides.");
  if (count < 1) throw new Error("Must roll at least 1 die.");
  if (count > 100) throw new Error("Cannot roll more than 100 dice at once.");

  return { count, sides, modifier };
}

function rollDice(count: number, sides: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }
  return results;
}

export function roll2d6(
  modifier = 0,
  target: number | null = null
): Roll2d6Result {
  const dice = rollDice(2, 6);
  const rawSum = dice.reduce((a, b) => a + b, 0);
  const total = rawSum + modifier;
  let effect: number | null = null;
  let success: boolean | null = null;

  if (target !== null) {
    effect = total - target;
    success = total >= target;
  }

  const modStr =
    modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : "";
  const targetStr = target !== null ? ` (target: ${target})` : "";
  const desc = `[${dice[0]}, ${dice[1]}]${modStr} = ${total}${targetStr}`;

  return { dice, modifier, total, target, effect, success, description: desc };
}

export function rollCustom(notation: string): {
  dice: number[];
  modifier: number;
  total: number;
  notation: string;
} {
  const parsed = parseDiceNotation(notation);
  const dice = rollDice(parsed.count, parsed.sides);
  const sum = dice.reduce((a, b) => a + b, 0);
  const total = sum + parsed.modifier;

  return {
    dice,
    modifier: parsed.modifier,
    total,
    notation: `${parsed.count}d${parsed.sides}${
      parsed.modifier > 0
        ? "+" + parsed.modifier
        : parsed.modifier < 0
        ? parsed.modifier.toString()
        : ""
    }`,
  };
}

export const Roll2d6Input = z.object({
  modifier: z.number().int().default(0).describe("Modifier added to the 2d6 roll"),
  target_number: z
    .number()
    .int()
    .optional()
    .describe("Target number to roll against; if provided, effect margin is calculated"),
});

export const RollCustomInput = z.object({
  notation: z
    .string()
    .describe('Dice notation, e.g. "2d6", "3d6+2", "1d20-1"'),
});
