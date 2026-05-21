// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SESSION_SCHEMA_DDL } from "./schema.sql.js";

let db: Database.Database | null = null;

export function openSessionDb(dbPath: string): Database.Database {
  if (db) return db;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const statements = SESSION_SCHEMA_DDL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    try {
      db.exec(stmt + ";");
    } catch {
      // Skip migration errors (e.g., column already exists)
    }
  }

  return db;
}

export function closeSessionDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export interface SessionRow {
  id: string;
  name: string | null;
  rules_system: string;
  byod_system: string | null;
  started_at: number;
  ended_at: number | null;
  summary: string | null;
  summary_generated_at: number | null;
}

export function createSession(
  database: Database.Database,
  rulesSystem: string = "ogl",
  name?: string,
  byodSystem?: string
): SessionRow {
  const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();

  database
    .prepare(
      "INSERT INTO sessions (id, name, rules_system, byod_system, started_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, name ?? null, rulesSystem, byodSystem ?? null, now);

  return {
    id,
    name: name ?? null,
    rules_system: rulesSystem,
    byod_system: byodSystem ?? null,
    started_at: now,
    ended_at: null,
    summary: null,
    summary_generated_at: null,
  };
}

export function endSession(
  database: Database.Database,
  sessionId: string
): SessionRow | null {
  const now = Date.now();
  const result = database
    .prepare("UPDATE sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL")
    .run(now, sessionId);

  if (result.changes === 0) return null;

  return database
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as SessionRow;
}

export function setSessionSummary(
  database: Database.Database,
  sessionId: string,
  summary: string
): boolean {
  const now = Date.now();
  const result = database
    .prepare(
      "UPDATE sessions SET summary = ?, summary_generated_at = ? WHERE id = ?"
    )
    .run(summary, now, sessionId);

  return result.changes > 0;
}

export function getSession(
  database: Database.Database,
  sessionId: string
): SessionRow | null {
  return (database
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as SessionRow) ?? null;
}

export function listSessions(
  database: Database.Database,
  limit: number = 20
): SessionRow[] {
  return database
    .prepare(
      "SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?"
    )
    .all(limit) as SessionRow[];
}

export interface TranscriptSegment {
  id: number;
  session_id: string;
  timestamp: number;
  speaker: string | null;
  text: string;
  source: string;
  intent: string | null;
}

export function logTranscript(
  database: Database.Database,
  sessionId: string,
  text: string,
  speaker?: string,
  source: string = "manual",
  intent?: string
): TranscriptSegment {
  const now = Date.now();
  const result = database
    .prepare(
      `INSERT INTO transcript_segments (session_id, timestamp, speaker, text, source, intent)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(sessionId, now, speaker ?? null, text, source, intent ?? null);

  return {
    id: result.lastInsertRowid as number,
    session_id: sessionId,
    timestamp: now,
    speaker: speaker ?? null,
    text,
    source,
    intent: intent ?? null,
  };
}

export function getTranscript(
  database: Database.Database,
  sessionId: string,
  limit: number = 50
): TranscriptSegment[] {
  return database
    .prepare(
      "SELECT * FROM transcript_segments WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?"
    )
    .all(sessionId, limit) as TranscriptSegment[];
}

export function getRecentTranscript(
  database: Database.Database,
  sessionId: string,
  minutes: number = 5
): TranscriptSegment[] {
  const cutoff = Date.now() - minutes * 60 * 1000;
  return database
    .prepare(
      "SELECT * FROM transcript_segments WHERE session_id = ? AND timestamp >= ? ORDER BY timestamp DESC"
    )
    .all(sessionId, cutoff) as TranscriptSegment[];
}

export function searchTranscript(
  database: Database.Database,
  sessionId: string,
  query: string
): TranscriptSegment[] {
  return database
    .prepare(
      "SELECT * FROM transcript_segments WHERE session_id = ? AND text LIKE ? ORDER BY timestamp DESC LIMIT 30"
    )
    .all(sessionId, `%${query}%`) as TranscriptSegment[];
}

export interface RulingRow {
  id: number;
  session_id: string;
  question: string;
  ruling_text: string;
  sources: string | null;
  model_used: string | null;
  latency_ms: number | null;
  created_at: number;
}

export function storeRuling(
  database: Database.Database,
  sessionId: string,
  question: string,
  rulingText: string,
  sources?: string[],
  modelUsed?: string,
  latencyMs?: number
): RulingRow {
  const now = Date.now();
  const result = database
    .prepare(
      `INSERT INTO rulings (session_id, question, ruling_text, sources, model_used, latency_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sessionId,
      question,
      rulingText,
      sources ? JSON.stringify(sources) : null,
      modelUsed ?? null,
      latencyMs ?? null,
      now
    );

  return {
    id: result.lastInsertRowid as number,
    session_id: sessionId,
    question,
    ruling_text: rulingText,
    sources: sources ? JSON.stringify(sources) : null,
    model_used: modelUsed ?? null,
    latency_ms: latencyMs ?? null,
    created_at: now,
  };
}

export function getRecentRulings(
  database: Database.Database,
  sessionId: string,
  limit: number = 5
): RulingRow[] {
  return database
    .prepare(
      "SELECT * FROM rulings WHERE session_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(sessionId, limit) as RulingRow[];
}

export function getRecentContext(
  database: Database.Database,
  sessionId: string,
  minutes: number = 5
): { transcripts: TranscriptSegment[]; rulings: RulingRow[] } {
  const transcripts = getRecentTranscript(database, sessionId, minutes);
  const rulings = getRecentRulings(database, sessionId, 5);

  return { transcripts, rulings };
}

// ---- Transcription progress tracking ----

export interface TranscriptionProgress {
  file_path: string;
  temp_dir: string | null;
  chunk_size_seconds: number;
  total_chunks: number;
  processed_chunks: number[];
  source_duration_seconds: number | null;
  model_used: string | null;
  session_id: string | null;
  created_at: number;
  updated_at: number;
}

export function getOrCreateProgress(
  database: Database.Database,
  filePath: string
): TranscriptionProgress {
  const existing = database
    .prepare("SELECT * FROM transcription_progress WHERE file_path = ?")
    .get(filePath) as TranscriptionProgress | undefined;

  if (existing) {
    existing.processed_chunks = JSON.parse(existing.processed_chunks as unknown as string);
    return existing;
  }

  const now = Date.now();
  database
    .prepare(
      `INSERT INTO transcription_progress
       (file_path, chunk_size_seconds, total_chunks, processed_chunks, created_at, updated_at)
       VALUES (?, ?, ?, '[]', ?, ?)`
    )
    .run(filePath, 120, 0, now, now);

  return {
    file_path: filePath,
    temp_dir: null,
    chunk_size_seconds: 120,
    total_chunks: 0,
    processed_chunks: [],
    source_duration_seconds: null,
    model_used: null,
    session_id: null,
    created_at: now,
    updated_at: now,
  };
}

export function updateProgress(
  database: Database.Database,
  filePath: string,
  updates: Partial<{
    temp_dir: string;
    total_chunks: number;
    chunk_size_seconds: number;
    source_duration_seconds: number;
    model_used: string;
    session_id: string;
  }>
): void {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (sets.length === 0) return;

  sets.push("updated_at = ?");
  values.push(Date.now());
  values.push(filePath);

  database
    .prepare(
      `UPDATE transcription_progress SET ${sets.join(", ")} WHERE file_path = ?`
    )
    .run(...values);
}

export function markChunkProcessed(
  database: Database.Database,
  filePath: string,
  chunkIndex: number
): void {
  const progress = getOrCreateProgress(database, filePath);
  const processed = new Set(progress.processed_chunks);
  processed.add(chunkIndex);

  const now = Date.now();
  database
    .prepare(
      "UPDATE transcription_progress SET processed_chunks = ?, updated_at = ? WHERE file_path = ?"
    )
    .run(JSON.stringify([...processed]), now, filePath);
}

export function getNextUnprocessedChunk(
  database: Database.Database,
  filePath: string
): number | null {
  const progress = getOrCreateProgress(database, filePath);

  for (let i = 0; i < progress.total_chunks; i++) {
    if (!progress.processed_chunks.includes(i)) {
      return i;
    }
  }

  return null; // All done
}

export function deleteProgress(
  database: Database.Database,
  filePath: string
): void {
  database
    .prepare("DELETE FROM transcription_progress WHERE file_path = ?")
    .run(filePath);
}

export function deleteAllProgress(database: Database.Database): number {
  const result = database
    .prepare("DELETE FROM transcription_progress")
    .run();
  return result.changes;
}

export function listAllProgress(database: Database.Database): TranscriptionProgress[] {
  const rows = database
    .prepare("SELECT * FROM transcription_progress ORDER BY updated_at DESC")
    .all() as Array<Omit<TranscriptionProgress, "processed_chunks"> & { processed_chunks: string }>;

  return rows.map((r) => ({
    ...r,
    processed_chunks: JSON.parse(r.processed_chunks),
  }));
}

export function deleteSession(
  database: Database.Database,
  sessionId: string
): { transcriptSegments: number; rulings: number } {
  const transcriptResult = database
    .prepare("DELETE FROM transcript_segments WHERE session_id = ?")
    .run(sessionId);

  const rulingsResult = database
    .prepare("DELETE FROM rulings WHERE session_id = ?")
    .run(sessionId);

  database.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);

  return {
    transcriptSegments: transcriptResult.changes,
    rulings: rulingsResult.changes,
  };
}
