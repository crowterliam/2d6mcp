// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// 2d6mcp Discord Voice Bridge — Entry Point (Fly.io)
// Auto-joins voice channels, captures audio, exposes HTTP endpoints
// for the Cloudflare Worker to trigger push-to-ask.

import { Client, Events, GatewayIntentBits } from "discord.js";
import { joinVoice, getVoiceCount, getTotalMemory, getVoiceState } from "./voice.js";
import { startHealthServer, updateHealthState } from "./health.js";
import { config } from "./env.js";

// ── Discord Client Setup ──
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ── Auto-Join Voice ──
// When someone joins a voice channel, auto-join if the bot has access.
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (!newState.channelId || oldState.channelId === newState.channelId) return;
  if (newState.member?.user.bot) return;

  const guild = newState.guild;
  const me = guild.members.me;
  if (!me) return;

  const existing = getVoiceState(guild.id);
  if (existing) return;

  try {
    const channel = newState.channel;
    if (!channel) return;
    await joinVoice(channel, guild);
    console.log(`Auto-joined ${guild.name} → ${channel.name}`);
    updateHealthState({ guilds: getVoiceCount(), memoryBytes: getTotalMemory() });
  } catch (err) {
    console.error(`Auto-join failed for ${guild.name}:`, err);
  }
});

// ── Gateway Connect ──
client.once(Events.ClientReady, (ready) => {
  console.log(`Bridge ready — logged in as ${ready.user.tag}`);
  void fetch(`${config.workerUrl}/api/warm`, { method: "POST" }).catch(() => {});
});

// ── Login ──
console.log("Starting bridge...");
await client.login(config.discordToken);

// ── Health + Push-to-Ask Server ──
startHealthServer(3000, config.workerUrl);

// ── Periodic Health Update ──
setInterval(() => {
  updateHealthState({
    guilds: getVoiceCount(),
    memoryBytes: getTotalMemory(),
  });
}, 10_000);
