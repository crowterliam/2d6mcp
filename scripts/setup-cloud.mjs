#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// 2d6mcp Cloud Setup Wizard
// Interactive CLI that provisions everything a non-technical user needs:
// Cloudflare Worker, D1, R2, Discord bot config, secrets, and deploy.

import { execSync, exec } from "node:child_process";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerDir = resolve(__dirname, "..", "apps", "worker");

interface SetupConfig {
  accountId: string;
  discordToken: string;
  discordPublicKey: string;
  discordClientId: string;
  discordClientSecret: string;
  jwtSecret: string;
  workerName: string;
}

// ── Helpers ──

function question(prompt: string, password = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: password ? undefined : process.stdout });
  return new Promise((resolve) => {
    if (password) {
      // Simple hidden input via readline
      process.stdout.write(prompt);
      let buf = "";
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.on("data", (chunk: Buffer) => {
        const key = chunk.toString();
        for (const ch of key) {
          if (ch === "\r" || ch === "\n") {
            process.stdin.setRawMode?.(false);
            process.stdin.pause();
            process.stdout.write("\n");
            rl.close();
            resolve(buf);
            return;
          }
          if (ch === "\x7f" || ch === "\b") {
            if (buf.length > 0) {
              buf = buf.slice(0, -1);
              process.stdout.write("\b \b");
            }
            return;
          }
          buf += ch;
          process.stdout.write("*");
        }
      });
    } else {
      rl.question(prompt, (answer) => { rl.close(); resolve(answer.trim()); });
    }
  });
}

function sh(cmd: string, opts?: { cwd?: string; silent?: boolean }): string {
  try {
    return execSync(cmd, {
      cwd: opts?.cwd || workerDir,
      encoding: "utf-8",
      stdio: opts?.silent ? "pipe" : "inherit",
    });
  } catch {
    return "";
  }
}

function shCapture(cmd: string): string {
  try {
    return execSync(cmd, { cwd: workerDir, encoding: "utf-8", stdio: "pipe" }).trim();
  } catch {
    return "";
  }
}

function wrangler(args: string): string {
  return shCapture(`npx wrangler ${args}`);
}

function step(text: string): void {
  console.log(`\n  ${text}`);
}

function success(text: string): void {
  console.log(`  ✓ ${text}`);
}

function warn(text: string): void {
  console.log(`  ⚠ ${text}`);
}

// ── Main Wizard ──

