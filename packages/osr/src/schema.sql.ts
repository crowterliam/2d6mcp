// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// The bundled rows are original mechanical summaries authored for 2d6mcp.
// They are not copied from any commercial old-school rulebook. Full
// commercial book text must be indexed locally via BYOD — never vendored here.

export const OSR_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS osr_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS osr_core_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section TEXT NOT NULL,
  subsection TEXT,
  content TEXT NOT NULL,
  page_hint TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS osr_core_rules_fts USING fts5(
  section,
  subsection,
  content,
  content='osr_core_rules',
  content_rowid='id'
);

CREATE TABLE IF NOT EXISTS osr_procedures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS osr_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  dice_type TEXT NOT NULL DEFAULT '2d6',
  min_roll INTEGER NOT NULL,
  max_roll INTEGER NOT NULL,
  result TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_osr_tables_name ON osr_tables(name);
CREATE INDEX IF NOT EXISTS idx_osr_procedures_category ON osr_procedures(category);
`;
