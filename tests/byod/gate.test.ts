import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const originalEnv = { ...process.env };
const TMP = join(tmpdir(), `2d6mcp-test-byod-${Date.now()}`);

beforeEach(() => {
  process.env = { ...originalEnv };
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  process.env = { ...originalEnv };
  rmSync(TMP, { recursive: true, force: true });
});

describe("checkByodConsent", () => {
  it("returns disallowed when no BYOD_PATH set", async () => {
    delete process.env.BYOD_PATH;
    const { checkByodConsent } = await import("../../packages/server/src/byod/gate.js");
    const result = checkByodConsent();
    expect(result.allowed).toBe(false);
  });

  it("returns disallowed when consented but no path", async () => {
    process.env.AGREE_BYOD_USE = "true";
    delete process.env.BYOD_PATH;
    const { checkByodConsent } = await import("../../packages/server/src/byod/gate.js");
    const result = checkByodConsent();
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("BYOD_PATH");
  });

  it("returns allowed when consented with valid path", async () => {
    process.env.AGREE_BYOD_USE = "true";
    process.env.BYOD_PATH = TMP;
    const { checkByodConsent } = await import("../../packages/server/src/byod/gate.js");
    const result = checkByodConsent();
    expect(result.allowed).toBe(true);
    expect(result.message).toBe("BYOD Mode enabled.");
  });
});

describe("getByodPath", () => {
  it("returns empty string when no path set", async () => {
    delete process.env.BYOD_PATH;
    const { getByodPath } = await import("../../packages/server/src/byod/gate.js");
    expect(getByodPath()).toBe("");
  });

  it("returns the configured path", async () => {
    process.env.BYOD_PATH = TMP;
    const { getByodPath } = await import("../../packages/server/src/byod/gate.js");
    expect(getByodPath()).toBe(TMP);
  });
});
