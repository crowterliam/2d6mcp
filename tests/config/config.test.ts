import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, isByodEnabled, BYOD_DISCLAIMER } from "../../src/config.js";

const originalEnv = { ...process.env };
const TMP = join(tmpdir(), `2d6mcp-test-config-${Date.now()}`);

beforeEach(() => {
  process.env = { ...originalEnv };
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  process.env = { ...originalEnv };
  rmSync(TMP, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("returns default config for numeric settings", () => {
    delete process.env.BYOD_CHUNK_SIZE;
    delete process.env.BYOD_CHUNK_OVERLAP;

    const config = loadConfig();
    expect(config.byodChunkSize).toBe(8000);
    expect(config.byodChunkOverlap).toBe(400);
    expect(config.byodMaxFiles).toBe(2000);
    expect(config.byodMaxChunksPerFile).toBe(500);
    expect(config.byodSyncTimeoutMs).toBe(15000);
  });

  it("reads BYOD_PATH from env", () => {
    process.env.BYOD_PATH = "/tmp/test-byod";
    const config = loadConfig();
    expect(config.byodPath).toBe("/tmp/test-byod");
  });

  it("reads OGL_DB_PATH from env", () => {
    process.env.OGL_DB_PATH = "/tmp/test-ogl.db";
    const config = loadConfig();
    expect(config.oglDbPath).toBe("/tmp/test-ogl.db");
  });

  it("reads DW_DB_PATH from env", () => {
    process.env.DW_DB_PATH = "/tmp/test-dw.db";
    const config = loadConfig();
    expect(config.dwDbPath).toBe("/tmp/test-dw.db");
  });

  it("clamps BYOD_CHUNK_SIZE within bounds", () => {
    process.env.BYOD_CHUNK_SIZE = "10";
    let config = loadConfig();
    expect(config.byodChunkSize).toBe(500);

    process.env.BYOD_CHUNK_SIZE = "999999";
    config = loadConfig();
    expect(config.byodChunkSize).toBe(50000);
  });

  it("clamps BYOD_SYNC_TIMEOUT_MS within bounds", () => {
    process.env.BYOD_SYNC_TIMEOUT_MS = "100";
    let config = loadConfig();
    expect(config.byodSyncTimeoutMs).toBe(1000);

    process.env.BYOD_SYNC_TIMEOUT_MS = "999999";
    config = loadConfig();
    expect(config.byodSyncTimeoutMs).toBe(300000);
  });

  it("falls back to defaults for non-numeric env vars", () => {
    process.env.BYOD_CHUNK_SIZE = "notanumber";
    const config = loadConfig();
    expect(config.byodChunkSize).toBe(8000);
  });
});

describe("isByodEnabled", () => {
  it("returns false when no BYOD_PATH set", () => {
    delete process.env.BYOD_PATH;
    expect(isByodEnabled()).toBe(false);
  });

  it("returns false when BYOD_PATH points to nonexistent dir", () => {
    process.env.BYOD_PATH = "/nonexistent/path/that/does/not/exist";
    expect(isByodEnabled()).toBe(false);
  });

  it("returns true when consented (via env) and path exists", () => {
    process.env.AGREE_BYOD_USE = "true";
    process.env.BYOD_PATH = TMP;
    expect(isByodEnabled()).toBe(true);
  });
});

describe("BYOD_DISCLAIMER", () => {
  it("contains expected language", () => {
    expect(BYOD_DISCLAIMER).toContain("BYOD Mode is disabled");
    expect(BYOD_DISCLAIMER).toContain("AGREE_BYOD_USE");
  });
});
