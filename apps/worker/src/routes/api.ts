// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { Hono } from "hono";
import type { Env } from "../env.js";
import { roll2d6, rollCustom } from "@2d6mcp/shared/dice";

const api = new Hono<{ Bindings: Env }>();

// ── Audio ingest from bridge ──
api.post("/api/audio-ingest", async (c) => {
  const body = await c.req.arrayBuffer();
  const guildId = c.req.query("guild_id") || "unknown";

  const audioKey = `audio/${guildId}/${Date.now()}.pcm`;
  await c.env.AUDIO.put(audioKey, body);

  return c.json({ ok: true, key: audioKey });
});

// ── Transcribe audio ──
api.post("/api/transcribe", async (c) => {
  const { audioKey } = await c.req.json<{ audioKey: string }>();
  const audio = await c.env.AUDIO.get(audioKey);
  if (!audio) return c.json({ error: "Audio not found" }, 404);

  const pcmBuffer = await audio.arrayBuffer();
  const pcm16 = new Int16Array(pcmBuffer);
  const audioData = Array.from(pcm16).map((v) => v / 32768.0);

  const { transcribeWithWhisper } = await import("../services/whisper.js");
  const text = await transcribeWithWhisper(c.env.AI, audioData);

  return c.json({ text });
});

// ── Ask (text-based ruling) ──
api.post("/api/ask", async (c) => {
  const { question, rules_system } = await c.req.json<{ question: string; rules_system?: "ogl" | "dw" | "auto" }>();
  if (!question) return c.json({ error: "question is required" }, 400);

  const { synthesizeRuling } = await import("../services/synthesize.js");
  const result = await synthesizeRuling(c.env, question, rules_system || "auto");

  const guildId = c.req.query("guild_id");
  if (guildId) {
    const { insertRuling, getActiveSession } = await import("../db/queries.js");
    const active = await getActiveSession(c.env.DB, guildId);
    const cites = result.sources.map((s) => `${s.system}:${s.tag}`).join(", ");
    await insertRuling(c.env.DB, active?.id || null, guildId, question, result.ruling, cites || null, result.model, result.latencyMs, result.qualityWarnings?.join("; ") || null);
  }

  return c.json(result);
});

// ── Roll ──
api.post("/api/roll", async (c) => {
  const { notation } = await c.req.json<{ notation: string }>();
  if (!notation) return c.json({ error: "notation is required" }, 400);

  try {
    if (notation.startsWith("2d6") || notation === "d66") {
      const modifier = parseInt(notation.match(/[+-]\d+/)?.toString() || "0", 10);
      const result = roll2d6(modifier);
      return c.json(result);
    }
    const result = rollCustom(notation);
    return c.json(result);
  } catch {
    return c.json({ error: `Invalid dice notation: "${notation}"` }, 400);
  }
});

// ── Warm-up ──
api.post("/api/warm", async (c) => {
  const { transcribeWithWhisper } = await import("../services/whisper.js");
  const { warmupModel } = await import("../services/llm.js");

  try {
    await transcribeWithWhisper(c.env.AI, [0, 0, 0, 0]);
  } catch {}
  try {
    await warmupModel(c.env.AI);
  } catch {}

  return c.json({ ok: true });
});

// ── Health ──
api.get("/api/health", async (c) => {
  return c.json({ status: "ok", timestamp: Date.now() });
});

export default api;
