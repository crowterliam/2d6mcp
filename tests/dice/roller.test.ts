import { describe, it, expect } from "vitest";
import {
  parseDiceNotation,
  parseDamageNotation,
  roll2d6,
  rollCustom,
  rollDamage,
} from "@2d6mcp/shared/dice";

describe("parseDiceNotation", () => {
  it("parses basic 2d6", () => {
    const result = parseDiceNotation("2d6");
    expect(result).toEqual({ count: 2, sides: 6, modifier: 0 });
  });

  it("parses d6 (implicit 1)", () => {
    const result = parseDiceNotation("d6");
    expect(result).toEqual({ count: 1, sides: 6, modifier: 0 });
  });

  it("parses 3d6+2", () => {
    const result = parseDiceNotation("3d6+2");
    expect(result).toEqual({ count: 3, sides: 6, modifier: 2 });
  });

  it("parses 1d20-1", () => {
    const result = parseDiceNotation("1d20-1");
    expect(result).toEqual({ count: 1, sides: 20, modifier: -1 });
  });

  it("parses d66 as 2d6", () => {
    const result = parseDiceNotation("d66");
    expect(result).toEqual({ count: 2, sides: 6, modifier: 0 });
  });

  it("parses 4d8+5", () => {
    const result = parseDiceNotation("4d8+5");
    expect(result).toEqual({ count: 4, sides: 8, modifier: 5 });
  });

  it("handles whitespace", () => {
    const result = parseDiceNotation(" 2 d 6 + 3 ");
    expect(result).toEqual({ count: 2, sides: 6, modifier: 3 });
  });

  it("handles case insensitivity", () => {
    const result = parseDiceNotation("2D6");
    expect(result).toEqual({ count: 2, sides: 6, modifier: 0 });
  });

  it("throws on invalid notation", () => {
    expect(() => parseDiceNotation("banana")).toThrow('Invalid dice notation');
  });

  it("throws on d1 (less than 2 sides)", () => {
    expect(() => parseDiceNotation("1d1")).toThrow("at least 2 sides");
  });

  it("throws on 0d6 (less than 1 die)", () => {
    expect(() => parseDiceNotation("0d6")).toThrow("at least 1 die");
  });

  it("throws on 101d6 (more than 100 dice)", () => {
    expect(() => parseDiceNotation("101d6")).toThrow("Cannot roll more than 100");
  });

  it("parses 1d100", () => {
    const result = parseDiceNotation("1d100");
    expect(result).toEqual({ count: 1, sides: 100, modifier: 0 });
  });
});

describe("roll2d6", () => {
  it("returns a result with correct structure", () => {
    const result = roll2d6();
    expect(result.dice).toHaveLength(2);
    expect(result.modifier).toBe(0);
    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(result.total).toBeLessThanOrEqual(12);
    expect(result.target).toBeNull();
    expect(result.effect).toBeNull();
    expect(result.success).toBeNull();
    expect(result.description).toBeTruthy();
  });

  it("applies a positive modifier", () => {
    const result = roll2d6(3);
    expect(result.modifier).toBe(3);
    expect(result.total).toBeGreaterThanOrEqual(5);
    expect(result.total).toBeLessThanOrEqual(15);
  });

  it("applies a negative modifier", () => {
    const result = roll2d6(-2);
    expect(result.modifier).toBe(-2);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(10);
  });

  it("calculates success and effect against target", () => {
    for (let i = 0; i < 50; i++) {
      const result = roll2d6(0, 8);
      expect(result.target).toBe(8);
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.effect).toBe("number");
      if (result.success) {
        expect(result.effect).toBeGreaterThanOrEqual(0);
      } else {
        expect(result.effect).toBeLessThan(0);
      }
    }
  });

  it("each die is between 1 and 6", () => {
    for (let i = 0; i < 50; i++) {
      const result = roll2d6();
      for (const die of result.dice) {
        expect(die).toBeGreaterThanOrEqual(1);
        expect(die).toBeLessThanOrEqual(6);
      }
    }
  });

  it("description contains expected elements with target", () => {
    const result = roll2d6(2, 8);
    expect(result.description).toContain("target: 8");
  });

  it("description does not contain target when none provided", () => {
    const result = roll2d6(0);
    expect(result.description).not.toContain("target:");
  });
});

describe("rollCustom", () => {
  it("rolls 3d6", () => {
    const result = rollCustom("3d6");
    expect(result.dice).toHaveLength(3);
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.total).toBeLessThanOrEqual(18);
    expect(result.notation).toBe("3d6");
  });

  it("rolls 1d20", () => {
    const result = rollCustom("1d20");
    expect(result.dice).toHaveLength(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeLessThanOrEqual(20);
  });

  it("rolls 4d6+2 with correct total range", () => {
    const result = rollCustom("4d6+2");
    expect(result.dice).toHaveLength(4);
    expect(result.total).toBeGreaterThanOrEqual(6);
    expect(result.total).toBeLessThanOrEqual(26);
    expect(result.modifier).toBe(2);
    expect(result.notation).toBe("4d6+2");
  });

  it("rolls d6 (implicit 1)", () => {
    const result = rollCustom("d6");
    expect(result.dice).toHaveLength(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeLessThanOrEqual(6);
  });

  it("throws on invalid notation", () => {
    expect(() => rollCustom("invalid")).toThrow();
  });
});

describe("parseDamageNotation", () => {
  it("parses basic damage dice", () => {
    expect(parseDamageNotation("2d6")).toEqual({
      count: 2,
      sides: 6,
      modifier: 0,
      damageType: null,
    });
  });

  it("parses modifier and damage type", () => {
    expect(parseDamageNotation("2d6+3 fire")).toEqual({
      count: 2,
      sides: 6,
      modifier: 3,
      damageType: "fire",
    });
  });

  it("rejects overlong notation to avoid ReDoS", () => {
    const long = "2d6 " + "a".repeat(200);
    expect(() => parseDamageNotation(long)).toThrow("Invalid damage notation");
  });

  it("rejects adversarial repeated-space payloads quickly", () => {
    const adversarial = "2d6" + " ".repeat(10_000) + "fire";
    expect(() => parseDamageNotation(adversarial)).toThrow("Invalid damage notation");
  });
});

describe("rollDamage", () => {
  it("rolls damage with type in description", () => {
    const result = rollDamage("1d6+1 slashing");
    expect(result.dice).toHaveLength(1);
    expect(result.damageType).toBe("slashing");
    expect(result.description).toContain("slashing");
  });
});
