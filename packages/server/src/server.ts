// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getToolDefinitions, dispatchToolCall } from "./tools/index.js";
import { ensureOglDb, ensureDwDb, ensureOrcusDb, getServerVersion } from "./tools/helpers.js";
import { loadConfig } from "./config.js";
import { getPrompt, getPromptDefinitions } from "./prompts.js";
import { getResourceDefinitions, getResourceTemplates, readResource } from "./resources.js";

export function createMcpServer(): Server {
  const version = getServerVersion();
  const server = new Server(
    {
      name: "2d6mcp",
      version,
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const { byodConsented } = loadConfig();
    const tools = getToolDefinitions({ byodConsented });
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return dispatchToolCall(name, args);
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: getPromptDefinitions() };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    return getPrompt(request.params.name, request.params.arguments);
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: getResourceDefinitions() };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return { resourceTemplates: getResourceTemplates() };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const contents = readResource(request.params.uri);
    return { contents: [contents] };
  });

  return server;
}

export async function startServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  ensureOglDb();
  ensureDwDb();
  ensureOrcusDb();

  await server.connect(transport);
}
