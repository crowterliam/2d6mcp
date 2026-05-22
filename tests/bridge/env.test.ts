// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Bridge env config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("requires DISCORD_BOT_TOKEN", async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    const exitSpy = vi.spyOn(process, "exit");
    exitSpy.mockImplementation(() => {
      throw new Error("exit");
    });

    await expect(
      import("../../apps/bridge/src/env.js")
    ).rejects.toThrow("exit");

    exitSpy.mockRestore();
  });

  it("uses default WORKER_URL when not set", async () => {
    process.env.DISCORD_BOT_TOKEN = "test-token";
    delete process.env.WORKER_URL;

    const mod = await import("../../apps/bridge/src/env.js");
    expect(mod.config.workerUrl).toBe("https://2d6mcp.3ivkf0oy1.workers.dev");
  });

  it("uses custom WORKER_URL from env", async () => {
    process.env.DISCORD_BOT_TOKEN = "test-token";
    process.env.WORKER_URL = "https://custom.example.com";

    const mod = await import("../../apps/bridge/src/env.js");
    expect(mod.config.workerUrl).toBe("https://custom.example.com");
  });

  it("uses custom HEALTH_PORT from env", async () => {
    process.env.DISCORD_BOT_TOKEN = "test-token";
    process.env.HEALTH_PORT = "4000";

    const mod = await import("../../apps/bridge/src/env.js");
    expect(mod.config.healthPort).toBe(4000);
  });

  it("defaults HEALTH_PORT to 3000", async () => {
    process.env.DISCORD_BOT_TOKEN = "test-token";
    delete process.env.HEALTH_PORT;

    const mod = await import("../../apps/bridge/src/env.js");
    expect(mod.config.healthPort).toBe(3000);
  });
});
