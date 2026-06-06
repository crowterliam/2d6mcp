// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Shared table rolling — platform-agnostic, used by Worker and MCP server.

import { z } from "zod";

export interface TableEntry {
  min: number;
  max: number;
  result: string;
}

export interface TableDefinition {
  name: string;
  description?: string;
  diceType: "1d6" | "2d6" | "d66" | "1d3" | "2d3" | "d4" | "d8" | "d10" | "d12" | "d20" | "d100";
  entries: TableEntry[];
}

export function resolveDiceRange(diceType: string): number {
  switch (diceType) {
    case "1d6": return 6;
    case "2d6": return 12;
    case "d66": return 66;
    case "1d3": return 3;
    case "2d3": return 6;
    case "d4": return 4;
    case "d8": return 8;
    case "d10": return 10;
    case "d12": return 12;
    case "d20": return 20;
    case "d100": return 100;
    default: return 6;
  }
}

export function rollD66(): number {
  const tens = Math.floor(Math.random() * 6) + 1;
  const ones = Math.floor(Math.random() * 6) + 1;
  return tens * 10 + ones;
}

export function roll2d6Sum(): number {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
}

export function rollOnTable(table: TableDefinition): {
  tableName: string;
  diceType: string;
  diceResult: number[];
  rollValue: number;
  row: TableEntry | null;
  description: string;
} {
  let diceResult: number[];
  let rollValue: number;

  switch (table.diceType) {
    case "d66":
      rollValue = rollD66();
      diceResult = [Math.floor(rollValue / 10), rollValue % 10];
      break;
    case "2d6":
      rollValue = roll2d6Sum();
      diceResult = [];
      break;
    case "1d6":
      rollValue = Math.floor(Math.random() * 6) + 1;
      diceResult = [rollValue];
      break;
    case "2d3":
      rollValue = Math.floor(Math.random() * 3) + 1 + (Math.floor(Math.random() * 3) + 1);
      diceResult = [];
      break;
    case "1d3":
      rollValue = Math.floor(Math.random() * 3) + 1;
      diceResult = [rollValue];
      break;
    case "d4":
      rollValue = Math.floor(Math.random() * 4) + 1;
      diceResult = [rollValue];
      break;
    case "d8":
      rollValue = Math.floor(Math.random() * 8) + 1;
      diceResult = [rollValue];
      break;
    case "d10":
      rollValue = Math.floor(Math.random() * 10) + 1;
      diceResult = [rollValue];
      break;
    case "d12":
      rollValue = Math.floor(Math.random() * 12) + 1;
      diceResult = [rollValue];
      break;
    case "d20":
      rollValue = Math.floor(Math.random() * 20) + 1;
      diceResult = [rollValue];
      break;
    case "d100":
      rollValue = Math.floor(Math.random() * 100) + 1;
      diceResult = [rollValue];
      break;
    default:
      rollValue = roll2d6Sum();
      diceResult = [];
  }

  const row = table.entries.find((e) => rollValue >= e.min && rollValue <= e.max) ?? null;
  const desc = row
    ? `Table "${table.name}" (${table.diceType}) rolled ${rollValue}: ${row.result}`
    : `Table "${table.name}" (${table.diceType}) rolled ${rollValue}: no matching entry`;

  return { tableName: table.name, diceType: table.diceType, diceResult, rollValue, row, description: desc };
}

export function normalizeDiceType(input: string): "1d6" | "2d6" | "d66" | "1d3" | "2d3" | "d4" | "d8" | "d10" | "d12" | "d20" | "d100" {
  const norm = input.replace(/\s/g, "").toLowerCase();
  switch (norm) {
    case "1d6": case "d6": return "1d6";
    case "2d6": return "2d6";
    case "d66": return "d66";
    case "1d3": case "d3": return "1d3";
    case "2d3": return "2d3";
    case "1d4": case "d4": return "d4";
    case "1d8": case "d8": return "d8";
    case "1d10": case "d10": return "d10";
    case "1d12": case "d12": return "d12";
    case "1d20": case "d20": return "d20";
    case "1d100": case "d100": return "d100";
    default: return "2d6";
  }
}

export const RollTableInput = z.object({
  table_name: z.string(),
  dice_type: z.enum(["1d6", "2d6", "d66", "1d3", "2d3", "d4", "d8", "d10", "d12", "d20", "d100"]).optional().default("2d6"),
});
