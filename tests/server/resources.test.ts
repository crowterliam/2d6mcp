/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync } from "node:fs";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  getResourceDefinitions,
  getResourceTemplates,
  readResource,
  RESOURCE_URIS,
} from "../../packages/server/src/resources.js";
import { createSession, openSessionDb, closeSessionDb } from "../../packages/server/src/session/database.js";

const TMP = join(tmpdir(), `2d6mcp-resource-test-${Date.now()}`);
const originalSession = process.env.SESSION_DB_PATH;

describe("MCP resources", () => {
  afterEach(() => {
    closeSessionDb();
    if (originalSession === undefined) {
      delete process.env.SESSION_DB_PATH;
    } else {
      process.env.SESSION_DB_PATH = originalSession;
    }
    rmSync(TMP, { recursive: true, force: true });
  });

  it("lists attachable resources and a rules template", () => {
    const resources = getResourceDefinitions();
    expect(resources.map((r) => r.uri)).toEqual([...RESOURCE_URIS]);
    expect(resources.length).toBeGreaterThan(0);
    const templates = getResourceTemplates();
    expect(templates[0].uriTemplate).toBe("2d6mcp://rules/{system}");
  });

  it("reads server info and catalogs", () => {
    const info = JSON.parse(readResource("2d6mcp://info").text) as {
      name: string;
      capabilities: { tools: boolean; prompts: boolean; resources: boolean };
    };
    expect(info.name).toBe("2d6mcp");
    expect(info.capabilities).toEqual({ tools: true, prompts: true, resources: true });

    const tools = JSON.parse(readResource("2d6mcp://tools").text) as Array<{ name: string }>;
    expect(tools.some((t) => t.name === "roll")).toBe(true);
    expect(tools.some((t) => t.name === "query_rules")).toBe(true);

    const prompts = JSON.parse(readResource("2d6mcp://prompts").text) as Array<{ name: string }>;
    expect(prompts.some((p) => p.name === "skill-check")).toBe(true);
  });

  it("reads markdown docs", () => {
    const quickstart = readResource("2d6mcp://docs/quickstart");
    expect(quickstart.mimeType).toBe("text/markdown");
    expect(quickstart.text).toContain("npx");
    expect(quickstart.text).toContain("docker");

    const license = readResource("2d6mcp://license");
    expect(license.text).toContain("AGPL-3.0-only");
  });

  it("reports no active session when the db is missing", () => {
    process.env.SESSION_DB_PATH = join(TMP, "missing", "sessions.db");
    const parsed = JSON.parse(readResource("2d6mcp://session/current").text) as { active: boolean };
    expect(parsed.active).toBe(false);
  });

  it("returns the open session when one exists", () => {
    mkdirSync(TMP, { recursive: true });
    const dbPath = join(TMP, "sessions.db");
    process.env.SESSION_DB_PATH = dbPath;
    const db = openSessionDb(dbPath);
    const session = createSession(db, "dw", "Score Test");
    const parsed = JSON.parse(readResource("2d6mcp://session/current").text) as {
      active: boolean;
      id: string;
      name: string;
      rules_system: string;
    };
    expect(parsed.active).toBe(true);
    expect(parsed.id).toBe(session.id);
    expect(parsed.name).toBe("Score Test");
    expect(parsed.rules_system).toBe("dw");
  });

  it("rejects unknown URIs", () => {
    expect(() => readResource("2d6mcp://not-real")).toThrow(McpError);
    try {
      readResource("2d6mcp://not-real");
    } catch (err) {
      expect((err as McpError).code).toBe(ErrorCode.InvalidParams);
    }
  });
});
