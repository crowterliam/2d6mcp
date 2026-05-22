// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import type { Env } from "../env.js";
import type { JwtPayload } from "../types.js";
import { checkRateLimit as dbCheckRateLimit } from "../db/queries.js";

export async function rateLimitAsk(env: Env, guildId: string): Promise<{ allowed: boolean; message?: string }> {
  const key = `ask:${guildId}`;
  const allowed = await dbCheckRateLimit(env.DB, key, 10_000, 1);
  if (!allowed) {
    return { allowed: false, message: "Rate limited. Wait 10 seconds between /ask requests." };
  }
  return { allowed: true };
}

export function getGuildIdFromRequest(jwt: JwtPayload | null, pathGuildId?: string): string | null {
  if (pathGuildId && jwt && jwt.guilds.includes(pathGuildId)) return pathGuildId;
  if (jwt && jwt.guilds.length > 0) return jwt.guilds[0];
  return null;
}
