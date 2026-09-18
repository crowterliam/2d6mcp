/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect } from "vitest";
import {
  PRINTED_TARGET_PRESETS,
  PRINTED_TARGET_PRESET_NOTE,
  resolvePrintedTarget,
} from "../../packages/shared/src/difficulty-presets.js";
import { dispatchToolCall } from "../../packages/server/src/tools/index.js";

describe("operator target presets", () => {
  it("maps operator labels to generic target numbers", () => {
    expect(PRINTED_TARGET_PRESETS.average).toBe(8);
    expect(PRINTED_TARGET_PRESETS.difficult).toBe(10);
    expect(PRINTED_TARGET_PRESETS.very_difficult).toBe(12);
    expect(PRINTED_TARGET_PRESETS.impossible).toBe(16);
    expect(resolvePrintedTarget("Very Difficult")?.target).toBe(12);
    expect(resolvePrintedTarget("difficult")?.note).toBe(PRINTED_TARGET_PRESET_NOTE);
    expect(PRINTED_TARGET_PRESET_NOTE).toContain("Operator target preset");
    expect(resolvePrintedTarget("formidable")).toBeNull();
  });

  it("roll uses the preset as target when target is omitted", async () => {
    const result = await dispatchToolCall("roll", {
      notation: "2d6+2",
      mechanic: "2d6",
      difficulty: "difficult",
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text) as {
      target: number;
      target_preset: string;
      modifier: number;
      effect: number | null;
    };
    expect(parsed.target).toBe(10);
    expect(parsed.target_preset).toBe("difficult");
    expect(parsed.modifier).toBe(2);
    expect(typeof parsed.effect).toBe("number");
  });

  it("numeric target wins over a difficulty label", async () => {
    const result = await dispatchToolCall("roll", {
      mechanic: "2d6",
      difficulty: "difficult",
      target: 8,
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text) as {
      target: number;
      target_preset?: string;
    };
    expect(parsed.target).toBe(8);
    expect(parsed.target_preset).toBeUndefined();
  });
});
