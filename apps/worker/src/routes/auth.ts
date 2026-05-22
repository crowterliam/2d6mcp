// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Discord OAuth2 auth routes.

import { Hono } from "hono";
import type { Env } from "../env.js";
import { signPayload, verifyToken } from "../middleware/jwt.js";
import type { JwtPayload } from "../types.js";
import { getGuild, createGuild } from "../db/queries.js";

const auth = new Hono<{ Bindings: Env }>();

auth.get("/api/auth/login", (c) => {
  const env = c.env;
  const redirectUri = `${env.API_URL}/api/auth/callback`;
  const url = `https://discord.com/api/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=identify+guilds`;
  return c.redirect(url);
});

auth.get("/api/auth/callback", async (c) => {
  const env = c.env;
  const code = c.req.query("code");
  if (!code) return c.json({ error: "Missing code" }, 400);

  // Exchange code for access token
  const redirectUri = `${env.API_URL}/api/auth/callback`;
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = await tokenRes.json() as { access_token: string; refresh_token: string };

  if (!tokenData.access_token) {
    return c.json({ error: "OAuth failed" }, 401);
  }

  // Fetch user info
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = await userRes.json() as { id: string; username: string; avatar: string };

  // Fetch user guilds
  const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const guilds = await guildsRes.json() as Array<{ id: string; owner: boolean }>;

  const ownedGuildIds = guilds.filter((g) => g.owner).map((g) => g.id);

  // Ensure guild records exist
  for (const guildId of ownedGuildIds) {
    await createGuild(env.DB, guildId, user.id);
  }

  const guild = await getGuild(env.DB, ownedGuildIds[0] || "");
  const plan = guild?.plan || "free";

  const jwt = await signPayload({ sub: user.id, guilds: ownedGuildIds, plan } as Record<string, unknown>, env.JWT_SECRET, "15m");
  const redirectTo = `${env.WEB_URL}/dashboard#jwt=${jwt}`;
  return c.redirect(redirectTo);
});

auth.get("/api/auth/me", async (c) => {
  const env = c.env;
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);
  const payload = await verifyToken<JwtPayload>(token, env.JWT_SECRET);
  if (!payload) return c.json({ error: "Invalid or expired token" }, 401);

  return c.json({ userId: payload.sub, guilds: payload.guilds, plan: payload.plan });
});

export default auth;
