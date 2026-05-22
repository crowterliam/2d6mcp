// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// 2d6mcp Discord Voice Bridge — Entry Point (Fly.io)
// Connects to Discord gateway, manages voice connections,
// streams audio to Cloudflare Worker for AI processing.

import { Client, Events, GatewayIntentBits } from "discord.js";
import { joinVoice, destroyVoice, getVoiceCount, getTotalMemory, getVoiceState } from "./voice.js";
import { ingestAudio } from "./ingest.js";
import { startHealthServer, updateHealthState } from "./health.js";
import type {} from "./ring-buffer.js";

import { config } from "./env.js";

// ── Discord Client Setup ──
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ── Slash Command Handling ──
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: "This command must be used in a server.", ephemeral: true });
    return;
  }

  try {
    switch (interaction.commandName) {
      case "join": {
        await interaction.deferReply({ ephemeral: true });
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        const voiceChannel = member?.voice.channel;
        if (!voiceChannel) {
          await interaction.editReply("You must be in a voice channel.");
          return;
        }
        if (!interaction.guild) {
          await interaction.editReply("Could not find guild.");
          return;
        }
        const state = await joinVoice(voiceChannel, interaction.guild);
        updateHealthState({ guilds: getVoiceCount(), memoryBytes: getTotalMemory() });
        await interaction.editReply(`Joined ${voiceChannel.name}. Listening. Use \`/push-to-ask\` to get a ruling.`);
        break;
      }

      case "leave": {
        await interaction.deferReply({ ephemeral: true });
        destroyVoice(guildId);
        updateHealthState({ guilds: getVoiceCount(), memoryBytes: getTotalMemory() });
        await interaction.editReply("Disconnected from voice channel.");
        break;
      }

      case "push-to-ask": {
        await interaction.deferReply();
        const seconds = interaction.options.getInteger("seconds") || 30;
        const voiceState = getVoiceState(guildId);
        if (!voiceState) {
          await interaction.editReply("Not connected to voice. Use `/join` first.");
          return;
        }

        const result = await ingestAudio(voiceState.ringBuffer, guildId, seconds, {
          workerUrl: config.workerUrl,
          workerApiKey: config.workerApiKey,
        });

        if (!result.ok) {
          await interaction.editReply("No audio captured or upload failed. Try again in a few seconds.");
          return;
        }

        await interaction.editReply(`Audio sent (${seconds}s). Ask \`/ask\` with your question to reference this moment.`);
        break;
      }

      default:
        await interaction.reply({ content: `Unknown command: ${interaction.commandName}`, ephemeral: true });
    }
  } catch (err) {
    console.error("Interaction error:", err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "An error occurred.", ephemeral: true });
      } else {
        await interaction.followUp({ content: "An error occurred.", ephemeral: true });
      }
    } catch {}
  }
});

// ── Gateway Connect ──
client.once(Events.ClientReady, (ready) => {
  console.log(`Bridge ready — logged in as ${ready.user.tag}`);
  console.log(`Worker URL: ${config.workerUrl}`);

  // Register slash commands for voice control
  void ready.application.commands.set([
    {
      name: "join",
      description: "Join your current voice channel to enable push-to-ask",
    },
    {
      name: "leave",
      description: "Disconnect from voice channel",
    },
    {
      name: "push-to-ask",
      description: "Capture the last N seconds of voice audio for AI analysis",
      options: [
        {
          name: "seconds",
          description: "Seconds of audio to capture (default 30)",
          type: 4,
          required: false,
        },
      ],
    },
  ]);

  console.log("Slash commands registered");

  // Warm up the Worker's AI models
  void fetch(`${config.workerUrl}/api/warm`, { method: "POST" }).catch(() => {});
});

// ── Login ──
console.log("Starting bridge...");
await client.login(config.discordToken);

// ── Health Server ──
startHealthServer(3000);

// ── Periodic Health Update ──
setInterval(() => {
  updateHealthState({
    guilds: getVoiceCount(),
    memoryBytes: getTotalMemory(),
  });
}, 10_000);
