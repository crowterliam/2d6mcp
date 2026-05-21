// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// DW SCOPE NOTICE:
// The code in this file is AGPL-3.0-only. The database schema and default values
// are designed to store game content derived from Dungeon World by Sage LaTorra
// and Adam Koebel (converted to Markdown by agude), licensed under CC-BY-3.0.
// The database output in data/dw/ is governed by the Creative Commons Attribution
// 3.0 Unported License (see data/dw/CC-BY-3.0.txt).

export const DW_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS dw_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file TEXT NOT NULL,
  section_title TEXT NOT NULL,
  subsection_title TEXT,
  content TEXT NOT NULL,
  category TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS dw_sections_fts USING fts5(
  section_title,
  subsection_title,
  content,
  content='dw_sections',
  content_rowid='id'
);

CREATE TABLE IF NOT EXISTS dw_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  stat TEXT,
  category TEXT NOT NULL,
  on_success TEXT,
  on_partial TEXT,
  on_miss TEXT,
  source_class TEXT
);

CREATE TABLE IF NOT EXISTS dw_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  base_hp INTEGER,
  base_damage TEXT,
  names TEXT,
  look TEXT,
  stats TEXT,
  alignment TEXT,
  bonds TEXT,
  starting_moves TEXT,
  advanced_moves TEXT
);

CREATE TABLE IF NOT EXISTS dw_spells (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  level TEXT NOT NULL,
  spell_class TEXT NOT NULL,
  tags TEXT,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dw_equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT,
  cost TEXT,
  weight TEXT,
  damage TEXT,
  armor INTEGER,
  description TEXT
);

CREATE TABLE IF NOT EXISTS dw_monsters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tags TEXT,
  damage TEXT,
  hp INTEGER,
  armor INTEGER,
  attack_tags TEXT,
  special_qualities TEXT,
  description TEXT,
  instinct TEXT,
  moves TEXT,
  source_setting TEXT
);

CREATE TABLE IF NOT EXISTS dw_gm_tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT
);
`;
