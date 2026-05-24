// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// System-agnostic random table parser — detects and parses die-range tables
// from plain text, markdown, or PDF-extracted content. Works across all RPG
// systems (d100, d20, 2d6, d66, 1d6, 1d4, 1d8, 1d10, 1d12, 3d6, etc.).

export interface ParsedTableEntry {
  min: number;
  max: number;
  result: string;
}

export interface ParsedTable {
  entries: ParsedTableEntry[];
  diceNotation: string;
  minRoll: number;
  maxRoll: number;
}

const DICE_PATTERN = /^(\d*)d(\d+)$/i;

function rollDice(count: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

export function rollForTable(table: ParsedTable): {
  diceResult: number;
  entry: ParsedTableEntry | null;
} {
  const match = table.diceNotation.match(DICE_PATTERN);
  if (!match) {
    const val = Math.floor(Math.random() * table.maxRoll) + table.minRoll;
    const entry = table.entries.find((e) => val >= e.min && val <= e.max) ?? null;
    return { diceResult: val, entry };
  }

  const count = parseInt(match[1] || "1", 10);
  const sides = parseInt(match[2], 10);

  let diceResult: number;
  if (sides === 66) {
    const tens = Math.floor(Math.random() * 6) + 1;
    const ones = Math.floor(Math.random() * 6) + 1;
    diceResult = tens * 10 + ones;
  } else if (sides === 100 || sides === 0) {
    diceResult = Math.floor(Math.random() * 100) + 1;
  } else {
    diceResult = rollDice(count, sides);
  }

  const entry = table.entries.find((e) => diceResult >= e.min && diceResult <= e.max) ?? null;
  return { diceResult, entry };
}

function normalizeRangeValue(val: number): number {
  if (val === 0) return 100;
  return val;
}

const RANGE_PATTERNS: RegExp[] = [
  /^(\d{1,4})\s*[-\u2013\u2014]+\s*(\d{1,4})\s*$/,
  /^(\d{1,4})$/,
];

function parseRangeCell(cell: string): { min: number; max: number } | null {
  const trimmed = cell.trim();
  for (const pattern of RANGE_PATTERNS) {
    const m = trimmed.match(pattern);
    if (m) {
      let min = parseInt(m[1], 10);
      let max = m[2] ? parseInt(m[2], 10) : min;
      min = normalizeRangeValue(min);
      max = normalizeRangeValue(max);
      if (!isNaN(min) && !isNaN(max) && min > 0 && max >= min && max <= 1000) {
        return { min, max };
      }
    }
  }
  return null;
}

function isTableHeader(line: string): boolean {
  const lower = line.toLowerCase().replace(/[^a-z0-9|\-\s]/g, "");
  return (
    lower.includes("d100") ||
    lower.includes("d20") ||
    lower.includes("2d6") ||
    lower.includes("1d6") ||
    lower.includes("d66") ||
    lower.includes("d10") ||
    lower.includes("d8") ||
    lower.includes("d12") ||
    lower.includes("d4") ||
    lower.includes("d%") ||
    (lower.includes("roll") && (lower.includes("result") || lower.includes("encounter") || lower.includes("effect")))
  );
}

export function extractDiceFromHeader(line: string): string | null {
  const lower = line.toLowerCase();
  const patterns: [RegExp, string][] = [
    [/\bd100\b/, "1d100"],
    [/\bd%\b/, "1d100"],
    [/\b3d6\b/, "3d6"],
    [/\b2d6\b/, "2d6"],
    [/\bd66\b/, "d66"],
    [/\b2d10\b/, "2d10"],
    [/\b2d4\b/, "2d4"],
    [/\b1d20\b/, "1d20"],
    [/\bd20\b/, "1d20"],
    [/\b1d12\b/, "1d12"],
    [/\bd12\b/, "1d12"],
    [/\b1d10\b/, "1d10"],
    [/\bd10\b/, "1d10"],
    [/\b1d8\b/, "1d8"],
    [/\bd8\b/, "1d8"],
    [/\b1d6\b/, "1d6"],
    [/\bd6\b/, "1d6"],
    [/\b1d4\b/, "1d4"],
    [/\bd4\b/, "1d4"],
  ];
  for (const [regex, notation] of patterns) {
    if (regex.test(lower)) return notation;
  }
  return null;
}

export function inferDiceNotation(entries: ParsedTableEntry[]): string {
  if (entries.length === 0) return "1d6";

  const maxVal = Math.max(...entries.map((e) => e.max));
  const minVal = Math.min(...entries.map((e) => e.min));

  if (maxVal <= 0) return "1d6";

  if (maxVal <= 4 && minVal >= 1) return "1d4";
  if (maxVal <= 6 && minVal >= 1) return "1d6";
  if (maxVal <= 8 && minVal >= 1) return "1d8";
  if (maxVal <= 10 && minVal >= 1) return "1d10";
  if (maxVal <= 12 && minVal >= 2) return "2d6";
  if (maxVal <= 12 && minVal >= 1) return "1d12";
  if (maxVal <= 20 && minVal >= 1) return "1d20";
  if (maxVal <= 36 && minVal >= 11) return "d66";
  if (maxVal <= 66 && minVal >= 11) return "d66";
  if (maxVal <= 100 && minVal >= 1) return "1d100";
  if (maxVal <= 200 && minVal >= 1) return "2d100";

  return "1d100";
}

export function parseTableFromText(text: string): ParsedTable | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  let headerDice: string | null = null;
  let dataStart = 0;
  let foundHeader = false;

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    if (line.replace(/[\s|]/g, "").length === 0) continue;
    if (line.match(/^[-+\s|:]+$/)) continue;

    const dice = extractDiceFromHeader(line);
    if (isTableHeader(line)) {
      headerDice = dice;
      dataStart = i + 1;
      foundHeader = true;
      break;
    }

    const rangeCell = parseRangeCell(line.split(/[\t|]/)[0]);
    if (rangeCell) {
      dataStart = i;
      foundHeader = true;
      break;
    }
  }

  if (!foundHeader) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.replace(/[\s|]/g, "").length === 0) continue;
      if (line.match(/^[-+\s|:]+$/)) continue;

      const rangeCell = parseRangeCell(line.split(/[\t|]/)[0]);
      if (rangeCell) {
        dataStart = i;
        foundHeader = true;
        break;
      }
    }
  }

  const entries: ParsedTableEntry[] = [];
  const seen = new Set<string>();

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.match(/^[-+\s|:]+$/)) continue;

    let parts: string[];

    if (line.includes("\t")) {
      parts = line.split("\t");
    } else if (line.includes("|")) {
      parts = line.split("|").map((p) => p.trim()).filter((p) => p.length > 0);
    } else {
      const match = line.match(/^(\d{1,4}(?:\s*[-\u2013\u2014]+\s*\d{1,4})?)\s*[.)\]:]+\s*(.*)/);
      if (match) {
        parts = [match[1], match[2]];
      } else {
        const wsMatch = line.match(/^(\d{1,4}(?:\s*[-\u2013\u2014]+\s*\d{1,4})?)\s+(.*)/);
        if (wsMatch) {
          parts = [wsMatch[1], wsMatch[2]];
        } else {
          continue;
        }
      }
    }

    if (parts.length < 2) continue;

    const range = parseRangeCell(parts[0]);
    if (!range) continue;

    const result = parts.slice(1).join(" ").trim();
    if (!result || result.length < 1) continue;

    const key = `${range.min}-${range.max}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({ min: range.min, max: range.max, result });
  }

  if (entries.length < 2) return null;

  const diceNotation = headerDice || inferDiceNotation(entries);
  const minRoll = Math.min(...entries.map((e) => e.min));
  const maxRoll = Math.max(...entries.map((e) => e.max));

  return { entries, diceNotation, minRoll, maxRoll };
}

export function extractTableName(line: string): string | null {
  const trimmed = line.trim();

  const headingMatch = trimmed.match(/^#+\s*(.+?)(?:\s*Table|\s*\()/i);
  if (headingMatch) return headingMatch[1].trim();

  const tableTitleMatch = trimmed.match(/^(?:Table\s+)?[\w\s]*Table[:\s]+(.+)/i);
  if (tableTitleMatch) return tableTitleMatch[1].trim().replace(/[:.]+$/, "");

  const bracketedMatch = trimmed.match(/\*\*(.+?)\*\*/);
  if (bracketedMatch) return bracketedMatch[1].trim();

  return null;
}
