// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect } from "vitest";
import {
  parseTableFromText,
  rollForTable,
  inferDiceNotation,
  extractDiceFromHeader,
  type ParsedTable,
} from "@2d6mcp/shared/table-parser";

describe("parseTableFromText", () => {
  it("parses a markdown d100 encounter table", () => {
    const text = `
| d100 | Encounter |
|------|-----------|
| 01-15 | Noise, unusual |
| 16-20 | 3 slimes |
| 21-35 | Party of NPC adventurers |
| 36-50 | Wandering monster |
| 51-65 | Empty room |
| 66-80 | Trap |
| 81-95 | Treasure cache |
| 96-00 | Unique NPC |
`;

    const table = parseTableFromText(text);
    expect(table).not.toBeNull();
    expect(table!.entries).toHaveLength(8);
    expect(table!.diceNotation).toBe("1d100");
    expect(table!.entries[0]).toEqual({ min: 1, max: 15, result: "Noise, unusual" });
    expect(table!.entries[7]).toEqual({ min: 96, max: 100, result: "Unique NPC" });
  });

  it("parses a tab-separated 2d6 reaction table", () => {
    const text = `
2d6\tReaction
2\tHostile
3-4\tUnfriendly
5-6\tNeutral
7-8\tIndifferent
9-10\tFriendly
11-12\tHelpful
`;

    const table = parseTableFromText(text);
    expect(table).not.toBeNull();
    expect(table!.entries).toHaveLength(6);
    expect(table!.diceNotation).toBe("2d6");
    expect(table!.entries[0]).toEqual({ min: 2, max: 2, result: "Hostile" });
    expect(table!.entries[5]).toEqual({ min: 11, max: 12, result: "Helpful" });
  });

  it("parses a plain-text d20 table with period separators", () => {
    const text = `
1. Rusty dagger
2. Silver ring
3-5. Pouch of gold
6-10. Nothing
11-15. Potion of healing
16-19. Magic scroll
20. Legendary weapon
`;

    const table = parseTableFromText(text);
    expect(table).not.toBeNull();
    expect(table!.entries).toHaveLength(7);
    expect(table!.diceNotation).toBe("1d20");
  });

  it("parses a d66 table", () => {
    const text = `
11\tAtmosphere breach
12\tCargo shifted
13-15\tEngine malfunction
16-21\tLife support failure
22-33\tNavigation error
34-55\tSensor ghost
56-66\tAll clear
`;

    const table = parseTableFromText(text);
    expect(table).not.toBeNull();
    expect(table!.diceNotation).toBe("d66");
    expect(table!.entries).toHaveLength(7);
  });

  it("parses a 1d6 table with space separators", () => {
    const text = `
1  Nothing happens
2  Minor complication
3-4  Expected outcome
5  Good result
6  Exceptional success
`;

    const table = parseTableFromText(text);
    expect(table).not.toBeNull();
    expect(table!.entries).toHaveLength(5);
    expect(table!.diceNotation).toBe("1d6");
  });

  it("parses a table with leading table header containing dice notation", () => {
    const text = `
**Random Treasure Table (d100)**

01-10  2d6 silver pieces
11-25  4d6 gold pieces
26-50  Gemstone
51-75  Magic item
76-100  Rare artifact
`;

    const table = parseTableFromText(text);
    expect(table).not.toBeNull();
    expect(table!.entries).toHaveLength(5);
    expect(table!.diceNotation).toBe("1d100");
  });

  it("returns null for non-table text", () => {
    expect(parseTableFromText("This is just a paragraph of text with no tables.")).toBeNull();
    expect(parseTableFromText("")).toBeNull();
    expect(parseTableFromText("1 Only one entry")).toBeNull();
  });

  it("handles PDF-extracted messy text", () => {
    const text = `
Encounters D100
D100 Encounter
01-15 Nothing
16-30 1d6 rats
31-50 1d4 bandits
51-70 1 wandering knight
71-85 1d6 wolves
86-95 1d4 zombies
96-00 Dragon
`;

    const table = parseTableFromText(text);
    expect(table).not.toBeNull();
    expect(table!.entries).toHaveLength(7);
    expect(table!.entries[0].result).toContain("Nothing");
    expect(table!.entries[6].max).toBe(100);
  });

  it("handles ranges with en-dash and em-dash", () => {
    const text = `
1\u20133  Low
4\u20146  Medium
5\u20146  High
`;

    const table = parseTableFromText(text);
    expect(table).not.toBeNull();
    expect(table!.entries).toHaveLength(3);
  });
});