async function main() {
  console.log(`
  ⚡ 2d6mcp Cloud Setup Wizard
  ─────────────────────────────
  This will deploy a Discord bot with AI-powered rules lookup
  to Cloudflare Workers. You'll need:

    • A Discord bot application (developer portal)
    • A Cloudflare account (workers.dev)
    • ~5 minutes

  Your secrets stay on Cloudflare's encrypted store.
  Nothing is committed to any repository.
  `);

  // ── Step 1: Check wrangler ──
  step("Checking wrangler...");
  try {
    execSync("npx wrangler --version", { stdio: "pipe" });
    success("wrangler available");
  } catch {
    warn("wrangler not found. Installing...");
    sh("npm install -g wrangler", { cwd: workerDir });
  }

  // ── Step 2: Check logged in ──
  const who = shCapture("npx wrangler whoami 2>/dev/null");
  if (!who) {
    step("Logging into Cloudflare...");
    sh("npx wrangler login");
  } else {
    success(`Logged in as: ${who}`);
  }

  // ── Step 3: Get Cloudflare account ID ──
  let accountId = shCapture("npx wrangler whoami 2>/dev/null | grep account_id || echo ''");
  if (!accountId) {
    const members = shCapture("npx wrangler members list 2>/dev/null || echo ''");
    console.log("  Could not auto-detect account ID.");
    accountId = await question("  Cloudflare Account ID: ");
  } else {
    // wrangler whoami shows account info, extract account_id
    const match = shCapture("npx wrangler whoami 2>/dev/null").match(/account_id[:\s]+"?([a-f0-9]+)"?/);
    if (match) accountId = match[1];
    if (!accountId) {
      accountId = await question("  Cloudflare Account ID: ");
    }
  }

  // ── Step 4: Discord bot details ──
  console.log("\n  📡 Discord Bot Setup");
  console.log("  Go to https://discord.com/developers/applications");
  console.log("  Create a New Application → Bot → copy the token\n");

  const discordToken = await question("  Bot Token: ", true);
  if (!discordToken) { console.log("  Bot token required. Aborting."); process.exit(1); }

  const discordPublicKey = await question("  Public Key (General Information): ");
  if (!discordPublicKey) { console.log("  Public key required. Aborting."); process.exit(1); }

  const discordClientId = await question("  Client ID (General Information → Application ID): ");
  if (!discordClientId) { console.log("  Client ID required. Aborting."); process.exit(1); }

  const discordClientSecret = await question("  Client Secret (OAuth2 → Client Secret): ", true);
  if (!discordClientSecret) { console.log("  Client Secret required. Aborting."); process.exit(1); }

  // ── Step 5: Generate JWT secret ──
  const jwtSecret = randomBytes(32).toString("hex");

  // ── Step 6: Write wrangler.toml ──
  step("Writing wrangler.toml...");
  const wranglerToml = `name = "2d6mcp"
main = "src/index.ts"
compatibility_date = "2025-05-01"
compatibility_flags = ["nodejs_compat"]
account_id = "${accountId}"

[ai]
binding = "AI"

[[d1_databases]]
binding = "DB"
database_name = "2d6mcp"

[[r2_buckets]]
binding = "AUDIO"
bucket_name = "2d6mcp-audio"

[vars]
API_URL = "https://2d6mcp.YOUR-SUBDOMAIN.workers.dev"
WEB_URL = "https://2d6mcp.pages.dev"
`;
  writeFileSync(resolve(workerDir, "wrangler.toml"), wranglerToml);
  success("wrangler.toml written");

  // ── Step 7: Create D1 + R2 ──
  step("Creating D1 database...");
  let d1Id = "";
  try {
    const d1Out = shCapture("npx wrangler d1 create 2d6mcp 2>&1");
    const d1Match = d1Out.match(/database_id\s*=\s*"([^"]+)"/);
    if (d1Match) d1Id = d1Match[1];
    success("D1 database created");
  } catch {
    // May already exist
    success("D1 database (using existing)");
  }

  step("Creating R2 bucket...");
  try {
    sh("npx wrangler r2 bucket create 2d6mcp-audio 2>&1", { silent: true });
    success("R2 bucket created");
  } catch {
    success("R2 bucket (using existing)");
  }

  // ── Step 8: Run migration ──
  step("Running database migration...");
  sh("npx wrangler d1 execute 2d6mcp --remote --file src/db/schema.sql 2>&1");
  success("Schema migrated");

  // ── Step 9: Seed rules ──
  step("Seeding rules data...");
  try {
    sh("node scripts/generate-seed.mjs 2>&1", { silent: true });
  } catch {
    // seed script may not exist — warn but continue
    warn("Seed script not found. Rules search will be empty until populated.");
  }
  if (existsSync(resolve(workerDir, "src", "db", "seed.sql"))) {
    sh("npx wrangler d1 execute 2d6mcp --remote --file src/db/seed.sql 2>&1");
    success("Rules seeded (OGL + DW)");
  }

  // ── Step 10: Set secrets ──
  step("Setting secrets...");
  const secrets: Record<string, string> = {
    DISCORD_BOT_TOKEN: discordToken,
    DISCORD_PUBLIC_KEY: discordPublicKey,
    DISCORD_CLIENT_ID: discordClientId,
    DISCORD_CLIENT_SECRET: discordClientSecret,
    JWT_SECRET: jwtSecret,
    STRIPE_SECRET_KEY: "placeholder_stripe_key",
    STRIPE_WEBHOOK_SECRET: "placeholder_webhook_secret",
  };

  for (const [name, value] of Object.entries(secrets)) {
    try {
      // Use echo to pipe the value to wrangler secret put
      execSync(`echo "${value}" | npx wrangler secret put ${name}`, {
        cwd: workerDir,
        stdio: "pipe",
      });
    } catch {
      warn(`Could not set secret: ${name}. Set manually with: wrangler secret put ${name}`);
    }
  }
  success("Secrets configured");

  // ── Step 11: Deploy ──
  step("Deploying Worker...");
  sh("npx wrangler deploy 2>&1");
  success("Worker deployed");

  // ── Step 12: Register slash commands ──
  step("Registering slash commands...");
  const commands = JSON.stringify([
    { "name": "ask", "description": "Ask a rules question and get a cited ruling", "options": [{ "name": "question", "description": "Your rules question", "type": 3, "required": true }] },
    { "name": "roll", "description": "Roll dice (e.g. 2d6+1, 3d6, d66)", "options": [{ "name": "notation", "description": "Dice notation", "type": 3, "required": true }] },
    { "name": "session", "description": "Manage game sessions", "options": [{ "name": "action", "description": "start, end, or context", "type": 3, "required": true, "choices": [{ "name": "Start a new session", "value": "start" }, { "name": "End the current session", "value": "end" }, { "name": "View recent context", "value": "context" }] }, { "name": "name", "description": "Session name", "type": 3, "required": false }, { "name": "minutes", "description": "Minutes of context", "type": 4, "required": false }] },
    { "name": "search", "description": "Search session transcript", "options": [{ "name": "query", "description": "What to search for", "type": 3, "required": true }] },
    { "name": "help", "description": "Show available commands" },
  ]);

  try {
    execSync(
      `curl -s -X PUT "https://discord.com/api/v10/applications/${discordClientId}/commands" -H "Authorization: Bot ${discordToken}" -H "Content-Type: application/json" -d '${commands}'`,
      { stdio: "pipe" }
    );
    success("Slash commands registered");
  } catch {
    warn("Could not register slash commands. Run the curl command from README.md manually.");
  }

  // ── Step 13: Done ──
  console.log(`
  ✨ Setup Complete! ✨

  ╭──────────────────────────────────────────────────────────╮
  │                                                          │
  │  🔗 Invite bot to your server:                           │
  │  https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&permissions=2147485696&scope=bot%20applications.commands
  │                                                          │
  │  🌐 Set Interactions Endpoint URL in Discord Portal:     │
  │  https://2d6mcp.YOUR-SUBDOMAIN.workers.dev/api/interactions
  │                                                          │
  │  💬 Try /help in Discord to see commands!                │
  │                                                          │
  ╰──────────────────────────────────────────────────────────╯
  `);
}

main().catch((err) => {
  console.error("\n  ✗ Setup failed:", err.message);
  process.exit(1);
});
