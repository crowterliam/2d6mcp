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

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator as any,
    selfDeaf: true,
    selfMute: false,
  });

  // Wait for the connection to be ready
  await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
  console.log(`Joined voice: ${guild.name} (${guild.id})`);

  // The voice receiver is a property of the connection, not a separate factory
  const receiver = connection.receiver;

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      console.log(`Voice disconnected: ${guild.name}`);
      destroyVoice(guild.id);
    }
  });

  const ringBuffer = new RingBuffer(guild.id, 120);

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

