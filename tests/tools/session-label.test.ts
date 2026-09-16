/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync } from "node:fs";
import { dispatchToolCall } from "../../packages/server/src/tools/index.js";
import { closeSessionDb } from "../../packages/server/src/session/database.js";

const TMP = join(tmpdir(), `2d6mcp-test-session-label-${Date.now()}`);
const originalSession = process.env.SESSION_DB_PATH;

describe("session table_label dispatch", () => {
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

  it("isolates transcript search by table_label", async () => {
    const started = await dispatchToolCall("session", {
      action: "start",
      name: "B/X table",
      rules_system: "osr",
      table_label: "table-a",
    });
    expect(started.isError).toBeUndefined();
    const session = JSON.parse(started.content[0].text) as { id: string; table_label: string };
    expect(session.table_label).toBe("table-a");

    await dispatchToolCall("session", {
      action: "start",
      name: "sci-fi table",
      rules_system: "ogl",
      table_label: "table-b",
    });

    await dispatchToolCall("log_transcript", {
      session_id: session.id,
      text: "The hireling refuses the offer",
    });

    const listed = JSON.parse(
      (await dispatchToolCall("session", { action: "list", table_label: "table-a" })).content[0].text
    ) as { sessions: Array<{ id: string }> };
    expect(listed.sessions).toHaveLength(1);
    expect(listed.sessions[0].id).toBe(session.id);

    const hits = JSON.parse(
      (
        await dispatchToolCall("search_transcript", {
          table_label: "table-a",
          query: "hireling",
        })
      ).content[0].text
    ) as { results: unknown[] };
    expect(hits.results).toHaveLength(1);

    const other = JSON.parse(
      (
        await dispatchToolCall("search_transcript", {
          table_label: "table-b",
          query: "hireling",
        })
      ).content[0].text
    ) as { results: unknown[] };
    expect(other.results).toHaveLength(0);
  });
});
