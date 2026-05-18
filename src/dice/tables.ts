import { z } from "zod";

export interface TableEntry {
  min: number;
  max: number;
  result: string;
}

export interface TableDefinition {
  name: string;
  description?: string;
  diceType: "1d6" | "2d6" | "d66" | "1d3" | "2d3";
  entries: TableEntry[];
}

export function resolveDiceRange(diceType: string): number {
  switch (diceType) {
    case "1d6":
      return 6;
    case "2d6":
      return 12;
    case "d66":
      return 66;
    case "1d3":
      return 3;
    case "2d3":
      return 6;
    default:
      return 6;
  }
}

export function rollD66(): number {
  const tens = Math.floor(Math.random() * 6) + 1;
  const ones = Math.floor(Math.random() * 6) + 1;
  return tens * 10 + ones;
}

export function roll2d6Sum(): number {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return d1 + d2;
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
      diceResult = [
        Math.floor(rollValue / 10),
        rollValue % 10,
      ];
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
      rollValue =
        Math.floor(Math.random() * 3) +
        1 +
        (Math.floor(Math.random() * 3) + 1);
      diceResult = [];
      break;
    case "1d3":
      rollValue = Math.floor(Math.random() * 3) + 1;
      diceResult = [rollValue];
      break;
    default:
      rollValue = roll2d6Sum();
      diceResult = [];
  }

  const row = table.entries.find(
    (e) => rollValue >= e.min && rollValue <= e.max
  ) ?? null;

  const desc = row
    ? `Table "${table.name}" (${table.diceType}) rolled ${rollValue}: ${row.result}`
    : `Table "${table.name}" (${table.diceType}) rolled ${rollValue}: no matching entry`;

  return {
    tableName: table.name,
    diceType: table.diceType,
    diceResult,
    rollValue,
    row,
    description: desc,
  };
}

export function normalizeDiceType(input: string): "1d6" | "2d6" | "d66" | "1d3" | "2d3" {
  const norm = input.replace(/\s/g, "").toLowerCase();
  switch (norm) {
    case "1d6":
    case "d6":
      return "1d6";
    case "2d6":
      return "2d6";
    case "d66":
      return "d66";
    case "1d3":
    case "d3":
      return "1d3";
    case "2d3":
      return "2d3";
    default:
      return "2d6";
  }
}

export const RollTableInput = z.object({
  table_name: z.string().describe("Name of the table to roll on"),
  dice_type: z
    .enum(["1d6", "2d6", "d66", "1d3", "2d3"])
    .optional()
    .default("2d6")
    .describe("Dice type for the table (default: 2d6)"),
});
