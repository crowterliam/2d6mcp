/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync } from "node:fs";
import { EmbeddedStore } from "../../packages/spacetime/src/kernel.js";
import { parseExtractedCandidates, stripFences } from "../../packages/spacetime/src/extract.js";
import { stripTrailingSlashes } from "../../packages/spacetime/src/client.js";
import { importLegacySqliteSessions } from "../../packages/server/src/session/migrate-sqlite.js";
import { SESSION_SCHEMA_DDL } from "../../packages/server/src/session/schema.sql.js";

describe("spacetime kernel", () => {
  it("blocks auto-canon on non-manual beats", () => {
    const store = new EmbeddedStore();
    const beat = store.addBeat({
      table_label: "table-a",
      kind: "reveal",
      text: "The ford is watched.",
      source: "from_transcript",
      confidence: "confirmed",
    });
    expect(beat.confidence).toBe("provisional");
    const promoted = store.promote("table-a", [beat.id]);
    expect(promoted.promoted).toHaveLength(1);
    expect(store.listBeats({ table_label: "table-a" })[0]?.confidence).toBe("confirmed");
  });

  it("never auto-confirms extract JSON that asks for confirmed", () => {
    const parsed = parseExtractedCandidates(
      "table-a",
      JSON.stringify({
        beats: [{ kind: "reveal", text: "The vault is empty", confidence: "confirmed" }],
        entities: [{ type: "place", name: "The Vault", confidence: "confirmed" }],
      }),
      "agent",
      "session-1"
    );
    expect(parsed.beats[0]?.confidence).toBe("provisional");
    expect(parsed.entities[0]?.confidence).toBe("provisional");
  });

  it("strips markdown fences without a polynomial regex", () => {
    const inner = '{"beats":[{"kind":"note","text":"A long enough candidate line."}]}';
    expect(stripFences("```json\n" + inner + "\n```")).toBe(inner);
    expect(stripTrailingSlashes("http://127.0.0.1:3000///")).toBe("http://127.0.0.1:3000");
  });

  it("imports a legacy sqlite session file", () => {
    const dir = join(tmpdir(), `2d6mcp-import-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const sqlitePath = join(dir, "sessions.db");
    const sqlite = new Database(sqlitePath);
    for (const stmt of SESSION_SCHEMA_DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
      try {
        sqlite.exec(`${stmt};`);
      } catch {
        // skip alter-if-exists
      }
    }
    sqlite.prepare(
      "INSERT INTO sessions (id, name, rules_system, byod_system, table_label, started_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("session-legacy", "old", "ogl", null, "table-a", Date.now());
    sqlite.prepare(
      "INSERT INTO transcript_segments (session_id, timestamp, speaker, text, source, intent) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("session-legacy", Date.now(), "GM", "Hello table", "manual", null);
    sqlite.close();

    const store = new EmbeddedStore();
    const result = importLegacySqliteSessions(store, sqlitePath);
    expect(result.imported).toBe(true);
    expect(result.sessions).toBe(1);
    expect(result.transcripts).toBe(1);
    expect(store.getSession("session-legacy")?.table_label).toBe("table-a");
    expect(store.getTranscript("session-legacy", 10)[0]?.text).toBe("Hello table");
    rmSync(dir, { recursive: true, force: true });
  });
});
