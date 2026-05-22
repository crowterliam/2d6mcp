// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// 5E-COMPATIBLE SCOPE NOTICE:
// The code in this file is AGPL-3.0-only. The database schema and default values
// are designed to store Open Game Content from the 5.2.1 SRD, governed by
// the Creative Commons Attribution 4.0 International License (CC-BY-4.0).
//
// This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1")
// by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd.
// Licensed under CC-BY-4.0. See data/5ecompatible/SRD-NOTICE.txt for full attribution.
//
// The database output in data/5ecompatible/ is designated as Open Game Content under CC-BY-4.0.

export const SR5E_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS sr5e_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section TEXT NOT NULL,
  topic TEXT,
  content TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS sr5e_sections_fts USING fts5(
  section,
  topic,
  content,
  content='sr5e_sections',
  content_rowid='id'
);

CREATE TABLE IF NOT EXISTS sr5e_spells (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  school TEXT NOT NULL,
  casting_time TEXT,
  range TEXT,
  components TEXT,
  duration TEXT,
  classes TEXT,
  description TEXT NOT NULL,
  higher_level TEXT
);

CREATE TABLE IF NOT EXISTS sr5e_monsters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  size TEXT,
  type TEXT,
  alignment TEXT,
  ac INTEGER,
  hp TEXT,
  speed TEXT,
  strength INTEGER,
  dexterity INTEGER,
  constitution INTEGER,
  intelligence INTEGER,
  wisdom INTEGER,
  charisma INTEGER,
  skills TEXT,
  senses TEXT,
  languages TEXT,
  challenge_rating TEXT,
  traits TEXT,
  actions TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS sr5e_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hit_die TEXT,
  primary_ability TEXT,
  saving_throws TEXT,
  skill_proficiencies TEXT,
  armor_training TEXT,
  weapon_proficiencies TEXT,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sr5e_feats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  prerequisite TEXT,
  description TEXT NOT NULL
);
`;
