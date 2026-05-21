// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import { checkByodConsent } from "./byod/gate.js";
import { getToolDefinitions, dispatchToolCall } from "./tools/index.js";
import { ensureOglDb, ensureDwDb, syncByodIndex, getServerVersion } from "./tools/helpers.js";

export async function startServer(): Promise<void> {
  const version = getServerVersion();
  const server = new Server(
    {
      name: "2d6mcp",
      version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = getToolDefinitions();
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return dispatchToolCall(name, args);
  });

  const transport = new StdioServerTransport();

  ensureOglDb();
  ensureDwDb();

  const config = loadConfig();
  const consent = checkByodConsent();
  if (consent.allowed) {
    setImmediate(() => {
      syncByodIndex(config)
        .then((result) => {
          process.stderr.write(`2d6mcp: ${result.message}\n`);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          process.stderr.write(`2d6mcp: BYOD sync failed: ${msg}\n`);
        });
    });
  }

  await server.connect(transport);
}
