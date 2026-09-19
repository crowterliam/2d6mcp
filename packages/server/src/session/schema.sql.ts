// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Legacy SQLite DDL kept for `2d6mcp import-sessions` only.
// Runtime session/chronicle state lives in the SpacetimeDB TypeScript kernel.

export const SESSION_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  rules_system TEXT NOT NULL DEFAULT 'ogl',
  byod_system TEXT,
  table_label TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  summary TEXT,
  summary_generated_at INTEGER
);

CREATE TABLE IF NOT EXISTS transcript_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  timestamp INTEGER NOT NULL,
  speaker TEXT,
  text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  intent TEXT
);

CREATE INDEX IF NOT EXISTS idx_transcript_session_ts
  ON transcript_segments(session_id, timestamp);

CREATE TABLE IF NOT EXISTS rulings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  question TEXT NOT NULL,
  ruling_text TEXT NOT NULL,
  sources TEXT,
  model_used TEXT,
  latency_ms INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rulings_session
  ON rulings(session_id, created_at);

CREATE TABLE IF NOT EXISTS transcription_progress (
  file_path TEXT PRIMARY KEY,
  temp_dir TEXT,
  chunk_size_seconds INTEGER NOT NULL DEFAULT 120,
  total_chunks INTEGER NOT NULL,
  processed_chunks TEXT NOT NULL DEFAULT '[]',
  chunk_texts TEXT NOT NULL DEFAULT '{}',
  source_duration_seconds REAL,
  model_used TEXT,
  session_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS live_transcript_cursors (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  source_kind TEXT NOT NULL,
  source_key TEXT NOT NULL,
  meeting_id TEXT,
  last_segment_id TEXT,
  last_start_ms INTEGER,
  last_line_index INTEGER,
  ingested_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, source_kind, source_key)
);

-- Migration: add byod_system column to existing sessions table
ALTER TABLE sessions ADD COLUMN byod_system TEXT;
ALTER TABLE sessions ADD COLUMN table_label TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_table_label ON sessions(table_label);
ALTER TABLE transcription_progress ADD COLUMN chunk_texts TEXT;
`;
