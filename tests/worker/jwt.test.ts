// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect } from "vitest";
import { signPayload, verifyToken } from "../../apps/worker/src/middleware/jwt.js";

describe("JWT (Web Crypto)", () => {
  const secret = "test-secret-key-for-jwt";

  it("signs and verifies a payload", async () => {
    const token = await signPayload({ sub: "user123", role: "gm" }, secret, "1h");
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const payload = await verifyToken<{ sub: string; role: string }>(token, secret);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user123");
    expect(payload!.role).toBe("gm");
  });

  it("includes iat and exp claims", async () => {
    const token = await signPayload({ sub: "user456" }, secret, "1h");
    const payload = await verifyToken<{ sub: string; iat: number; exp: number }>(token, secret);

    expect(payload!.iat).toBeGreaterThan(0);
    expect(payload!.exp).toBeGreaterThan(payload!.iat);
    expect(payload!.exp - payload!.iat).toBe(3600); // 1 hour
  });

  it("rejects tokens with wrong secret", async () => {
    const token = await signPayload({ sub: "user789" }, secret, "1h");
    const payload = await verifyToken(token, "wrong-secret");
    expect(payload).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await signPayload({ sub: "user000" }, secret, "1s");
    // Wait 2 seconds to ensure expiry
    await new Promise((r) => setTimeout(r, 2100));
    const payload = await verifyToken(token, secret);
    expect(payload).toBeNull();
  }, 5000);

  it("rejects malformed tokens", async () => {
    expect(await verifyToken("not-a-jwt", secret)).toBeNull();
    expect(await verifyToken("two.parts", secret)).toBeNull();
    expect(await verifyToken("", secret)).toBeNull();
  });

  it("supports different expiry durations", async () => {
    const t30s = await signPayload({ sub: "1" }, secret, "30s");
    const t5m = await signPayload({ sub: "2" }, secret, "5m");
    const t2h = await signPayload({ sub: "3" }, secret, "2h");
    const t7d = await signPayload({ sub: "4" }, secret, "7d");

    const p30s = await verifyToken<{ exp: number; iat: number }>(t30s, secret);
    const p5m = await verifyToken<{ exp: number; iat: number }>(t5m, secret);
    const p2h = await verifyToken<{ exp: number; iat: number }>(t2h, secret);
    const p7d = await verifyToken<{ exp: number; iat: number }>(t7d, secret);

    expect(p30s!.exp - p30s!.iat).toBe(30);
    expect(p5m!.exp - p5m!.iat).toBe(300);
    expect(p2h!.exp - p2h!.iat).toBe(7200);
    expect(p7d!.exp - p7d!.iat).toBe(604800);
  });

  it("preserves all payload fields", async () => {
    const token = await signPayload(
      { sub: "u1", guilds: ["g1", "g2"], plan: "pro", extra: { nested: true } },
      secret,
      "1h",
    );
    const payload = await verifyToken(token, secret);
    expect(payload!.sub).toBe("u1");
    expect(payload!.guilds).toEqual(["g1", "g2"]);
    expect(payload!.plan).toBe("pro");
    expect(payload!.extra).toEqual({ nested: true });
  });

  it("verifies tampered signatures fail", async () => {
    const token = await signPayload({ sub: "u" }, secret, "1h");
    const parts = token.split(".");
    // Tamper with the payload
    const tampered = `${parts[0]}.${parts[1]}X.${parts[2]}`;
    const payload = await verifyToken(tampered, secret);
    expect(payload).toBeNull();
  });
});
