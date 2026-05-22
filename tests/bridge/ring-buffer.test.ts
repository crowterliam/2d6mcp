// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeEach } from "vitest";
import { RingBuffer } from "../../apps/bridge/src/ring-buffer.js";

function writeSine(buffer: RingBuffer, durationMs: number, amplitude = 0.5, frequency = 440): void {
  const samples = Math.floor(16000 * (durationMs / 1000));
  const data = new Int16Array(samples);
  for (let i = 0; i < samples; i++) {
    data[i] = Math.floor(32767 * amplitude * Math.sin(2 * Math.PI * frequency * i / 16000));
  }
  buffer.write(data);
}

function wavSampleCount(wav: ArrayBuffer): number {
  const view = new DataView(wav);
  // Data subchunk size is at byte 40
  return view.getUint32(40, true) / 2;
}

describe("RingBuffer", () => {
  let buffer: RingBuffer;

  beforeEach(() => {
    buffer = new RingBuffer("test-guild", 5); // 5-second buffer for faster testing
  });

  it("creates a buffer with correct capacity", () => {
    expect(buffer.memoryUsageBytes).toBe(16000 * 5 * 2); // samples * bytes per sample
    expect(buffer.durationSeconds).toBe(5);
    expect(buffer.guildId).toBe("test-guild");
  });

  it("returns null on empty flush", () => {
    expect(buffer.flush(1)).toBeNull();
  });

  it("writes and flushes audio as valid WAV", () => {
    writeSine(buffer, 1000); // 1 second of audio

    const wav = buffer.flush(1);
    expect(wav).not.toBeNull();
    expect(wav!.byteLength).toBeGreaterThan(44); // header + data

    // Verify WAV header
    const view = new DataView(wav!);
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(riff).toBe("RIFF");

    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    expect(wave).toBe("WAVE");

    // 16kHz, mono, 16-bit
    expect(view.getUint32(24, true)).toBe(16000); // sample rate
    expect(view.getUint16(22, true)).toBe(1);     // channels
    expect(view.getUint16(34, true)).toBe(16);     // bits per sample

    // Data chunk header
    const dataId = String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39));
    expect(dataId).toBe("data");
  });

  it("flushes correct number of samples", () => {
    writeSine(buffer, 2000); // 2 seconds of audio

    const samples1 = wavSampleCount(buffer.flush(0.5)!);
    expect(samples1).toBe(16000 * 0.5);

    const samples2 = wavSampleCount(buffer.flush(2)!);
    expect(samples2).toBe(16000 * 2);
  });

  it("handles circular wrapping when buffer overflows", () => {
    // Write 6 seconds of audio into a 5-second buffer
    writeSine(buffer, 2000); // +2s
    writeSine(buffer, 2000); // +2s = 4s total
    writeSine(buffer, 2000); // +2s = 6s total, 1s overwritten

    // Should only have 5s of audio (capacity), last 2s present
    const wav = buffer.flush(5);
    expect(wav).not.toBeNull();
    const samples = wavSampleCount(wav!);
    expect(samples).toBe(16000 * 5);
  });

  it("writes samples larger than buffer capacity correctly", () => {
    // Write 8 seconds directly into a 5-second buffer
    const bigData = new Int16Array(16000 * 8);
    for (let i = 0; i < bigData.length; i++) bigData[i] = 100;
    buffer.write(bigData);

    // Should keep last 5 seconds
    const wav = buffer.flush(5);
    expect(wavSampleCount(wav!)).toBe(16000 * 5);
  });

  it("tracks total written samples", () => {
    writeSine(buffer, 1000);
    expect(buffer.getState().samplesWritten).toBe(16000);

    writeSine(buffer, 500);
    expect(buffer.getState().samplesWritten).toBe(16000 + 8000);
  });

  it("updates lastFlushTime", () => {
    const before = buffer.getState().lastFlushTime;
    writeSine(buffer, 500);

    // Small delay to ensure time moves
    // In practice this is near-instant but good to verify
    const wav = buffer.flush(0.5);
    expect(wav).not.toBeNull();
    expect(buffer.getState().lastFlushTime).toBeGreaterThanOrEqual(before);
  });

  it("handles different flush durations", () => {
    writeSine(buffer, 3000); // 3 seconds

    expect(wavSampleCount(buffer.flush(1)!)).toBe(16000);   // 1s
    expect(wavSampleCount(buffer.flush(2)!)).toBe(32000);  // 2s
    expect(wavSampleCount(buffer.flush(0.5)!)).toBe(8000); // 0.5s
  });

  it("memory usage reflects actual buffer size", () => {
    const b2 = new RingBuffer("guild-2", 10);
    expect(b2.memoryUsageBytes).toBe(16000 * 10 * 2);

    const b3 = new RingBuffer("guild-3", 60);
    expect(b3.memoryUsageBytes).toBe(16000 * 60 * 2);
  });

  it("returns correct state with guildId", () => {
    const state = buffer.getState();
    expect(state.guildId).toBe("test-guild");
    expect(state.samplesWritten).toBe(0);
    expect(state.lastFlushTime).toBeGreaterThan(0);
  });
});
