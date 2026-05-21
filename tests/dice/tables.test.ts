import { describe, it, expect } from "vitest";
import {
  resolveDiceRange,
  rollD66,
  roll2d6Sum,
  rollOnTable,
  normalizeDiceType,
  type TableDefinition,
} from "../../packages/server/src/dice/tables.js";

describe("resolveDiceRange", () => {
  it("returns 6 for 1d6", () => expect(resolveDiceRange("1d6")).toBe(6));
  it("returns 12 for 2d6", () => expect(resolveDiceRange("2d6")).toBe(12));
  it("returns 66 for d66", () => expect(resolveDiceRange("d66")).toBe(66));
  it("returns 3 for 1d3", () => expect(resolveDiceRange("1d3")).toBe(3));
  it("returns 6 for 2d3", () => expect(resolveDiceRange("2d3")).toBe(6));
  it("returns 6 for unknown", () => expect(resolveDiceRange("foo")).toBe(6));
});

describe("rollD66", () => {
  it("returns a value between 11 and 66", () => {
    for (let i = 0; i < 100; i++) {
      const val = rollD66();
      expect(val).toBeGreaterThanOrEqual(11);
      expect(val).toBeLessThanOrEqual(66);
      const tens = Math.floor(val / 10);
      const ones = val % 10;
      expect(tens).toBeGreaterThanOrEqual(1);
      expect(tens).toBeLessThanOrEqual(6);
      expect(ones).toBeGreaterThanOrEqual(1);
      expect(ones).toBeLessThanOrEqual(6);
    }
  });
});

describe("roll2d6Sum", () => {
  it("returns a value between 2 and 12", () => {
    for (let i = 0; i < 100; i++) {
      const val = roll2d6Sum();
      expect(val).toBeGreaterThanOrEqual(2);
      expect(val).toBeLessThanOrEqual(12);
    }
  });
});

describe("rollOnTable", () => {
  const sampleTable: TableDefinition = {
    name: "Test Table",
    diceType: "2d6",
    entries: [
      { min: 2, max: 4, result: "Low" },
      { min: 5, max: 9, result: "Mid" },
      { min: 10, max: 12, result: "High" },
    ],
  };

  it("rolls on a 2d6 table and returns correct structure", () => {
    const result = rollOnTable(sampleTable);
    expect(result.tableName).toBe("Test Table");
    expect(result.diceType).toBe("2d6");
    expect(result.rollValue).toBeGreaterThanOrEqual(2);
    expect(result.rollValue).toBeLessThanOrEqual(12);
    expect(result.row).not.toBeNull();
    expect(["Low", "Mid", "High"]).toContain(result.row!.result);
    expect(result.description).toContain("Test Table");
    expect(result.description).toContain(result.rollValue.toString());
  });

  it("handles d66 tables", () => {
    const d66Table: TableDefinition = {
      name: "D66 Table",
      diceType: "d66",
      entries: [
        { min: 11, max: 33, result: "A" },
        { min: 34, max: 66, result: "B" },
      ],
    };
    const result = rollOnTable(d66Table);
    expect(result.rollValue).toBeGreaterThanOrEqual(11);
    expect(result.rollValue).toBeLessThanOrEqual(66);
    expect(result.diceResult).toHaveLength(2);
  });

  it("handles 1d6 tables", () => {
    const d6Table: TableDefinition = {
      name: "D6 Table",
      diceType: "1d6",
      entries: [
        { min: 1, max: 3, result: "X" },
        { min: 4, max: 6, result: "Y" },
      ],
    };
    const result = rollOnTable(d6Table);
    expect(result.rollValue).toBeGreaterThanOrEqual(1);
    expect(result.rollValue).toBeLessThanOrEqual(6);
    expect(result.diceResult).toHaveLength(1);
  });

  it("handles 1d3 tables", () => {
    const d3Table: TableDefinition = {
      name: "D3 Table",
      diceType: "1d3",
      entries: [
        { min: 1, max: 1, result: "One" },
        { min: 2, max: 2, result: "Two" },
        { min: 3, max: 3, result: "Three" },
      ],
    };
    const result = rollOnTable(d3Table);
    expect(result.rollValue).toBeGreaterThanOrEqual(1);
    expect(result.rollValue).toBeLessThanOrEqual(3);
  });

  it("handles 2d3 tables", () => {
    const d3Table: TableDefinition = {
      name: "2D3 Table",
      diceType: "2d3",
      entries: [
        { min: 2, max: 4, result: "Low" },
        { min: 5, max: 6, result: "High" },
      ],
    };
    const result = rollOnTable(d3Table);
    expect(result.rollValue).toBeGreaterThanOrEqual(2);
    expect(result.rollValue).toBeLessThanOrEqual(6);
  });

  it("returns null row when no entry matches", () => {
    const sparseTable: TableDefinition = {
      name: "Sparse",
      diceType: "1d6",
      entries: [{ min: 1, max: 1, result: "Only One" }],
    };
    for (let i = 0; i < 50; i++) {
      const result = rollOnTable(sparseTable);
      if (result.rollValue > 1) {
        expect(result.row).toBeNull();
        expect(result.description).toContain("no matching entry");
        break;
      }
    }
  });

  it("handles empty entries gracefully", () => {
    const emptyTable: TableDefinition = {
      name: "Empty",
      diceType: "2d6",
      entries: [],
    };
    const result = rollOnTable(emptyTable);
    expect(result.row).toBeNull();
    expect(result.description).toContain("no matching entry");
  });
});

describe("normalizeDiceType", () => {
  it("normalizes common variations", () => {
    expect(normalizeDiceType("1d6")).toBe("1d6");
    expect(normalizeDiceType("d6")).toBe("1d6");
    expect(normalizeDiceType("2d6")).toBe("2d6");
    expect(normalizeDiceType("d66")).toBe("d66");
    expect(normalizeDiceType("1d3")).toBe("1d3");
    expect(normalizeDiceType("d3")).toBe("1d3");
    expect(normalizeDiceType("2d3")).toBe("2d3");
  });

  it("defaults to 2d6 for unknown types", () => {
    expect(normalizeDiceType("3d8")).toBe("2d6");
    expect(normalizeDiceType("foo")).toBe("2d6");
  });

  it("handles whitespace and casing", () => {
    expect(normalizeDiceType(" D6 ")).toBe("1d6");
    expect(normalizeDiceType("2D6")).toBe("2d6");
  });
});
