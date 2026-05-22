// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Audio ingestion — flushes ring buffer and POSTs PCM to the Cloudflare Worker.

import { RingBuffer } from "./ring-buffer.js";

export interface IngestConfig {
  workerUrl: string;
  workerApiKey?: string;
}

export async function ingestAudio(
  buffer: RingBuffer,
  guildId: string,
  lastSeconds: number,
  config: IngestConfig,
): Promise<{ ok: boolean; key?: string }> {
  const wavBuffer = buffer.flush(lastSeconds);
  if (!wavBuffer) return { ok: false };

  const response = await fetch(`${config.workerUrl}/api/audio-ingest?guild_id=${encodeURIComponent(guildId)}`, {
    method: "POST",
    body: wavBuffer,
    headers: {
      "Content-Type": "application/octet-stream",
    },
  });

  if (!response.ok) {
    console.error(`audio-ingest: Worker returned ${response.status}`);
    return { ok: false };
  }

  const result = await response.json() as { ok: boolean; key?: string };
  return result;
}
