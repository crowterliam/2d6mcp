// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import type { Context, Next } from "hono";
import type { Env } from "../env.js";

/** Constant-time string compare to avoid timing leaks on API keys. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function requireWorkerApiKey(c: Context<{ Bindings: Env }>, next: Next) {
  const expected = c.env.WORKER_API_KEY;
  if (!expected) {
    return c.json({ error: "Server misconfigured: WORKER_API_KEY not set" }, 503);
  }
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token || !timingSafeEqual(token, expected)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}
