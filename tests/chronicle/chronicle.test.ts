/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync } from "node:fs";
import { closeSessionDb } from "../../packages/server/src/session/database.js";
import { dispatchToolCall } from "../../packages/server/src/tools/index.js";

const TMP = join(tmpdir(), `2d6mcp-chronicle-${Date.now()}`);
const originalSession = process.env.SESSION_DB_PATH;

describe("chronicle tools", () => {
  afterEach(() => {
    closeSessionDb();
    if (originalSession === undefined) delete process.env.SESSION_DB_PATH;
    else process.env.SESSION_DB_PATH = originalSession;
    rmSync(TMP, { recursive: true, force: true });
  });

  function isolate(): void {
    mkdirSync(TMP, { recursive: true });
    process.env.SESSION_DB_PATH = join(TMP, "sessions.db");
  }

  it("CRUD, brief without LLM, search, and promote", async () => {
    isolate();
    const started = await dispatchToolCall("session", {
      action: "start",
      table_label: "table-a",
      rules_system: "osr",
    });
    const session = JSON.parse(started.content[0].text) as { id: string };

    const threadRes = await dispatchToolCall("chronicle", {
      action: "upsert_thread",
      table_label: "table-a",
      title: "Missing hireling",
      status: "open",
      priority: 2,
      summary: "The hireling vanished at the ford.",
      opened_session_id: session.id,
      tags: ["hireling"],
    });
    expect(threadRes.isError).toBeUndefined();
    const thread = JSON.parse(threadRes.content[0].text) as { id: string; status: string };
    expect(thread.status).toBe("open");

    const beatRes = await dispatchToolCall("chronicle", {
      action: "add_beat",
      table_label: "table-a",
      thread_id: thread.id,
      session_id: session.id,
      kind: "reveal",
      text: "The ford is watched by a rival crew.",
      source: "from_transcript",
    });
    const beat = JSON.parse(beatRes.content[0].text) as { id: string; confidence: string };
    expect(beat.confidence).toBe("provisional");

    await dispatchToolCall("chronicle", {
      action: "upsert_entity",
      table_label: "table-a",
      type: "person",
      name: "River Guide",
      aliases: ["the guide"],
      last_seen_session_id: session.id,
      confidence: "provisional",
    });
    await dispatchToolCall("chronicle", {
      action: "upsert_hook",
      table_label: "table-a",
      text: "Ask at the ford about the missing hireling",
      thread_id: thread.id,
    });

    const briefRes = await dispatchToolCall("chronicle", { action: "brief", table_label: "table-a" });
    const brief = JSON.parse(briefRes.content[0].text) as {
      llm_used: boolean;
      open_threads: unknown[];
      recent_beats: unknown[];
      ready_hooks: unknown[];
    };
    expect(brief.llm_used).toBe(false);
    expect(brief.open_threads).toHaveLength(1);
    expect(brief.recent_beats).toHaveLength(1);
    expect(brief.ready_hooks).toHaveLength(1);

    const searchRes = await dispatchToolCall("chronicle", {
      action: "search",
      table_label: "table-a",
      query: "ford",
    });
    const search = JSON.parse(searchRes.content[0].text) as { hits: unknown[] };
    expect(search.hits.length).toBeGreaterThan(0);

    const promoted = JSON.parse(
      (
        await dispatchToolCall("chronicle", {
          action: "promote",
          table_label: "table-a",
          ids: [beat.id],
        })
      ).content[0].text
    ) as { promoted: Array<{ id: string }>; skipped: string[] };
    expect(promoted.promoted).toHaveLength(1);
    expect(promoted.skipped).toHaveLength(0);

    const listed = JSON.parse(
      (
        await dispatchToolCall("chronicle", {
          action: "list_beats",
          table_label: "table-a",
        })
      ).content[0].text
    ) as { beats: Array<{ confidence: string }> };
    expect(listed.beats[0].confidence).toBe("confirmed");
  });

  it("extract_candidates stays provisional and promote is required for canon", async () => {
    isolate();
    const started = await dispatchToolCall("session", {
      action: "start",
      table_label: "table-a",
      rules_system: "ogl",
    });
    const session = JSON.parse(started.content[0].text) as { id: string };
    await dispatchToolCall("log_transcript", {
      session_id: session.id,
      speaker: "GM",
      text: "Captain Voss decides to jump to Port Helix after the ambush. The crew found relic loot.",
    });

    const extracted = JSON.parse(
      (
        await dispatchToolCall("chronicle", {
          action: "extract_candidates",
          session_id: session.id,
          write: true,
        })
      ).content[0].text
    ) as {
      beats: Array<{ confidence: string; source: string }>;
      entities: Array<{ confidence: string }>;
      llm_used: boolean;
      written: boolean;
    };
    expect(extracted.written).toBe(true);
    expect(extracted.llm_used).toBe(false);
    expect(extracted.beats.length).toBeGreaterThan(0);
    expect(extracted.beats.every((row) => row.confidence === "provisional")).toBe(true);
    expect(extracted.entities.every((row) => row.confidence === "provisional")).toBe(true);

    const listed = JSON.parse(
      (
        await dispatchToolCall("chronicle", {
          action: "list_beats",
          table_label: "table-a",
        })
      ).content[0].text
    ) as { beats: Array<{ confidence: string; source: string }> };
    expect(listed.beats.every((row) => row.confidence === "provisional")).toBe(true);
    expect(listed.beats.some((row) => row.source !== "manual")).toBe(true);
  });

  it("session end offers candidate beats without writing confirmed rows", async () => {
    isolate();
    const started = await dispatchToolCall("session", {
      action: "start",
      table_label: "table-a",
    });
    const session = JSON.parse(started.content[0].text) as { id: string };
    await dispatchToolCall("log_transcript", {
      session_id: session.id,
      text: "The party travels to the river ford and discovers a secret cache.",
    });
    const ended = JSON.parse(
      (await dispatchToolCall("session", { action: "end", session_id: session.id })).content[0].text
    ) as { chronicle_candidates: { beats: unknown[] } | { skipped: string } };
    expect("beats" in ended.chronicle_candidates).toBe(true);

    const listed = JSON.parse(
      (
        await dispatchToolCall("chronicle", {
          action: "list_beats",
          table_label: "table-a",
        })
      ).content[0].text
    ) as { beats: unknown[] };
    expect(listed.beats).toHaveLength(0);
  });

  it("log_transcript chronicle intent writes a provisional beat", async () => {
    isolate();
    const started = await dispatchToolCall("session", {
      action: "start",
      table_label: "table-a",
    });
    const session = JSON.parse(started.content[0].text) as { id: string };
    const logged = JSON.parse(
      (
        await dispatchToolCall("log_transcript", {
          session_id: session.id,
          text: "They keep the relic.",
          intent: "chronicle",
        })
      ).content[0].text
    ) as { chronicle_beat: { confidence: string } | null };
    expect(logged.chronicle_beat?.confidence).toBe("provisional");
  });

  it("exports markdown to an allowlisted path", async () => {
    isolate();
    process.env.CHRONICLE_EXPORT_ALLOW_PATHS = TMP;
    await dispatchToolCall("session", { action: "start", table_label: "table-a" });
    await dispatchToolCall("chronicle", {
      action: "upsert_thread",
      table_label: "table-a",
      title: "Open thread",
    });
    const exportPath = join(TMP, "brief.md");
    const exported = JSON.parse(
      (
        await dispatchToolCall("chronicle", {
          action: "export",
          table_label: "table-a",
          path: exportPath,
        })
      ).content[0].text
    ) as { path: string; bytes: number };
    expect(exported.path).toBe(exportPath);
    expect(exported.bytes).toBeGreaterThan(10);
    delete process.env.CHRONICLE_EXPORT_ALLOW_PATHS;
  });
});
