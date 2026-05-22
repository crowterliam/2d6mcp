// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Ring buffer for 16kHz mono PCM audio.
// Circular buffer in a single Int16Array. Writes timestamped audio;
// flush extracts the last N seconds as a properly headed WAV buffer.

const SAMPLE_RATE = 16000;
const SAMPLE_SIZE = 2; // 16-bit = 2 bytes per sample

export interface RingBufferState {
  samplesWritten: number;
  lastFlushTime: number;
  guildId: string;
}

export class RingBuffer {
  private buffer: Int16Array;
  private writeIndex: number;
  private totalWritten: number;
  private lastFlushTime: number;
  readonly guildId: string;
  readonly durationSeconds: number;

  constructor(guildId: string, durationSeconds: number = 120) {
    this.guildId = guildId;
    this.durationSeconds = durationSeconds;
    const capacity = SAMPLE_RATE * durationSeconds;
    this.buffer = new Int16Array(capacity);
    this.writeIndex = 0;
    this.totalWritten = 0;
    this.lastFlushTime = Date.now();
  }

  /** Append PCM samples to the ring buffer. */
  write(samples: Int16Array): void {
    const len = samples.length;
    const capacity = this.buffer.length;

    if (len >= capacity) {
      samples.copyWithin(0, len - capacity, len);
      this.buffer.set(samples.subarray(len - capacity));
      this.writeIndex = 0;
      this.totalWritten += len;
      return;
    }

    const remaining = capacity - this.writeIndex;
    if (len <= remaining) {
      this.buffer.set(samples, this.writeIndex);
      this.writeIndex = (this.writeIndex + len) % capacity;
    } else {
      this.buffer.set(samples.subarray(0, remaining), this.writeIndex);
      this.buffer.set(samples.subarray(remaining), 0);
      this.writeIndex = len - remaining;
    }
    this.totalWritten += len;
  }

  /** Flush the last N seconds to a WAV buffer. Returns null if buffer is empty. */
  flush(lastSeconds: number = 30): ArrayBuffer | null {
    const samplesNeeded = SAMPLE_RATE * lastSeconds;
    const capacity = this.buffer.length;
    const available = Math.min(this.totalWritten, capacity);

    if (available === 0) return null;

    const flushLength = Math.min(samplesNeeded, available);
    const samples = new Int16Array(flushLength);

    if (flushLength <= this.writeIndex) {
      samples.set(this.buffer.subarray(this.writeIndex - flushLength, this.writeIndex));
    } else {
      const fromStart = flushLength - this.writeIndex;
      samples.set(this.buffer.subarray(capacity - fromStart), 0);
      samples.set(this.buffer.subarray(0, this.writeIndex), fromStart);
    }

    this.lastFlushTime = Date.now();
    return pcmToWav(samples, SAMPLE_RATE);
  }

  getState(): RingBufferState {
    return {
      samplesWritten: this.totalWritten,
      lastFlushTime: this.lastFlushTime,
      guildId: this.guildId,
    };
  }

  get memoryUsageBytes(): number {
    return this.buffer.byteLength;
  }
}

/** Write a WAV header + PCM data into an ArrayBuffer. */
function pcmToWav(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const byteLength = samples.byteLength;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + byteLength);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + byteLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);            // PCM
  view.setUint16(20, 1, true);             // format = 1
  view.setUint16(22, 1, true);             // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);             // block align
  view.setUint16(34, 16, true);            // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, byteLength, true);

  new Uint8Array(buffer, headerSize).set(new Uint8Array(samples.buffer));
  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
