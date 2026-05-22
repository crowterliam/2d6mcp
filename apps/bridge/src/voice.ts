// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Per-guild voice connection management.
// Handles join/leave, Opus audio reception, and ring buffer writing.

import {
  joinVoiceChannel,
  EndBehaviorType,
  VoiceConnectionStatus,
  entersState,
  type VoiceConnection,
} from "@discordjs/voice";
import type { VoiceBasedChannel, Guild } from "discord.js";
import { RingBuffer } from "./ring-buffer.js";

export interface VoiceState {
  connection: VoiceConnection;
  ringBuffer: RingBuffer;
  guildId: string;
}

const voiceStates = new Map<string, VoiceState>();
const pendingJoins = new Set<string>();

export function getVoiceState(guildId: string): VoiceState | undefined {
  return voiceStates.get(guildId);
}

export function getVoiceCount(): number {
  return voiceStates.size;
}

export function getTotalMemory(): number {
  let total = 0;
  for (const s of voiceStates.values()) total += s.ringBuffer.memoryUsageBytes;
  return total;
}

export async function joinVoice(channel: VoiceBasedChannel, guild: Guild): Promise<VoiceState> {
  const existing = voiceStates.get(guild.id);
  if (existing) return existing;

  // Prevent duplicate joins from racing VoiceStateUpdate events
  if (pendingJoins.has(guild.id)) {
    console.log(`Skipping duplicate join for ${guild.name}`);
    const state = voiceStates.get(guild.id);
    if (state) return state;
    throw new Error("Join already in progress");
  }
  pendingJoins.add(guild.id);

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: true,
  });

  // Log state transitions — every single one
  connection.on("stateChange", (oldState: any, newState: any) => {
    console.log(`[voice:${guild.id}] ${oldState.status} → ${newState.status}`);
  });

  connection.on("error", (err: Error) => {
    console.error(`[voice:${guild.id}] error:`, err.message);
  });

  // Simplified: don't auto-destroy on disconnect, let @discordjs/voice manage it
  connection.on(VoiceConnectionStatus.Disconnected, () => {
    console.log(`[voice:${guild.id}] disconnected`);
  });

  // Wait for the connection to be ready (25s timeout for Discord voice)
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 25_000);
  } catch (err) {
    pendingJoins.delete(guild.id);
    try { connection.destroy(); } catch {}
    throw err;
  }
  pendingJoins.delete(guild.id);
  console.log(`Joined voice: ${guild.name} (${guild.id})`);

  // The voice receiver is a property of the connection, not a separate factory
  const receiver = connection.receiver;

  // Listen for Opus audio from all speakers
  receiver.speaking.on("start", (userId: string) => {
    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1000,
      },
    });

    // Decode Opus → PCM and write to ring buffer
    // chunk is raw Opus data; store as 16-bit PCM samples
    opusStream.on("data", (chunk: Buffer) => {
      const pcm = new Int16Array(chunk.buffer, chunk.byteOffset, Math.floor(chunk.byteLength / 2));
      ringBuffer.write(pcm);
    });
  });

  connection.on("stateChange", (_oldState, newState) => {
    if (newState.status === VoiceConnectionStatus.Destroyed) {
      voiceStates.delete(guild.id);
    }
  });

  const state: VoiceState = { connection, ringBuffer, guildId: guild.id };
  voiceStates.set(guild.id, state);

  return state;
}

export function destroyVoice(guildId: string): void {
  const state = voiceStates.get(guildId);
  if (!state) return;

  try { state.connection.destroy(); } catch {}
  voiceStates.delete(guildId);
  console.log(`Destroyed voice: ${guildId}`);
}

