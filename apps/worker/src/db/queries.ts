// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import type { Env } from "../env.js";
import type { GuildRow, SessionRow, RulingRow, TranscriptRow } from "../types.js";

export function getGuild(db: D1Database, guildId: string): Promise<GuildRow | null> {
  return db.prepare("SELECT * FROM guilds WHERE guild_id = ?").bind(guildId).first<GuildRow>();
}

export function createGuild(db: D1Database, guildId: string, ownerId: string): Promise<D1Result<GuildRow>> {
  return db.prepare("INSERT INTO guilds (guild_id, owner_id) VALUES (?, ?) ON CONFLICT DO NOTHING").bind(guildId, ownerId).run();
}

export function incrementSessionsUsed(db: D1Database, guildId: string): Promise<D1Result> {
  return db.prepare("UPDATE guilds SET sessions_used_this_month = sessions_used_this_month + 1, updated_at = datetime('now') WHERE guild_id = ?").bind(guildId).run();
}

export function updateGuildPlan(db: D1Database, guildId: string, plan: string, stripeCustomerId: string | null, subscriptionStatus: string | null): Promise<D1Result> {
  return db.prepare(
    "UPDATE guilds SET plan = ?, stripe_customer_id = ?, subscription_status = ?, updated_at = datetime('now') WHERE guild_id = ?"
  ).bind(plan, stripeCustomerId, subscriptionStatus, guildId).run();
}

export function createSession(db: D1Database, id: string, guildId: string, name: string | null, rulesSystem: string, byodSystem: string | null): Promise<D1Result> {
  return db.prepare(
    "INSERT INTO sessions (id, guild_id, name, rules_system, byod_system) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, guildId, name, rulesSystem, byodSystem).run();
}

export function endSession(db: D1Database, sessionId: string): Promise<D1Result> {
  return db.prepare("UPDATE sessions SET ended_at = datetime('now'), status = 'ended' WHERE id = ? AND status = 'active'").bind(sessionId).run();
}

export function getSession(db: D1Database, sessionId: string): Promise<SessionRow | null> {
  return db.prepare("SELECT * FROM sessions WHERE id = ?").bind(sessionId).first<SessionRow>();
}

export function listSessions(db: D1Database, guildId: string, limit: number = 20): Promise<D1Result<SessionRow>> {
  return db.prepare("SELECT * FROM sessions WHERE guild_id = ? ORDER BY started_at DESC LIMIT ?").bind(guildId, limit).run<SessionRow>();
}

export function getActiveSession(db: D1Database, guildId: string): Promise<SessionRow | null> {
  return db.prepare("SELECT * FROM sessions WHERE guild_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1").bind(guildId).first<SessionRow>();
}

export function insertTranscript(db: D1Database, sessionId: string, guildId: string, text: string, speaker: string | null, source: string, intent: string | null): Promise<D1Result> {
  return db.prepare(
    "INSERT INTO transcript_segments (session_id, guild_id, text, speaker, source, intent) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(sessionId, guildId, text, speaker, source, intent).run();
}

export function getTranscript(db: D1Database, sessionId: string, limit: number = 100): Promise<D1Result<TranscriptRow>> {
  return db.prepare("SELECT * FROM transcript_segments WHERE session_id = ? ORDER BY logged_at ASC LIMIT ?").bind(sessionId, limit).run<TranscriptRow>();
}

export function getRecentTranscript(db: D1Database, sessionId: string, minutes: number = 5): Promise<D1Result<TranscriptRow>> {
  return db.prepare(
    "SELECT * FROM transcript_segments WHERE session_id = ? AND logged_at >= datetime('now', ?) ORDER BY logged_at ASC"
  ).bind(sessionId, `-${minutes} minutes`).run<TranscriptRow>();
}

export function searchTranscript(db: D1Database, sessionId: string, query: string): Promise<D1Result<TranscriptRow>> {
  return db.prepare(
    "SELECT * FROM transcript_segments WHERE session_id = ? AND text LIKE ? ORDER BY logged_at ASC"
  ).bind(sessionId, `%${query}%`).run<TranscriptRow>();
}

export function insertRuling(db: D1Database, sessionId: string | null, guildId: string, question: string, ruling: string, sourceCitations: string | null, modelUsed: string | null, latencyMs: number | null, qualityWarnings: string | null): Promise<D1Result> {
  return db.prepare(
    "INSERT INTO rulings (session_id, guild_id, question, ruling, source_citations, model_used, latency_ms, quality_warnings) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(sessionId, guildId, question, ruling, sourceCitations, modelUsed, latencyMs, qualityWarnings).run();
}

export function getRecentRulings(db: D1Database, guildId: string, limit: number = 5): Promise<D1Result<RulingRow>> {
  return db.prepare("SELECT * FROM rulings WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?").bind(guildId, limit).run<RulingRow>();
}

export function getSessionRulings(db: D1Database, sessionId: string): Promise<D1Result<RulingRow>> {
  return db.prepare("SELECT * FROM rulings WHERE session_id = ? ORDER BY created_at ASC").bind(sessionId).run<RulingRow>();
}

export function deleteSession(db: D1Database, sessionId: string): Promise<D1Result> {
  return db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export function deleteTranscriptsForSession(db: D1Database, sessionId: string): Promise<D1Result> {
  return db.prepare("DELETE FROM transcript_segments WHERE session_id = ?").bind(sessionId).run();
}

export function deleteRulingsForSession(db: D1Database, sessionId: string): Promise<D1Result> {
  return db.prepare("DELETE FROM rulings WHERE session_id = ?").bind(sessionId).run();
}

export function searchOglRulesFts(db: D1Database, query: string): Promise<D1Result<{ title: string; category: string; content: string; source_tag: string }>> {
  return db.prepare(
    "SELECT title, category, content, source_tag FROM ogl_rules_fts WHERE ogl_rules_fts MATCH ? ORDER BY rank LIMIT 5"
  ).bind(query).run<{ title: string; category: string; content: string; source_tag: string }>();
}

export function searchDwRulesFts(db: D1Database, query: string): Promise<D1Result<{ title: string; category: string; content: string; source_tag: string }>> {
  return db.prepare(
    "SELECT title, category, content, source_tag FROM dw_rules_fts WHERE dw_rules_fts MATCH ? ORDER BY rank LIMIT 5"
  ).bind(query).run<{ title: string; category: string; content: string; source_tag: string }>();
}

export function checkRateLimit(db: D1Database, key: string, windowMs: number, maxRequests: number): Promise<boolean> {
  const now = Date.now();
  return db.prepare(
    "INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start < ? THEN 1 ELSE count + 1 END, window_start = CASE WHEN window_start < ? THEN ? ELSE window_start END"
  ).bind(key, now, now - windowMs, now - windowMs, now)
    .run()
    .then(() => db.prepare("SELECT count FROM rate_limits WHERE key = ?").bind(key).first<{ count: number }>())
    .then((row) => (row?.count ?? 0) <= maxRequests);
}