describe("rollForTable", () => {
  const simpleTable: ParsedTable = {
    entries: [
      { min: 1, max: 3, result: "Low" },
      { min: 4, max: 6, result: "Medium" },
      { min: 7, max: 10, result: "High" },
    ],
    diceNotation: "1d10",
    minRoll: 1,
    maxRoll: 10,
  };

  it("returns a result within the table range", () => {
    for (let i = 0; i < 100; i++) {
      const { diceResult, entry } = rollForTable(simpleTable);
      expect(diceResult).toBeGreaterThanOrEqual(1);
      expect(diceResult).toBeLessThanOrEqual(10);
      expect(entry).not.toBeNull();
      expect(["Low", "Medium", "High"]).toContain(entry!.result);
    }
  });

  it("rolls d66 correctly", () => {
    const d66Table: ParsedTable = {
      entries: [
        { min: 11, max: 33, result: "Bad" },
        { min: 34, max: 55, result: "OK" },
        { min: 56, max: 66, result: "Good" },
      ],
      diceNotation: "d66",
      minRoll: 11,
      maxRoll: 66,
    };

    for (let i = 0; i < 100; i++) {
      const { diceResult, entry } = rollForTable(d66Table);
      expect(diceResult).toBeGreaterThanOrEqual(11);
      expect(diceResult).toBeLessThanOrEqual(66);
      const tens = Math.floor(diceResult / 10);
      const ones = diceResult % 10;
      expect(tens).toBeGreaterThanOrEqual(1);
      expect(tens).toBeLessThanOrEqual(6);
      expect(ones).toBeGreaterThanOrEqual(1);
      expect(ones).toBeLessThanOrEqual(6);
      expect(entry).not.toBeNull();
    }
  });

  it("rolls d100 correctly", () => {
    const d100Table: ParsedTable = {
      entries: [
        { min: 1, max: 50, result: "Common" },
        { min: 51, max: 100, result: "Uncommon" },
      ],
      diceNotation: "1d100",
      minRoll: 1,
      maxRoll: 100,
    };

    for (let i = 0; i < 100; i++) {
      const { diceResult } = rollForTable(d100Table);
      expect(diceResult).toBeGreaterThanOrEqual(1);
      expect(diceResult).toBeLessThanOrEqual(100);
    }
  });

  it("returns null entry when roll misses all ranges", () => {
    const gapTable: ParsedTable = {
      entries: [
        { min: 1, max: 2, result: "Low" },
        { min: 5, max: 6, result: "High" },
      ],
      diceNotation: "1d6",
      minRoll: 1,
      maxRoll: 6,
    };

    let foundGap = false;
    for (let i = 0; i < 200; i++) {
      const { entry } = rollForTable(gapTable);
      if (entry === null) {
        foundGap = true;
        break;
      }
    }
    expect(foundGap).toBe(true);
  });
});

describe("inferDiceNotation", () => {
  it("infers 1d4 for max 4", () => {
    const result = inferDiceNotation([
      { min: 1, max: 2, result: "a" },
      { min: 3, max: 4, result: "b" },
    ]);
    expect(result).toBe("1d4");
  });

  it("infers 1d6 for max 6", () => {
    const result = inferDiceNotation([
      { min: 1, max: 3, result: "a" },
      { min: 4, max: 6, result: "b" },
    ]);
    expect(result).toBe("1d6");
  });

  it("infers 2d6 for range 2-12", () => {
    const result = inferDiceNotation([
      { min: 2, max: 6, result: "a" },
      { min: 7, max: 12, result: "b" },
    ]);
    expect(result).toBe("2d6");
  });

  it("infers 1d20 for max 20", () => {
    const result = inferDiceNotation([
      { min: 1, max: 10, result: "a" },
      { min: 11, max: 20, result: "b" },
    ]);
    expect(result).toBe("1d20");
  });

  it("infers d66 for range 11-66", () => {
    const result = inferDiceNotation([
      { min: 11, max: 33, result: "a" },
      { min: 34, max: 66, result: "b" },
    ]);
    expect(result).toBe("d66");
  });

  it("infers 1d100 for max 100", () => {
    const result = inferDiceNotation([
      { min: 1, max: 50, result: "a" },
      { min: 51, max: 100, result: "b" },
    ]);
    expect(result).toBe("1d100");
  });

  it("defaults to 1d6 for empty entries", () => {
    expect(inferDiceNotation([])).toBe("1d6");
  });
});

describe("extractDiceFromHeader", () => {
  it("extracts d100 from header", () => {
    expect(extractDiceFromHeader("| d100 | Encounter |")).toBe("1d100");
    expect(extractDiceFromHeader("D100 Random Encounters")).toBe("1d100");
  });

  it("extracts d20 from header", () => {
    expect(extractDiceFromHeader("d20 Treasure Table")).toBe("1d20");
  });

  it("extracts 2d6 from header", () => {
    expect(extractDiceFromHeader("2d6 Reaction Table")).toBe("2d6");
  });

  it("extracts d66 from header", () => {
    expect(extractDiceFromHeader("d66 Cargo Table")).toBe("d66");
  });

  it("returns null when no dice notation found", () => {
    expect(extractDiceFromHeader("Random Events")).toBeNull();
    expect(extractDiceFromHeader("| Roll | Result |")).toBeNull();
  });
});
