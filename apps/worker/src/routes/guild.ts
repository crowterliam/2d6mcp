// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Guild-scoped session CRUD.

import { Hono } from "hono";
import type { Env } from "../env.js";
import { verifyToken } from "../middleware/jwt.js";
import type { JwtPayload } from "../types.js";
import {
  createSession, endSession, getSession, listSessions,
  getTranscript, getRecentTranscript, searchTranscript,
  getRecentRulings, getSessionRulings, deleteSession as dbDeleteSession,
  deleteTranscriptsForSession, deleteRulingsForSession,
  insertTranscript,
} from "../db/queries.js";

const guild = new Hono<{ Bindings: Env }>();

// ── Auth middleware ──
async function requireAuth(c: any, next: any) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);
  const payload = await verifyToken<JwtPayload>(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "Invalid token" }, 401);
  c.set("jwt", payload);
  await next();
}

guild.use("/api/guild/:id/*", requireAuth);

// ── Session lifecycle ──
guild.post("/api/guild/:id/session", async (c) => {
  const guildId = c.req.param("id");
  const { name, rules_system, byod_system } = await c.req.json<{ name?: string; rules_system?: string; byod_system?: string }>();
  const sessionId = crypto.randomUUID();
  await createSession(c.env.DB, sessionId, guildId, name || null, rules_system || "ogl", byod_system || null);
  return c.json({ id: sessionId, name: name || sessionId });
});

guild.get("/api/guild/:id/session", async (c) => {
  const guildId = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const result = await listSessions(c.env.DB, guildId, limit);
  return c.json({ sessions: result.results || [] });
});

guild.post("/api/guild/:id/session/:sessionId/end", async (c) => {
  const sessionId = c.req.param("sessionId");
  await endSession(c.env.DB, sessionId);
  return c.json({ ok: true });
});

guild.delete("/api/guild/:id/session/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  await deleteTranscriptsForSession(c.env.DB, sessionId);
  await deleteRulingsForSession(c.env.DB, sessionId);
  await dbDeleteSession(c.env.DB, sessionId);
  return c.json({ ok: true });
});

// ── Transcript ──
guild.post("/api/guild/:id/session/:sessionId/transcript", async (c) => {
  const guildId = c.req.param("id");
  const sessionId = c.req.param("sessionId");
  const { text, speaker, source, intent } = await c.req.json<{ text: string; speaker?: string; source?: string; intent?: string }>();
  if (!text) return c.json({ error: "text is required" }, 400);
  await insertTranscript(c.env.DB, sessionId, guildId, text, speaker || null, source || "manual", intent || null);
  return c.json({ ok: true });
});

guild.get("/api/guild/:id/session/:sessionId/transcript", async (c) => {
  const sessionId = c.req.param("sessionId");
  const result = await getTranscript(c.env.DB, sessionId);
  return c.json({ segments: result.results || [] });
});

// ── Context ──
guild.get("/api/guild/:id/context", async (c) => {
  const guildId = c.req.param("id");
  const minutes = parseInt(c.req.query("minutes") || "5", 10);
  const { getActiveSession } = await import("../db/queries.js");
  const active = await getActiveSession(c.env.DB, guildId);
  if (!active) return c.json({ segments: [], rulings: [] });
  const transcript = await getRecentTranscript(c.env.DB, active.id, minutes);
  const rulings = await getSessionRulings(c.env.DB, active.id);
  return c.json({
    session: active,
    segments: transcript.results || [],
    rulings: rulings.results || [],
  });
});

// ── Search ──
guild.get("/api/guild/:id/search", async (c) => {
  const guildId = c.req.param("id");
  const query = c.req.query("q");
  if (!query) return c.json({ error: "q parameter required" }, 400);
  const { getActiveSession } = await import("../db/queries.js");
  const active = await getActiveSession(c.env.DB, guildId);
  if (!active) return c.json({ results: [] });
  const results = await searchTranscript(c.env.DB, active.id, query);
  return c.json({ results: results.results || [] });
});

export default guild;
