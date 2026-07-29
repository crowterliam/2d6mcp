// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";

/**
 * Mirrors bridge push-to-ask auth behavior without importing discord.js voice deps.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function startTestHealthServer(port: number, apiKey: string): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }
      if (req.method === "POST" && req.url?.startsWith("/push-to-ask")) {
        if (!apiKey) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "WORKER_API_KEY not configured on bridge" }));
          return;
        }
        const auth = req.headers.authorization;
        const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
        if (!token || !timingSafeEqual(token, apiKey)) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, key: "audio/test.pcm" }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(port, () => resolve(server));
  });
}

describe("bridge push-to-ask auth", () => {
  let server: Server;
  const port = 18765;
  const apiKey = "bridge-test-api-key-32chars-min!!";

  beforeEach(async () => {
    server = await startTestHealthServer(port, apiKey);
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("allows GET /health without auth", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
  });

  it("rejects push-to-ask without auth", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/push-to-ask?guild_id=1`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("accepts push-to-ask with valid Bearer", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/push-to-ask?guild_id=1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
