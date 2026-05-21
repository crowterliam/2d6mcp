// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

export const SESSION_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  rules_system TEXT NOT NULL DEFAULT 'ogl',
  byod_system TEXT,
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
  source_duration_seconds REAL,
  model_used TEXT,
  session_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Migration: add byod_system column to existing sessions table
ALTER TABLE sessions ADD COLUMN byod_system TEXT;
`;
