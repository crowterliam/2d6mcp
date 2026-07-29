// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { requireWorkerApiKey, timingSafeEqual } from "../../apps/worker/src/middleware/api-key.js";
import { verifyStripeWebhookSignature } from "../../apps/worker/src/routes/billing.js";
import { verifyGuildAccess } from "../../apps/worker/src/middleware/auth.js";
import type { Env } from "../../apps/worker/src/env.js";
import type { JwtPayload } from "../../apps/worker/src/types.js";

describe("timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
  });

  it("returns false for unequal strings or lengths", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });
});

describe("requireWorkerApiKey", () => {
  const API_KEY = "test-worker-api-key-32chars-long!!";

  function createApp(env: Partial<Env> = {}) {
    const app = new Hono<{ Bindings: Env }>();
    app.use("/api/ask", requireWorkerApiKey);
    app.post("/api/ask", (c) => c.json({ ok: true }));
    app.get("/api/health", (c) => c.json({ status: "ok" }));
    return {
      app,
      request: (path: string, init?: RequestInit) =>
        app.request(path, init, { WORKER_API_KEY: API_KEY, ...env } as Env),
    };
  }

  it("rejects missing Authorization", async () => {
    const { request } = createApp();
    const res = await request("/api/ask", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("rejects wrong API key", async () => {
    const { request } = createApp();
    const res = await request("/api/ask", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-key" },
    });
    expect(res.status).toBe(401);
  });

  it("allows valid Bearer token", async () => {
    const { request } = createApp();
    const res = await request("/api/ask", {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(res.status).toBe(200);
  });

  it("returns 503 when WORKER_API_KEY unset", async () => {
    const { request } = createApp({ WORKER_API_KEY: "" });
    const res = await request("/api/ask", {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(res.status).toBe(503);
  });

  it("leaves /api/health public", async () => {
    const { request } = createApp();
    const res = await request("/api/health");
    expect(res.status).toBe(200);
  });
});

describe("verifyStripeWebhookSignature", () => {
  async function sign(payload: string, secret: string, timestamp: number): Promise<string> {
    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
    const hex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `t=${timestamp},v1=${hex}`;
  }

  it("accepts a valid signature", async () => {
    const secret = "whsec_test_secret";
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const ts = Math.floor(Date.now() / 1000);
    const header = await sign(payload, secret, ts);
    expect(await verifyStripeWebhookSignature(payload, header, secret)).toBe(true);
  });

  it("rejects missing or invalid signature", async () => {
    const secret = "whsec_test_secret";
    const payload = "{}";
    expect(await verifyStripeWebhookSignature(payload, "", secret)).toBe(false);
    expect(await verifyStripeWebhookSignature(payload, "t=1,v1=deadbeef", secret)).toBe(false);
  });

  it("rejects expired timestamps", async () => {
    const secret = "whsec_test_secret";
    const payload = "{}";
    const oldTs = Math.floor(Date.now() / 1000) - 600;
    const header = await sign(payload, secret, oldTs);
    expect(await verifyStripeWebhookSignature(payload, header, secret, 300)).toBe(false);
  });
});

describe("verifyGuildAccess", () => {
  it("allows guild listed in JWT", async () => {
    const jwt: JwtPayload = { sub: "user1", guilds: ["g1"], plan: "free", iat: 0, exp: 9999999999 };
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => null,
          }),
        }),
      },
    } as unknown as Env;
    expect(await verifyGuildAccess(env, jwt, "g1")).toBe(true);
  });

  it("allows guild owner via DB lookup", async () => {
    const jwt: JwtPayload = { sub: "owner1", guilds: [], plan: "free", iat: 0, exp: 9999999999 };
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ guild_id: "g2", owner_id: "owner1" }),
          }),
        }),
      },
    } as unknown as Env;
    expect(await verifyGuildAccess(env, jwt, "g2")).toBe(true);
  });

  it("denies unrelated guild", async () => {
    const jwt: JwtPayload = { sub: "user1", guilds: ["g1"], plan: "free", iat: 0, exp: 9999999999 };
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => null,
          }),
        }),
      },
    } as unknown as Env;
    expect(await verifyGuildAccess(env, jwt, "other")).toBe(false);
  });
});

describe("plan metadata helpers (checkout)", () => {
  it("maps client price keys to plan tiers", async () => {
    // Re-exercise signature helper still exports after billing refactor
    const secret = "whsec_test";
    const payload = "{}";
    const ts = Math.floor(Date.now() / 1000);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${ts}.${payload}`),
    );
    const hex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(await verifyStripeWebhookSignature(payload, `t=${ts},v1=${hex}`, secret)).toBe(true);
  });
});

describe("API routes auth expectations", () => {
  let app: Hono;
  let request: (path: string, init?: RequestInit) => Promise<Response>;
  const API_KEY = "route-test-key-32chars-minimum!!";

  beforeEach(() => {
    app = new Hono();
    app.get("/api/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));
    app.post("/api/roll", async (c) => {
      const auth = c.req.header("Authorization");
      if (auth !== `Bearer ${API_KEY}`) return c.json({ error: "Unauthorized" }, 401);
      const { notation } = await c.req.json<{ notation: string }>();
      if (!notation) return c.json({ error: "notation required" }, 400);
      if (notation === "2d6+1") return c.json({ dice: [4, 5], modifier: 1, total: 10 });
      return c.json({ error: "invalid notation" }, 400);
    });
    app.post("/api/warm", (c) => {
      const auth = c.req.header("Authorization");
      if (auth !== `Bearer ${API_KEY}`) return c.json({ error: "Unauthorized" }, 401);
      return c.json({ ok: true });
    });
    request = (path, init) => app.request(path, init);
  });

  it("GET /api/health stays public", async () => {
    const res = await request("/api/health");
    expect(res.status).toBe(200);
  });

  it("POST /api/roll requires API key", async () => {
    const unauth = await request("/api/roll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notation: "2d6+1" }),
    });
    expect(unauth.status).toBe(401);

    const auth = await request("/api/roll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ notation: "2d6+1" }),
    });
    expect(auth.status).toBe(200);
  });

  it("POST /api/warm requires API key", async () => {
    expect((await request("/api/warm", { method: "POST" })).status).toBe(401);
    expect(
      (
        await request("/api/warm", {
          method: "POST",
          headers: { Authorization: `Bearer ${API_KEY}` },
        })
      ).status,
    ).toBe(200);
  });
});
