// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Environment configuration for the bridge.

export const config = {
  discordToken: process.env.DISCORD_BOT_TOKEN || "",
  workerUrl: process.env.WORKER_URL || "https://2d6mcp.3ivkf0oy1.workers.dev",
  workerApiKey: process.env.WORKER_API_KEY || "",
  healthPort: parseInt(process.env.HEALTH_PORT || "3000", 10),
};

if (!config.discordToken) {
  console.error("DISCORD_BOT_TOKEN is required. Set it in the environment.");
  process.exit(1);
}
