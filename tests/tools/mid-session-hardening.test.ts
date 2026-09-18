/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync } from "node:fs";
import { dispatchToolCall } from "../../packages/server/src/tools/index.js";
import { closeSessionDb } from "../../packages/server/src/session/database.js";

const TMP = join(tmpdir(), `2d6mcp-test-mid-session-${Date.now()}`);
const originalSession = process.env.SESSION_DB_PATH;

describe("mid-session tool hardening", () => {
  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
    process.env.SESSION_DB_PATH = join(TMP, "sessions.db");
  });

  afterEach(() => {
    closeSessionDb();
    if (originalSession === undefined) {
      delete process.env.SESSION_DB_PATH;
    } else {
      process.env.SESSION_DB_PATH = originalSession;
    }
    rmSync(TMP, { recursive: true, force: true });
  });

  it("defaults rules_system to byod when byod_system is set", async () => {
    const started = await dispatchToolCall("session", {
      action: "start",
      name: "commercial shelf",
      byod_system: "commercial-2d6-scifi",
    });
    expect(started.isError).toBeUndefined();
    const session = JSON.parse(started.content[0].text) as {
      rules_system: string;
      byod_system: string;
    };
    expect(session.rules_system).toBe("byod");
    expect(session.byod_system).toBe("commercial-2d6-scifi");
  });

  it("AND-matches transcript tokens that are not adjacent", async () => {
    const started = await dispatchToolCall("session", {
      action: "start",
      name: "and-search",
      rules_system: "byod",
      byod_system: "collection-a",
    });
    const session = JSON.parse(started.content[0].text) as { id: string };
    await dispatchToolCall("log_transcript", {
      session_id: session.id,
      text: "Pilot check at Difficult target",
    });
    await dispatchToolCall("log_transcript", {
      session_id: session.id,
      text: "Smoke test of transcript search",
    });

    const phraseMiss = JSON.parse(
      (
        await dispatchToolCall("search_transcript", {
          session_id: session.id,
          query: '"Pilot Difficult"',
        })
      ).content[0].text
    ) as { count: number; match: string };
    expect(phraseMiss.match).toBe("phrase");
    expect(phraseMiss.count).toBe(0);

    const andHit = JSON.parse(
      (
        await dispatchToolCall("search_transcript", {
          session_id: session.id,
          query: "Pilot Difficult",
        })
      ).content[0].text
    ) as { count: number; match: string; results: Array<{ text: string }> };
    expect(andHit.match).toBe("and");
    expect(andHit.count).toBe(1);
    expect(andHit.results[0].text).toContain("Pilot");

    const quotedHit = JSON.parse(
      (
        await dispatchToolCall("search_transcript", {
          session_id: session.id,
          query: '"Smoke test"',
        })
      ).content[0].text
    ) as { count: number; match: string };
    expect(quotedHit.match).toBe("phrase");
    expect(quotedHit.count).toBe(1);
  });

  it("parses pasted sheet_text without a file_path", async () => {
    const result = await dispatchToolCall("parse_character", {
      sheet_text: "Name: Test Pilot\nCareer: Navy\nUPP: 777777\nPilot-2",
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text) as {
      name: string;
      career: string;
      upp: string;
      skills: Array<{ name: string; level: number }>;
    };
    expect(parsed.name).toBe("Test Pilot");
    expect(parsed.career).toBe("Navy");
    expect(parsed.upp).toBe("777777");
    expect(parsed.skills).toEqual([{ name: "Pilot", level: 2 }]);
  });

  it("documents missing parse_character args", async () => {
    const result = await dispatchToolCall("parse_character", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("file_path or sheet_text is required");
  });

  it("returns retrieved context when the local LLM is unavailable", async () => {
    const result = await dispatchToolCall("synthesize_ruling", {
      question: "cover in combat",
      rules_system: "ogl",
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text) as {
      ruling: string | null;
      llm_error?: string;
      rules_context: string;
    };
    expect(parsed.ruling).toBeNull();
    expect(parsed.llm_error).toBeTruthy();
    expect(parsed.rules_context.length).toBeGreaterThan(0);
  });
});
