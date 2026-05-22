// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Discord Interactions endpoint — slash command dispatch.

import { Hono } from "hono";
import type { Env } from "../env.js";
import { verifyDiscordSignature } from "../middleware/auth.js";
import { rateLimitAsk } from "../middleware/rate-limit.js";
import { synthesizeRuling } from "../services/synthesize.js";
import { insertRuling, getActiveSession } from "../db/queries.js";
import { roll2d6, rollCustom } from "@2d6mcp/shared/dice";

const interactions = new Hono<{ Bindings: Env }>();

// Discord interaction types
const INTERACTION_PING = 1;
const INTERACTION_APPLICATION_COMMAND = 2;
const RESPONSE_PONG = { type: 1 };
const RESPONSE_DEFERRED = { type: 5 };

function respond(text: string) {
  return { type: 4, data: { content: text } };
}

function embedResponse(title: string, description: string, fields?: Array<{ name: string; value: string; inline?: boolean }>, footer?: string) {
  return {
    type: 4,
    data: {
      embeds: [{
        title,
        description,
        fields,
        footer: footer ? { text: footer } : undefined,
        color: 0x008080,
      }],
    },
  };
}

async function sendFollowUp(applicationId: string, interactionToken: string, content: string, embeds?: Array<Record<string, unknown>>): Promise<void> {
  await fetch(`https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, embeds }),
  });
}

interactions.post("/api/interactions", async (c) => {
  const env = c.env;

  const signature = c.req.header("X-Signature-Ed25519") || "";
  const timestamp = c.req.header("X-Signature-Timestamp") || "";
  const body = await c.req.text();

  if (!env.DISCORD_PUBLIC_KEY) {
    console.error("DISCORD_PUBLIC_KEY not configured");
    return c.json({ error: "Server not configured" }, 500);
  }

  if (!verifyDiscordSignature(body, signature, timestamp, env.DISCORD_PUBLIC_KEY)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const interaction = JSON.parse(body) as {
    type: number;
    id: string;
    token: string;
    application_id: string;
    guild_id?: string;
    data?: { name: string; options?: Array<{ name: string; value: unknown }> };
  };

  // PING
  if (interaction.type === INTERACTION_PING) {
    return c.json(RESPONSE_PONG);
  }

  // Slash command
  if (interaction.type !== INTERACTION_APPLICATION_COMMAND || !interaction.data) {
    return c.json(respond("Unsupported interaction type."));
  }

  const { name, options } = interaction.data;
  const guildId = interaction.guild_id;
  const opts = new Map(options?.map((o) => [o.name, o.value]) || []);

  try {
    switch (name) {
      // ── Sync commands ──
      case "roll": {
        const notation = opts.get("notation") as string || "2d6";
        try {
          if (notation.includes("d") && !notation.startsWith("2d6+") && notation !== "d66") {
            const result = rollCustom(notation);
            return c.json(respond(`🎲 ${notation}: **${result.total}**\nDice: [${result.dice.join(", ")}]${result.modifier ? ` + ${result.modifier}` : ""}`));
          }
          const modifier = opts.get("modifier") as number || 0;
          const target = opts.get("target") as number | undefined;
          const result = roll2d6(modifier, target || null);
          const lines = [
            `🎲 **${result.total}** [${result.dice[0]}, ${result.dice[1]}]${result.modifier ? ` + ${result.modifier}` : ""}`,
          ];
          if (result.target !== null) {
            lines.push(`Target: ${result.target} | Effect: ${result.effect! >= 0 ? "+" : ""}${result.effect} | ${result.description}`);
          }
          return c.json(respond(lines.join("\n")));
        } catch (err) {
          return c.json(respond(`Invalid dice notation: "${notation}". Use formats like 2d6, 3d6+2, d66.`));
        }
      }

      case "session": {
        const action = opts.get("action") as string;
        if (action === "start") {
          const sessionName = (opts.get("name") as string) || undefined;
          const sessionId = crypto.randomUUID();
          if (!guildId) return c.json(respond("This command must be used in a server."));
          const { createGuild, createSession, getActiveSession } = await import("../db/queries.js");
          await createGuild(env.DB, guildId, "0"); // owner set during OAuth
          await createSession(env.DB, sessionId, guildId, sessionName || null, "ogl", null);
          return c.json(respond(`Session "${sessionName || sessionId}" started.`));
        }
        if (action === "end") {
          if (!guildId) return c.json(respond("This command must be used in a server."));
          const { getActiveSession: getActive, endSession } = await import("../db/queries.js");
          const active = await getActive(env.DB, guildId);
          if (!active) return c.json(respond("No active session."));
          await endSession(env.DB, active.id);
          return c.json(respond(`Session "${active.name || active.id}" ended.`));
        }
        if (action === "context") {
          const minutes = (opts.get("minutes") as number) || 5;
          if (!guildId) return c.json(respond("This command must be used in a server."));
          const { getActiveSession: getActive, getRecentTranscript, getSessionRulings } = await import("../db/queries.js");
          const active = await getActive(env.DB, guildId);
          if (!active) return c.json(respond("No active session."));
          const segments = await getRecentTranscript(env.DB, active.id, minutes);
          const rulings = await getSessionRulings(env.DB, active.id);
          const transcriptLines = (segments.results || []).map((s) => `[${s.speaker || "?"}] ${s.text}`).join("\n");
          const rulingLines = (rulings.results || []).map((r, i) => `Ruling ${i + 1}: ${r.question} → ${r.ruling.substring(0, 100)}…`).join("\n");
          return c.json(respond(`**Session: ${active.name || active.id}** (last ${minutes}min)\n\n**Transcript:**\n${transcriptLines || "(none)"}\n\n**Rulings:**\n${rulingLines || "(none)"}`));
        }
        return c.json(respond("Use: /session start, /session end, or /session context"));
      }

      case "search": {
        const query = opts.get("query") as string;
        if (!query) return c.json(respond("Please provide a search query."));
        if (!guildId) return c.json(respond("This command must be used in a server."));
        const { getActiveSession: getActive, searchTranscript } = await import("../db/queries.js");
        const active = await getActive(env.DB, guildId);
        if (!active) return c.json(respond("No active session."));
        const results = await searchTranscript(env.DB, active.id, query);
        const lines = (results.results || []).map((s) => `[${s.speaker || "?"}] ${s.text.substring(0, 200)}`).join("\n");
        return c.json(respond(`**Search: "${query}"**\n${lines || "No results found."}`));
      }

      case "help": {
        return c.json(respond(
          "**2d6mcp Commands**\n" +
          "/ask <question> — Rules ruling with source citations\n" +
          "/roll <notation> — Roll dice (e.g., 2d6+1, 3d6, d66)\n" +
          "/session start <name> — Start a game session\n" +
          "/session end — End the current session\n" +
          "/session context — View recent transcript\n" +
          "/search <query> — Search session transcript\n" +
          "/join — Bot joins voice channel\n" +
          "/leave — Bot leaves voice channel"
        ));
      }

      // ── Async commands (deferred) ──
      case "ask": {
        const question = opts.get("question") as string;
        if (!question) return c.json(respond("Please provide a question."));
        if (!guildId) return c.json(respond("This command must be used in a server."));

        const rlCheck = await rateLimitAsk(env, guildId);
        if (!rlCheck.allowed) return c.json(respond(rlCheck.message!));

        // Defer immediately
        c.executionCtx.waitUntil((async () => {
          const rulingResult = await synthesizeRuling(env, question);

          const oglSources = rulingResult.sources.filter((s) => s.system === "ogl").slice(0, 3);
          const dwSources = rulingResult.sources.filter((s) => s.system === "dw").slice(0, 3);

          const fields: Array<{ name: string; value: string; inline: boolean }> = [];
          if (oglSources.length > 0) {
            fields.push({ name: "OGL Sources", value: oglSources.map((s) => `\`${s.tag}\``).join("\n"), inline: true });
          }
          if (dwSources.length > 0) {
            fields.push({ name: "DW Sources", value: dwSources.map((s) => `\`${s.tag}\``).join("\n"), inline: true });
          }
          if (rulingResult.qualityWarnings && rulingResult.qualityWarnings.length > 0) {
            fields.push({ name: "⚠️ Verify", value: rulingResult.qualityWarnings.map((w) => w.substring(0, 100)).join("\n"), inline: false });
          }

          await sendFollowUp(interaction.application_id, interaction.token, "", [{
            title: question.substring(0, 200),
            description: rulingResult.ruling.substring(0, 4000),
            fields,
            footer: { text: `${rulingResult.model.split("/").pop()} · ${(rulingResult.latencyMs / 1000).toFixed(1)}s` },
            color: 0x008080,
          }]);

          const active = await getActiveSession(env.DB, guildId);
          const cites = rulingResult.sources.map((s) => `${s.system}:${s.tag}`).join(", ");
          await insertRuling(env.DB, active?.id || null, guildId, question, rulingResult.ruling, cites || null, rulingResult.model, rulingResult.latencyMs, rulingResult.qualityWarnings?.join("; ") || null);
        })());

        return c.json(RESPONSE_DEFERRED);
      }

      case "join": {
        return c.json(respond("Voice bridge connection is handled by the bridge process. Please ensure the bridge is running and use /join to connect."));
      }

      case "leave": {
        return c.json(respond("Voice bridge disconnected."));
      }

      default:
        return c.json(respond(`Unknown command: ${name}`));
    }
  } catch (err) {
    console.error("Interaction error:", err);
    return c.json(respond("An error occurred processing that command."));
  }
});

export default interactions;
