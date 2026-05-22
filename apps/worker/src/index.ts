// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// 2d6mcp Cloudflare Worker — Main entry point.
// Mounts all route handlers: Discord Interactions, API, Auth, Billing, Guild CRUD.

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.js";
import interactions from "./routes/interactions.js";
import api from "./routes/api.js";
import auth from "./routes/auth.js";
import billing from "./routes/billing.js";
import guild from "./routes/guild.js";

const app = new Hono<{ Bindings: Env }>();

// CORS for web dashboard
app.use("/*", cors({
  origin: ["https://2d6mcp.app", "http://localhost:5173"],
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

// Mount routes
app.route("/", interactions);
app.route("/", api);
app.route("/", auth);
app.route("/", billing);
app.route("/", guild);

// 404 catch-all
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("Worker error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;

// ── Slash command registration (run once via wrangler or setup script) ──
export async function registerCommands(env: Env): Promise<void> {
  const commands = [
    {
      name: "ask",
      description: "Ask a rules question and get a cited ruling",
      options: [{ name: "question", description: "Your rules question", type: 3, required: true }],
    },
    {
      name: "roll",
      description: "Roll dice (e.g. 2d6+1, 3d6, d66)",
      options: [{ name: "notation", description: "Dice notation", type: 3, required: true }],
    },
    {
      name: "session",
      description: "Manage game sessions",
      options: [
        { name: "action", description: "start, end, or context", type: 3, required: true, choices: [
          { name: "Start a new session", value: "start" },
          { name: "End the current session", value: "end" },
          { name: "View recent context", value: "context" },
        ] },
        { name: "name", description: "Session name (for start)", type: 3, required: false },
        { name: "minutes", description: "Minutes of context (for context)", type: 4, required: false },
      ],
    },
    {
      name: "search",
      description: "Search session transcript",
      options: [{ name: "query", description: "What to search for", type: 3, required: true }],
    },
    { name: "help", description: "Show available commands" },
  ];

  const url = `https://discord.com/api/v10/applications/${env.DISCORD_CLIENT_ID}/commands`;

  await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    },
    body: JSON.stringify(commands),
  });
}
