// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Shared dice roller — platform-agnostic, used by Worker and MCP server.

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

export interface RollCustomResult {
  dice: number[];
  modifier: number;
  total: number;
  notation: string;
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

export function rollCustom(notation: string): RollCustomResult {
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

export function isValidDiceNotation(notation: string): boolean {
  try {
    parseDiceNotation(notation);
    return true;
  } catch {
    return false;
  }
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

// ---------------------------------------------------------------------------
// d20 resolution — advantage/disadvantage, AC comparison, critical hit/miss
// ---------------------------------------------------------------------------

export interface RollD20Result {
  dice: number[];
  modifier: number;
  total: number;
  advantage: boolean | null;
  disadvantage: boolean | null;
  target: number | null;
  hit: boolean | null;
  critical: boolean;
  fumble: boolean;
  description: string;
}

export function rollD20(
  modifier = 0,
  target: number | null = null,
  advantage = false,
  disadvantage = false
): RollD20Result {
  if (advantage && disadvantage) {
    advantage = false;
    disadvantage = false;
  }

  let dice: number[];
  if (advantage) {
    const d1 = Math.floor(Math.random() * 20) + 1;
    const d2 = Math.floor(Math.random() * 20) + 1;
    dice = [d1, d2];
  } else if (disadvantage) {
    const d1 = Math.floor(Math.random() * 20) + 1;
    const d2 = Math.floor(Math.random() * 20) + 1;
    dice = [d1, d2];
  } else {
    dice = [Math.floor(Math.random() * 20) + 1];
  }

  const effective = advantage
    ? Math.max(...dice)
    : disadvantage
    ? Math.min(...dice)
    : dice[0];

  const total = effective + modifier;
  const critical = effective === 20;
  const fumble = effective === 1;
  let hit: boolean | null = null;
  if (target !== null) {
    hit = critical || total >= target;
  }

  const advStr = advantage ? " (advantage)" : disadvantage ? " (disadvantage)" : "";
  const modStr =
    modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : "";
  const critStr = critical ? " — CRITICAL HIT!" : fumble ? " — FUMBLE!" : "";
  const targetStr = target !== null ? ` vs AC ${target}` : "";
  const diceStr = dice.length > 1
    ? `[${dice[0]}, ${dice[1]}] → ${effective}`
    : `[${dice[0]}]`;

  const desc = `${diceStr}${modStr} = ${total}${targetStr}${advStr}${critStr}`;

  return { dice, modifier, total, advantage, disadvantage, target, hit, critical, fumble, description: desc };
}

// ---------------------------------------------------------------------------
// Percentile / d100 resolution — BRP-style roll-under
// ---------------------------------------------------------------------------

export interface RollPercentileResult {
  tens: number;
  ones: number;
  total: number;
  target: number | null;
  success: boolean | null;
  critical: boolean;
  fumble: boolean;
  description: string;
}

export function rollPercentile(
  target: number | null = null
): RollPercentileResult {
  const tens = Math.floor(Math.random() * 10);
  const ones = Math.floor(Math.random() * 10);
  let total: number;
  if (tens === 0 && ones === 0) {
    total = 100;
  } else {
    total = tens * 10 + ones;
  }

  let success: boolean | null = null;
  let critical = false;
  let fumble = false;
  if (target !== null) {
    success = total <= target;
    critical = total <= Math.floor(target * 0.05);
    fumble = total >= 96;
  }

  const targetStr = target !== null ? ` (target: ≤${target})` : "";
  const successStr =
    success === true
      ? critical
        ? " — CRITICAL!"
        : " — Success"
      : success === false
      ? fumble
        ? " — FUMBLE!"
        : " — Failure"
      : "";
  const desc = `[${String(tens)}${String(ones)}] = ${total}${targetStr}${successStr}`;

  return { tens, ones, total, target, success, critical, fumble, description: desc };
}

// ---------------------------------------------------------------------------
// Damage dice parser & roller — parses expressions like "2d6+3 fire"
// ---------------------------------------------------------------------------

const DAMAGE_REGEX = /^(\d+)?d(\d+)([+-]\d+)?(?:\s+(.+))?$/i;

export interface RollDamageResult {
  dice: number[];
  modifier: number;
  total: number;
  damageType: string | null;
  notation: string;
  description: string;
}

export function parseDamageNotation(notation: string): {
  count: number;
  sides: number;
  modifier: number;
  damageType: string | null;
} {
  const match = notation.trim().match(DAMAGE_REGEX);
  if (!match) {
    throw new Error(
      `Invalid damage notation: "${notation}". Expected format like "2d6", "2d6+3 fire", "1d8 piercing".`
    );
  }
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  const damageType = match[4] ? match[4].trim() : null;

  if (sides < 2) throw new Error("Damage dice must have at least 2 sides.");
  if (count < 1) throw new Error("Must roll at least 1 damage die.");
  if (count > 100) throw new Error("Cannot roll more than 100 damage dice.");

  return { count, sides, modifier, damageType };
}

export function rollDamage(notation: string): RollDamageResult {
  const parsed = parseDamageNotation(notation);
  const dice: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    dice.push(Math.floor(Math.random() * parsed.sides) + 1);
  }
  const sum = dice.reduce((a, b) => a + b, 0);
  const total = sum + parsed.modifier;

  const modStr =
    parsed.modifier > 0 ? `+${parsed.modifier}` : parsed.modifier < 0 ? `${parsed.modifier}` : "";
  const typeStr = parsed.damageType ? ` ${parsed.damageType}` : "";
  const normNotation = `${parsed.count}d${parsed.sides}${modStr}${typeStr}`;
  const desc = `[${dice.join(", ")}]${modStr}${typeStr} = ${total} damage`;

  return { dice, modifier: parsed.modifier, total, damageType: parsed.damageType, notation: normNotation, description: desc };
}

export const RollD20Input = z.object({
  modifier: z.number().int().default(0).describe("Attack bonus added to the d20 roll"),
  target: z.number().int().optional().describe("Target number (e.g., Armor Class, DC) to compare against"),
  advantage: z.boolean().default(false).describe("Roll with advantage (roll 2d20, take higher)"),
  disadvantage: z.boolean().default(false).describe("Roll with disadvantage (roll 2d20, take lower). If both advantage and disadvantage, they cancel to a normal roll."),
});

export const RollPercentileInput = z.object({
  target: z.number().int().optional().describe("Target percentile — roll ≤ target to succeed (BRP-style). 5% of target is critical success threshold."),
});

export const RollDamageInput = z.object({
  notation: z.string().describe('Damage dice notation, e.g. "2d6+3 fire", "1d8 piercing", "4d6", "1d4-1 slashing"'),
});

export type Roll2d6Params = z.infer<typeof Roll2d6Input>;
export type RollCustomParams = z.infer<typeof RollCustomInput>;
export type RollD20Params = z.infer<typeof RollD20Input>;
export type RollPercentileParams = z.infer<typeof RollPercentileInput>;
export type RollDamageParams = z.infer<typeof RollDamageInput>;
