// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Simplified voice module — event-driven connection management.
// Skips entersState/Ready gate; subscribes to audio when the connection reaches Ready state.

import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  getVoiceConnection,
  type VoiceConnection,
} from "@discordjs/voice";
import type { VoiceBasedChannel } from "discord.js";
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

export function connectToVoice(channel: VoiceBasedChannel, guild: { id: string; name: string; voiceAdapterCreator: any }): void {
  const existing = voiceStates.get(guild.id);
  if (existing) return;

  const existingConn = getVoiceConnection(guild.id);
  if (existingConn) {
    console.log(`[voice:${guild.id}] already has connection, reusing`);
    return;
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: (guild as any).voiceAdapterCreator,
    selfDeaf: true,
    selfMute: true,
  });

  const ringBuffer = new RingBuffer(guild.id, 120);
  const state: VoiceState = { connection, ringBuffer, guildId: guild.id };
  voiceStates.set(guild.id, state);

  // Event-driven: log state transitions, set up audio on Ready
  connection.on("stateChange", (oldState, newState) => {
    console.log(`[voice:${guild.id}] ${oldState.status} → ${newState.status}`);

    if (newState.status === VoiceConnectionStatus.Ready) {
      console.log(`[voice:${guild.id}] ready — subscribing to audio`);
      setupAudioReception(connection, ringBuffer, guild.id);
    }

    if (newState.status === VoiceConnectionStatus.Destroyed) {
      voiceStates.delete(guild.id);
    }
  });

  connection.on("error", (err: Error) => {
    console.error(`[voice:${guild.id}] error:`, err.message);
  });

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    console.log(`[voice:${guild.id}] disconnected`);
    // @discordjs/voice auto-reconnects; if it fails, it'll go to Destroyed
  });
}

function setupAudioReception(connection: VoiceConnection, buffer: RingBuffer, guildId: string): void {
  const receiver = connection.receiver;
  const subscribed = new Set<string>();

  receiver.speaking.on("start", (userId: string) => {
    if (subscribed.has(userId)) return;
    subscribed.add(userId);

    const stream = receiver.subscribe(userId, {
      end: { behavior: "afterSilence" as any, duration: 1000 },
    });

    stream.on("data", (chunk: Buffer) => {
      // chunk is raw Opus data
      const pcm = new Int16Array(chunk.buffer, chunk.byteOffset, Math.floor(chunk.byteLength / 2));
      buffer.write(pcm);
    });
  });
}

export function disconnectVoice(guildId: string): void {
  const state = voiceStates.get(guildId);
  if (!state) {
    // Try getVoiceConnection for externally-created connections
    const conn = getVoiceConnection(guildId);
    if (conn) { try { conn.destroy(); } catch {} }
    return;
  }

  try { state.connection.destroy(); } catch {}
  voiceStates.delete(guildId);
  console.log(`[voice:${guildId}] disconnected`);
}
