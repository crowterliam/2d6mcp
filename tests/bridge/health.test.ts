// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startHealthServer, updateHealthState } from "../../apps/bridge/src/health.js";

async function healthRequest(port: number): Promise<{ body: Record<string, unknown>; status: number }> {
  const res = await fetch(`http://localhost:${port}/health`);
  const body = await res.json() as Record<string, unknown>;
  return { body, status: res.status };
}

describe("HealthServer", () => {
  const port = 3099;

  beforeAll(() => {
    startHealthServer(port);
  });

  it("returns 200 with ok status", async () => {
    const { body, status } = await healthRequest(port);
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
  });

  it("reports guild count from state updates", async () => {
    updateHealthState({ guilds: 5 });
    const { body } = await healthRequest(port);
    expect(body.guilds).toBe(5);
  });

  it("reports memory from state updates", async () => {
    updateHealthState({ memoryBytes: 128 * 1024 * 1024 }); // 128MB
    const { body } = await healthRequest(port);
    expect(body.memory).toBe("128MB");
  });

  it("reports uptime as a non-negative number", async () => {
    const { body } = await healthRequest(port);
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("handles concurrent requests", async () => {
    updateHealthState({ guilds: 3, memoryBytes: 50 * 1024 * 1024 });

    const results = await Promise.all([
      healthRequest(port),
      healthRequest(port),
      healthRequest(port),
    ]);

    for (const { body } of results) {
      expect(body.status).toBe("ok");
      expect(body.guilds).toBe(3);
    }
  });
});
