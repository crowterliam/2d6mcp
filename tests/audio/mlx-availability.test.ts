/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";

describe("isMLXWhisperAvailable", () => {
  it("returns true when mlx_whisper is in PATH", async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from("/opt/homebrew/bin/mlx_whisper"));
    const { isMLXWhisperAvailable } = await import("../../packages/server/src/audio/mlx-transcribe.js");
    expect(isMLXWhisperAvailable()).toBe(true);
  });

  it("returns false when mlx_whisper is not found", async () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not found");
    });
    const { isMLXWhisperAvailable } = await import("../../packages/server/src/audio/mlx-transcribe.js");
    expect(isMLXWhisperAvailable()).toBe(false);
  });
});

describe("isMLXLLMAvailable", () => {
  it("returns true when mlx_lm.generate is in PATH", async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from("/opt/homebrew/bin/mlx_lm.generate"));
    const { isMLXLLMAvailable } = await import("../../packages/server/src/rulings/mlx-synthesize.js");
    expect(isMLXLLMAvailable()).toBe(true);
  });

  it("returns false when mlx_lm.generate is not found", async () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not found");
    });
    const { isMLXLLMAvailable } = await import("../../packages/server/src/rulings/mlx-synthesize.js");
    expect(isMLXLLMAvailable()).toBe(false);
  });
});
