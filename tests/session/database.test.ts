/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync, existsSync, unlinkSync } from "node:fs";
import {
  openSessionDb,
  createSession,
  endSession,
  setSessionSummary,
  getSession,
  listSessions,
  logTranscript,
  getTranscript,
  getRecentTranscript,
  searchTranscript,
  getRecentContext,
  storeRuling,
  getRecentRulings,
  closeSessionDb,
} from "../../packages/server/src/session/database.js";

const TMP = join(tmpdir(), `2d6mcp-test-session-${Date.now()}`);
const DB_PATH = join(TMP, "test-sessions.db");

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
  if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
});

afterEach(() => {
  closeSessionDb();
  rmSync(TMP, { recursive: true, force: true });
});

describe("session database", () => {
  it("creates and retrieves a session", () => {
    const db = openSessionDb(DB_PATH);
    const session = createSession(db, "ogl", "Test Session");
    expect(session.id).toMatch(/^session-/);
    expect(session.rules_system).toBe("ogl");
    expect(session.name).toBe("Test Session");
    expect(session.started_at).toBeGreaterThan(0);
    expect(session.ended_at).toBeNull();

    const retrieved = getSession(db, session.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe("Test Session");
  });

  it("creates a session with default name", () => {
    const db = openSessionDb(DB_PATH);
    const session = createSession(db, "dw");
    expect(session.name).toBeNull();
    expect(session.rules_system).toBe("dw");
  });

  it("ends a session", () => {
    const db = openSessionDb(DB_PATH);
    const session = createSession(db);
    const ended = endSession(db, session.id);
    expect(ended).not.toBeNull();
    expect(ended!.ended_at).toBeGreaterThan(0);
  });

  it("cannot end an already ended session", () => {
    const db = openSessionDb(DB_PATH);
    const session = createSession(db);
    endSession(db, session.id);
    const result = endSession(db, session.id);
    expect(result).toBeNull();
  });

  it("sets session summary", () => {
    const db = openSessionDb(DB_PATH);
    const session = createSession(db);
    const ok = setSessionSummary(db, session.id, "Great session.");
    expect(ok).toBe(true);

    const retrieved = getSession(db, session.id);
    expect(retrieved!.summary).toBe("Great session.");
    expect(retrieved!.summary_generated_at).toBeGreaterThan(0);
  });

  it("lists sessions", async () => {
    const db = openSessionDb(DB_PATH);
    createSession(db, "ogl", "First");
    // Ensure distinct timestamps for deterministic ordering
    await new Promise((r) => setTimeout(r, 5));
    const s2 = createSession(db, "dw", "Second");

    const sessions = listSessions(db, 10);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe(s2.id);
  });

  it("logs and retrieves transcript segments", () => {
    const db = openSessionDb(DB_PATH);
    const session = createSession(db);
    logTranscript(db, session.id, "The goblin attacks!", "Player 1", "voice", "action");
    logTranscript(db, session.id, "Roll 2d6+Str", "GM", "voice", "ruling");

    const segments = getTranscript(db, session.id, 10);
    expect(segments).toHaveLength(2);
    expect(segments[0].text).toBe("Roll 2d6+Str");
    expect(segments[0].speaker).toBe("GM");
    expect(segments[0].source).toBe("voice");
    expect(segments[0].intent).toBe("ruling");
  });

  it("gets recent transcript within time window", () => {
    const db = openSessionDb(DB_PATH);
    const session = createSession(db);
    logTranscript(db, session.id, "Old message");
    logTranscript(db, session.id, "Recent message");

    const recent = getRecentTranscript(db, session.id, 60);
    expect(recent).toHaveLength(2);
  });

  it("searches transcript", () => {
    const db = openSessionDb(DB_PATH);
    const session = createSession(db);
    logTranscript(db, session.id, "The merchant has a key");
    logTranscript(db, session.id, "Roll for perception");

    const results = searchTranscript(db, session.id, "key");
    expect(results).toHaveLength(1);
    expect(results[0].text).toContain("key");
  });

  it("stores and retrieves rulings", () => {
    const db = openSessionDb(DB_PATH);
    const session = createSession(db);
    storeRuling(db, session.id, "Can I grapple prone?", "Yes, with -2 DM.", ["OGL Combat Rules"], "llama-3.2-3b", 1500);

    const rulings = getRecentRulings(db, session.id, 5);
    expect(rulings).toHaveLength(1);
    expect(rulings[0].question).toContain("grapple");
    expect(rulings[0].ruling_text).toContain("-2 DM");
    expect(rulings[0].sources).toContain("OGL Combat Rules");
    expect(rulings[0].model_used).toBe("llama-3.2-3b");
    expect(rulings[0].latency_ms).toBe(1500);
  });

  it("getRecentContext returns both transcripts and rulings", () => {
    const db = openSessionDb(DB_PATH);
    const session = createSession(db);
    logTranscript(db, session.id, "What's the range?", "Player 2");
    storeRuling(db, session.id, "Range of laser rifle", "250 meters", ["OGL Equipment"]);

    const context = getRecentContext(db, session.id, 5);
    expect(context.transcripts).toHaveLength(1);
    expect(context.rulings).toHaveLength(1);
  });

  it("session IDs are unique", () => {
    const db = openSessionDb(DB_PATH);
    const s1 = createSession(db);
    const s2 = createSession(db);
    expect(s1.id).not.toBe(s2.id);
  });
});
