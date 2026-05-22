// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Minimal HTTP health check server for Fly.io monitoring.

import { createServer } from "node:http";

export interface HealthState {
  guilds: number;
  uptime: number;
  memoryBytes: number;
}

let state: HealthState = { guilds: 0, uptime: 0, memoryBytes: 0 };

export function updateHealthState(s: Partial<HealthState>): void {
  state = { ...state, ...s };
}

export function startHealthServer(port: number): void {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      guilds: state.guilds,
      uptime: Math.floor(process.uptime()),
      memory: `${Math.round(state.memoryBytes / 1024 / 1024)}MB`,
    }));
  });

  server.listen(port, () => {
    console.log(`Health server listening on port ${port}`);
  });
}
