/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { dispatchToolCall } from "../../packages/server/src/tools/index.js";
import { closeSessionDb, getTranscript, openSessionDb } from "../../packages/server/src/session/database.js";
import { loadConfig } from "../../packages/server/src/config.js";
import { formatSpeaker } from "../../packages/server/src/live-transcript/sources.js";

const TMP = join(tmpdir(), `2d6mcp-live-transcript-${Date.now()}`);
const originalEnv = { ...process.env };

function writeCompanionSqlite(
  dbPath: string,
  meetings: Array<{ id: string; title: string; started_at: string }>,
  segments: Array<{
    id: string;
    meeting_id: string;
    start_ms: number;
    end_ms: number;
    speaker: number;
    text: string;
  }>
): void {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      started_at TEXT NOT NULL,
      duration_s INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE segments (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id),
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      speaker INTEGER NOT NULL,
      text TEXT NOT NULL
    );
  `);
  const insertMeeting = db.prepare(
    "INSERT INTO meetings (id, title, started_at, duration_s) VALUES (?, ?, ?, 0)"
  );
  for (const meeting of meetings) {
    insertMeeting.run(meeting.id, meeting.title, meeting.started_at);
  }
  const insertSeg = db.prepare(
    "INSERT INTO segments (id, meeting_id, start_ms, end_ms, speaker, text) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const segment of segments) {
    insertSeg.run(
      segment.id,
      segment.meeting_id,
      segment.start_ms,
      segment.end_ms,
      segment.speaker,
      segment.text
    );
  }
  db.close();
}

async function startSession(name: string): Promise<string> {
  const started = await dispatchToolCall("session", { action: "start", name, rules_system: "ogl" });
  expect(started.isError).toBeUndefined();
  return (JSON.parse(started.content[0].text) as { id: string }).id;
}

describe("ingest_live_transcript", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    mkdirSync(TMP, { recursive: true });
    process.env.SESSION_DB_PATH = join(TMP, "sessions.db");
    process.env.LIVE_TRANSCRIPT_ALLOW_PATHS = TMP;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    closeSessionDb();
    process.env = { ...originalEnv };
    rmSync(TMP, { recursive: true, force: true });
  });

  it("maps integer speakers to Speaker N labels", () => {
    expect(formatSpeaker(0)).toBe("Speaker 0");
    expect(formatSpeaker(2)).toBe("Speaker 2");
    expect(formatSpeaker("GM")).toBe("GM");
  });

  it("ingests companion SQLite segments incrementally without duplicates", async () => {
    const dbPath = join(TMP, "companion.db");
    writeCompanionSqlite(
      dbPath,
      [
        { id: "meet-old", title: "Earlier", started_at: "2026-09-19T08:00:00" },
        { id: "meet-live", title: "Table", started_at: "2026-09-19T09:00:00" },
      ],
      [
        {
          id: "seg-1",
          meeting_id: "meet-live",
          start_ms: 1000,
          end_ms: 2000,
          speaker: 0,
          text: "I search the hatch.",
        },
        {
          id: "seg-2",
          meeting_id: "meet-live",
          start_ms: 2500,
          end_ms: 4000,
          speaker: 1,
          text: "Roll me a check.",
        },
        {
          id: "seg-3",
          meeting_id: "meet-live",
          start_ms: 5000,
          end_ms: 7000,
          speaker: 0,
          text: "The lock yields.",
        },
        {
          id: "seg-old",
          meeting_id: "meet-old",
          start_ms: 0,
          end_ms: 100,
          speaker: 0,
          text: "Should not ingest from an older meeting.",
        },
      ]
    );

    const sessionId = await startSession("sqlite ingest");
    const first = JSON.parse(
      (
        await dispatchToolCall("ingest_live_transcript", {
          action: "poll",
          session_id: sessionId,
          source: "companion_sqlite",
          path: dbPath,
          limit: 2,
        })
      ).content[0].text
    ) as {
      ingested: number;
      complete: boolean;
      remaining: number;
      meeting_id: string;
      segments: Array<{ speaker: string; text: string; source_segment_id: string }>;
    };

    expect(first.meeting_id).toBe("meet-live");
    expect(first.ingested).toBe(2);
    expect(first.complete).toBe(false);
    expect(first.remaining).toBe(1);
    expect(first.segments.map((s) => s.source_segment_id)).toEqual(["seg-1", "seg-2"]);
    expect(first.segments[0].speaker).toBe("Speaker 0");
    expect(first.segments[1].speaker).toBe("Speaker 1");

    const second = JSON.parse(
      (
        await dispatchToolCall("ingest_live_transcript", {
          action: "ingest",
          session_id: sessionId,
          source: "companion_sqlite",
          path: dbPath,
        })
      ).content[0].text
    ) as { ingested: number; complete: boolean; remaining: number };

    expect(second.ingested).toBe(1);
    expect(second.complete).toBe(true);
    expect(second.remaining).toBe(0);

    const third = JSON.parse(
      (
        await dispatchToolCall("ingest_live_transcript", {
          session_id: sessionId,
          source: "companion_sqlite",
          path: dbPath,
        })
      ).content[0].text
    ) as { ingested: number; complete: boolean };

    expect(third.ingested).toBe(0);
    expect(third.complete).toBe(true);

    const db = openSessionDb(loadConfig().sessionDbPath);
    const rows = getTranscript(db, sessionId, 50);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.text).sort()).toEqual([
      "I search the hatch.",
      "Roll me a check.",
      "The lock yields.",
    ]);
    expect(new Set(rows.map((r) => r.source))).toEqual(new Set(["voice"]));
    expect(new Set(rows.map((r) => r.intent))).toEqual(new Set(["narration"]));
  });

  it("pins the latest meeting across later companion rows", async () => {
    const dbPath = join(TMP, "pin.db");
    writeCompanionSqlite(
      dbPath,
      [{ id: "meet-a", title: "First", started_at: "2026-09-19T10:00:00" }],
      [
        {
          id: "a-1",
          meeting_id: "meet-a",
          start_ms: 10,
          end_ms: 20,
          speaker: 0,
          text: "Opening beat.",
        },
      ]
    );
    const sessionId = await startSession("pin meeting");
    await dispatchToolCall("ingest_live_transcript", {
      session_id: sessionId,
      source: "companion_sqlite",
      path: dbPath,
    });

    const db = new Database(dbPath);
    db.prepare("INSERT INTO meetings (id, title, started_at, duration_s) VALUES (?, ?, ?, 0)").run(
      "meet-b",
      "Newer",
      "2026-09-19T11:00:00"
    );
    db.prepare(
      "INSERT INTO segments (id, meeting_id, start_ms, end_ms, speaker, text) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("b-1", "meet-b", 0, 5, 0, "From a newer meeting");
    db.prepare(
      "INSERT INTO segments (id, meeting_id, start_ms, end_ms, speaker, text) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("a-2", "meet-a", 30, 40, 1, "Follow-up on the pinned meeting");
    db.close();

    const follow = JSON.parse(
      (
        await dispatchToolCall("ingest_live_transcript", {
          session_id: sessionId,
          source: "companion_sqlite",
          path: dbPath,
        })
      ).content[0].text
    ) as { ingested: number; meeting_id: string; segments: Array<{ text: string }> };

    expect(follow.meeting_id).toBe("meet-a");
    expect(follow.ingested).toBe(1);
    expect(follow.segments[0].text).toBe("Follow-up on the pinned meeting");
  });

  it("ingests NDJSON incrementally and reset_cursor replays", async () => {
    const ndjsonPath = join(TMP, "live.ndjson");
    writeFileSync(
      ndjsonPath,
      [
        JSON.stringify({ id: "n1", start_ms: 0, end_ms: 500, speaker: 0, text: "Line one" }),
        JSON.stringify({ id: "n2", start_ms: 600, speaker: "GM", text: "Line two" }),
        JSON.stringify({ start_ms: 900, speaker: 1, text: "Line three" }),
      ].join("\n"),
      "utf8"
    );

    const sessionId = await startSession("ndjson ingest");
    const first = JSON.parse(
      (
        await dispatchToolCall("ingest_live_transcript", {
          action: "poll",
          session_id: sessionId,
          source: "ndjson_file",
          path: ndjsonPath,
          limit: 2,
        })
      ).content[0].text
    ) as { ingested: number; remaining: number; complete: boolean };

    expect(first.ingested).toBe(2);
    expect(first.remaining).toBe(1);
    expect(first.complete).toBe(false);

    const second = JSON.parse(
      (
        await dispatchToolCall("ingest_live_transcript", {
          session_id: sessionId,
          path: ndjsonPath,
        })
      ).content[0].text
    ) as { ingested: number; complete: boolean; source: string };

    expect(second.source).toBe("ndjson_file");
    expect(second.ingested).toBe(1);
    expect(second.complete).toBe(true);

    const again = JSON.parse(
      (
        await dispatchToolCall("ingest_live_transcript", {
          session_id: sessionId,
          path: ndjsonPath,
        })
      ).content[0].text
    ) as { ingested: number };

    expect(again.ingested).toBe(0);

    const status = JSON.parse(
      (
        await dispatchToolCall("ingest_live_transcript", {
          action: "status",
          session_id: sessionId,
          path: ndjsonPath,
        })
      ).content[0].text
    ) as { cursor: { ingested_count: number } | null };

    expect(status.cursor?.ingested_count).toBe(3);

    await dispatchToolCall("ingest_live_transcript", {
      action: "reset_cursor",
      session_id: sessionId,
      path: ndjsonPath,
    });

    const replay = JSON.parse(
      (
        await dispatchToolCall("ingest_live_transcript", {
          session_id: sessionId,
          path: ndjsonPath,
        })
      ).content[0].text
    ) as { ingested: number };

    expect(replay.ingested).toBe(3);
  });

  it("reads a watch_dir of NDJSON files", async () => {
    const dir = join(TMP, "watch");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "a.ndjson"),
      JSON.stringify({ id: "w1", start_ms: 1, speaker: 0, text: "First file" }) + "\n",
      "utf8"
    );
    writeFileSync(
      join(dir, "b.jsonl"),
      JSON.stringify({ id: "w2", start_ms: 2, speaker: 1, text: "Second file" }) + "\n",
      "utf8"
    );

    const sessionId = await startSession("watch dir");
    const result = JSON.parse(
      (
        await dispatchToolCall("ingest_live_transcript", {
          session_id: sessionId,
          source: "watch_dir",
          path: dir,
        })
      ).content[0].text
    ) as { ingested: number; source: string; segments: Array<{ text: string }> };

    expect(result.source).toBe("watch_dir");
    expect(result.ingested).toBe(2);
    expect(result.segments.map((s) => s.text)).toEqual(["First file", "Second file"]);
  });

  it("rejects paths outside the allowlist", async () => {
    const sessionId = await startSession("deny path");
    const outside = join(tmpdir(), `2d6mcp-live-outside-${Date.now()}.ndjson`);
    writeFileSync(outside, JSON.stringify({ start_ms: 0, text: "secret" }) + "\n", "utf8");

    const denied = await dispatchToolCall("ingest_live_transcript", {
      session_id: sessionId,
      source: "ndjson_file",
      path: outside,
    });
    expect(denied.isError).toBe(true);
    expect(denied.content[0].text).toMatch(/Access denied/);

    rmSync(outside, { force: true });
  });

  it("does not follow a symlink that escapes the allowlist", async () => {
    const sessionId = await startSession("symlink escape");
    const outside = join(tmpdir(), `2d6mcp-live-secret-${Date.now()}.ndjson`);
    writeFileSync(outside, JSON.stringify({ start_ms: 0, text: "escaped" }) + "\n", "utf8");
    const link = join(TMP, "escape.ndjson");
    symlinkSync(outside, link);

    const denied = await dispatchToolCall("ingest_live_transcript", {
      session_id: sessionId,
      source: "ndjson_file",
      path: link,
    });
    expect(denied.isError).toBe(true);
    expect(denied.content[0].text).toMatch(/Access denied/);

    rmSync(outside, { force: true });
  });

  it("allows LIVE_TRANSCRIPT_DB as an allowlisted sqlite path", async () => {
    const nested = join(TMP, "companion", "library");
    mkdirSync(nested, { recursive: true });
    const dbPath = join(nested, "companion.db");
    writeCompanionSqlite(
      dbPath,
      [{ id: "m1", title: "Env", started_at: "2026-09-19T12:00:00" }],
      [
        {
          id: "e1",
          meeting_id: "m1",
          start_ms: 0,
          end_ms: 10,
          speaker: 0,
          text: "From LIVE_TRANSCRIPT_DB",
        },
      ]
    );

    delete process.env.LIVE_TRANSCRIPT_ALLOW_PATHS;
    process.env.LIVE_TRANSCRIPT_DB = dbPath;

    const sessionId = await startSession("env db");
    const result = JSON.parse(
      (
        await dispatchToolCall("ingest_live_transcript", {
          session_id: sessionId,
          source: "companion_sqlite",
        })
      ).content[0].text
    ) as { ingested: number; source_path: string };

    expect(result.ingested).toBe(1);
    expect(result.source_path).toBe(dbPath);
    expect(loadConfig().liveTranscriptDb).toBe(dbPath);
  });
});
