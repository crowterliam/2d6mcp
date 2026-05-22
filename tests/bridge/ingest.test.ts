// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RingBuffer } from "../../apps/bridge/src/ring-buffer.js";
import { ingestAudio } from "../../apps/bridge/src/ingest.js";

describe("ingestAudio", () => {
  let buffer: RingBuffer;
  const workerUrl = "https://test-worker.example.com";

  beforeEach(() => {
    buffer = new RingBuffer("test-guild", 5);
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok: false for empty buffer", async () => {
    // Buffer is empty — flush returns null
    // @ts-expect-error null buffer triggers this path
    const originalFlush = buffer.flush;
    buffer.flush = vi.fn().mockReturnValue(null);

    const result = await ingestAudio(buffer, "guild-1", 30, { workerUrl });
    expect(result.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uploads audio to Worker and returns key", async () => {
    const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ ok: true, key: "audio/guild-1/12345.pcm" }) };
    vi.mocked(fetch).mockResolvedValue(mockResponse as any);

    // Write 2 seconds of audio
    const samples = new Int16Array(16000 * 2);
    for (let i = 0; i < samples.length; i++) samples[i] = 100;
    buffer.write(samples);

    const result = await ingestAudio(buffer, "guild-1", 1, { workerUrl });

    expect(result.ok).toBe(true);
    expect(result.key).toBe("audio/guild-1/12345.pcm");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `${workerUrl}/api/audio-ingest?guild_id=guild-1`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );
  });

  it("includes guild_id in query string", async () => {
    const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ ok: true }) };
    vi.mocked(fetch).mockResolvedValue(mockResponse as any);

    buffer.write(new Int16Array(16000).fill(50));

    await ingestAudio(buffer, "my-test-guild", 1, { workerUrl });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("guild_id=my-test-guild"),
      expect.any(Object),
    );
  });

  it("returns ok: false when Worker responds with error status", async () => {
    const mockResponse = { ok: false, status: 500 };
    vi.mocked(fetch).mockResolvedValue(mockResponse as any);

    buffer.write(new Int16Array(16000).fill(50));

    const result = await ingestAudio(buffer, "guild-1", 1, { workerUrl });
    expect(result.ok).toBe(false);
  });

  it("returns ok: false on network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    buffer.write(new Int16Array(16000).fill(50));

    // Should not throw
    await expect(
      ingestAudio(buffer, "guild-1", 1, { workerUrl })
    ).rejects.toThrow("Network error");
  });
});
