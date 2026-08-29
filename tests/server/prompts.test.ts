/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect } from "vitest";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  getPrompt,
  getPromptDefinitions,
  isPromptName,
  PROMPT_NAMES,
} from "../../packages/server/src/prompts.js";

describe("MCP prompts", () => {
  it("lists workflow prompts", () => {
    const prompts = getPromptDefinitions();
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.map((p) => p.name)).toEqual([...PROMPT_NAMES]);
    for (const prompt of prompts) {
      expect(prompt.description?.length).toBeGreaterThan(8);
    }
  });

  it("renders skill-check with defaults and overrides", () => {
    const result = getPrompt("skill-check", { modifier: "+2", target: "10", task: "a stealth check" });
    const text = result.messages[0].content;
    expect(text.type).toBe("text");
    if (text.type !== "text") return;
    expect(text.text).toContain("stealth check");
    expect(text.text).toContain('mechanic "2d6"');
    expect(text.text).toContain("modifier +2");
    expect(text.text).toContain("target 10");
  });

  it("renders lookup-rules with system and query", () => {
    const result = getPrompt("lookup-rules", { system: "dw", query: "hack and slash" });
    const text = result.messages[0].content;
    expect(text.type).toBe("text");
    if (text.type !== "text") return;
    expect(text.text).toContain("query_rules");
    expect(text.text).toContain("dw");
    expect(text.text).toContain("hack and slash");
  });

  it("renders index-documents as on-demand indexing", () => {
    const listed = getPrompt("index-documents", {});
    const listedText = listed.messages[0].content;
    expect(listedText.type).toBe("text");
    if (listedText.type !== "text") return;
    expect(listedText.text).toContain("list top-level collections");
    expect(listedText.text).not.toContain("Call sync_byod. If complete is false");

    const queried = getPrompt("index-documents", { query: "traveller" });
    const queriedText = queried.messages[0].content;
    expect(queriedText.type).toBe("text");
    if (queriedText.type !== "text") return;
    expect(queriedText.text).toContain('query "traveller"');
  });

  it("rejects unknown prompts", () => {
    expect(isPromptName("skill-check")).toBe(true);
    expect(isPromptName("not-a-prompt")).toBe(false);
    expect(() => getPrompt("not-a-prompt")).toThrow(McpError);
    try {
      getPrompt("not-a-prompt");
    } catch (err) {
      expect(err).toBeInstanceOf(McpError);
      expect((err as McpError).code).toBe(ErrorCode.InvalidParams);
    }
  });
});
