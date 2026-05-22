// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// HTTP server for health checks and push-to-ask trigger from Worker.

import { createServer } from "node:http";
import { getVoiceState } from "./voice.js";
import { ingestAudio } from "./ingest.js";

export interface HealthState {
  guilds: number;
  uptime: number;
  memoryBytes: number;
}

let state: HealthState = { guilds: 0, uptime: 0, memoryBytes: 0 };
let workerUrl = "";

export function updateHealthState(s: Partial<HealthState>): void {
  state = { ...state, ...s };
}

export function startHealthServer(port: number, wrkUrl: string): void {
  workerUrl = wrkUrl;

  const server = createServer(async (req, res) => {
    try {
      // ── Health ──
      if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          status: "ok",
          guilds: state.guilds,
          uptime: Math.floor(process.uptime()),
          memory: `${Math.round(state.memoryBytes / 1024 / 1024)}MB`,
        }));
        return;
      }

      // ── Push-to-Ask (called by Worker) ──
      if (req.method === "POST" && req.url?.startsWith("/push-to-ask")) {
        const url = new URL(req.url, `http://localhost:${port}`);
        const guildId = url.searchParams.get("guild_id");
        const seconds = parseInt(url.searchParams.get("seconds") || "30", 10);

        if (!guildId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "guild_id required" }));
          return;
        }

        const voiceState = getVoiceState(guildId);
        if (!voiceState) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "not connected to voice" }));
          return;
        }

        const result = await ingestAudio(voiceState.ringBuffer, guildId, seconds, {
          workerUrl,
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }

      res.writeHead(404);
      res.end();
    } catch (err) {
      console.error("Health server error:", err);
      res.writeHead(500);
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(`Health server listening on port ${port}`);
  });
}
