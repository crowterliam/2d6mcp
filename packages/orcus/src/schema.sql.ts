// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// OGL SCOPE NOTICE:
// The code in this file is AGPL-3.0-only. The database schema and default values
// are designed to store Open Game Content from the Orcus retro-clone rules,
// governed by the Open Game License v1.0a.
//
// Orcus is a retro-clone of 4th Edition by Chris Sakkas (Sanglorian).
// See data/orcus/ATTRIBUTION for full details.
//
// The database output in data/orcus/ is designated as Open Game Content under OGL v1.0a.

export const ORCUS_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS orcus_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section TEXT NOT NULL,
  topic TEXT,
  content TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS orcus_sections_fts USING fts5(
  section,
  topic,
  content,
  content='orcus_sections',
  content_rowid='id'
);

CREATE TABLE IF NOT EXISTS orcus_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tradition TEXT,
  role TEXT,
  key_ability TEXT,
  hit_points TEXT,
  recoveries TEXT,
  defenses TEXT,
  armor_proficiencies TEXT,
  weapon_proficiencies TEXT,
  trained_skills TEXT,
  talents TEXT,
  features TEXT,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orcus_monsters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  level_info TEXT,
  size TEXT,
  origin_type TEXT,
  alignment TEXT,
  senses TEXT,
  speed TEXT,
  ac INTEGER,
  fort INTEGER,
  ref INTEGER,
  will INTEGER,
  hp TEXT,
  staggered TEXT,
  resistances TEXT,
  vulnerabilities TEXT,
  immunities TEXT,
  traits TEXT,
  actions TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS orcus_feats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  prerequisite TEXT,
  category TEXT,
  description TEXT NOT NULL
);
`;
