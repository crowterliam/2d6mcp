/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../../packages/server/src/server.js";

describe("MCP capabilities handshake", () => {
  it("lists tools, prompts, and resources and can read a resource", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer();
    const client = new Client({ name: "score-test", version: "0.0.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const tools = await client.listTools();
      const prompts = await client.listPrompts();
      const resources = await client.listResources();

      expect(tools.tools.some((t) => t.name === "roll")).toBe(true);
      expect(prompts.prompts.some((p) => p.name === "skill-check")).toBe(true);
      expect(resources.resources.some((r) => r.uri === "2d6mcp://info")).toBe(true);

      const prompt = await client.getPrompt({ name: "lookup-rules", arguments: { system: "ogl", query: "combat" } });
      expect(prompt.messages[0].content.type).toBe("text");

      const info = await client.readResource({ uri: "2d6mcp://info" });
      const text = info.contents[0];
      expect("text" in text).toBe(true);
      if ("text" in text) {
        const parsed = JSON.parse(text.text) as { capabilities: { prompts: boolean; resources: boolean } };
        expect(parsed.capabilities.prompts).toBe(true);
        expect(parsed.capabilities.resources).toBe(true);
      }
    } finally {
      await client.close();
      await server.close();
    }
  });
});
