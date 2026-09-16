/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, vi, afterEach } from "vitest";
import { classifyCocSuccess, rollPercentileCoc, rollSanLossAmount, successLevelRank } from "@2d6mcp/shared/dice";

describe("classifyCocSuccess", () => {
  it("maps regular / hard / extreme / critical / fail / fumble", () => {
    expect(classifyCocSuccess(50, 60)).toBe("regular");
    expect(classifyCocSuccess(30, 60)).toBe("hard");
    expect(classifyCocSuccess(12, 60)).toBe("extreme");
    expect(classifyCocSuccess(1, 60)).toBe("critical");
    expect(classifyCocSuccess(61, 60)).toBe("failure");
    expect(classifyCocSuccess(100, 60)).toBe("fumble");
    expect(classifyCocSuccess(96, 40)).toBe("fumble");
    expect(classifyCocSuccess(96, 50)).toBe("failure");
  });

  it("ranks opposed success levels", () => {
    expect(successLevelRank("extreme")).toBeGreaterThan(successLevelRank("hard"));
    expect(successLevelRank("fumble")).toBeLessThan(successLevelRank("failure"));
  });
});

describe("rollSanLossAmount", () => {
  it("accepts a plain integer", () => {
    expect(rollSanLossAmount("1")).toBe(1);
    expect(rollSanLossAmount("0")).toBe(0);
  });

  it("rolls dice notation", () => {
    const loss = rollSanLossAmount("1d6");
    expect(loss).toBeGreaterThanOrEqual(1);
    expect(loss).toBeLessThanOrEqual(6);
  });
});

describe("rollPercentileCoc", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports Hard and Extreme thresholds", () => {
    const result = rollPercentileCoc({ target: 50 });
    expect(result.hardThreshold).toBe(25);
    expect(result.extremeThreshold).toBe(10);
    expect(result.successLevel).not.toBeNull();
  });

  it("bonus dice keep the lowest d100", () => {
    const seq = [0.05, 0.9, 0.1];
    let i = 0;
    vi.spyOn(Math, "random").mockImplementation(() => seq[i++] ?? 0);
    const result = rollPercentileCoc({ target: 50, bonusDice: 1 });
    expect(result.tensDice).toHaveLength(2);
    expect(result.ones).toBe(0);
    expect(result.total).toBe(10);
    expect(result.netDice).toBe(1);
  });

  it("penalty dice keep the highest d100", () => {
    const seq = [0.05, 0.1, 0.9];
    let i = 0;
    vi.spyOn(Math, "random").mockImplementation(() => seq[i++] ?? 0);
    const result = rollPercentileCoc({ target: 50, penaltyDice: 1 });
    expect(result.tensDice).toHaveLength(2);
    expect(result.total).toBe(90);
    expect(result.netDice).toBe(-1);
  });

  it("rolls SAN loss on failure", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const result = rollPercentileCoc({ target: 40, sanSuccess: "1", sanFail: "1d6" });
    expect(result.success).toBe(false);
    expect(result.sanLoss).not.toBeNull();
    expect(result.sanLoss!).toBeGreaterThanOrEqual(1);
    expect(result.sanLoss!).toBeLessThanOrEqual(6);
  });

  it("resolves opposed POW by success level then higher roll", () => {
    const seq = [0.1, 0.2, 0.8, 0.1];
    let i = 0;
    vi.spyOn(Math, "random").mockImplementation(() => seq[i++] ?? 0);
    const result = rollPercentileCoc({ target: 50, opposedTarget: 40 });
    expect(result.opposedTotal).not.toBeNull();
    expect(result.opposedSuccessLevel).not.toBeNull();
    expect(["attacker", "defender", "tie"]).toContain(result.opposedWinner);
  });
});
