// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// 2d6mcp Discord Voice Bridge — Entry Point (VPS)
// Auto-joins voice channels, captures audio, exposes HTTP for Worker push-to-ask.

import { Client, Events, GatewayIntentBits } from "discord.js";
import { connectToVoice, getVoiceCount, getTotalMemory } from "./voice.js";
import { startHealthServer, updateHealthState } from "./health.js";
import { config } from "./env.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ── Auto-Join Voice ──
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (!newState.channelId || oldState.channelId === newState.channelId) return;
  if (newState.id === client.user?.id) return;
  if (newState.member?.user.bot) return;

  const guild = newState.guild;
  const channel = newState.channel;
  if (!channel) return;

  console.log(`Voice: ${newState.member?.user.username} joined voice in ${guild.name}`);
  connectToVoice(channel, guild);
  updateHealthState({ guilds: getVoiceCount(), memoryBytes: getTotalMemory() });
});

client.once(Events.ClientReady, (ready) => {
  console.log(`Bridge ready — logged in as ${ready.user.tag}`);
  void fetch(`${config.workerUrl}/api/warm`, { method: "POST" }).catch(() => {});
});

console.log("Starting bridge...");
await client.login(config.discordToken);
startHealthServer(3000, config.workerUrl);

setInterval(() => {
  updateHealthState({ guilds: getVoiceCount(), memoryBytes: getTotalMemory() });
}, 10_000);
