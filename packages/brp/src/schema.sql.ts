// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// BRP SCOPE NOTICE:
// The code in this file is AGPL-3.0-only. The database schema and default values
// (e.g. source attribution strings) are designed to store Open Game Content
// governed by the BRP Open Game License v1.0.
//
// This work created using the BRP Open Game License.
// BRP Open Game License v 1.0 (c) copyright 2020 Chaosium Inc.
// Basic Roleplaying (c) copyright 1980-2020 Chaosium Inc.;
// Authors, original rules: Greg Stafford, Steve Henderson, Warren James,
// Steve Perrin, Sandy Petersen, Ray Turney, and Lynn Willis;
// developed by Jason Durall, James Lowder, and Jeff Richard.
// Basic Roleplaying and the BRP logo are trademarks of Chaosium Inc.
// Used with permission.
//
// The database output in data/brp/ is designated as Open Game Content
// under the BRP Open Game License v1.0.

export const BRP_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS brp_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS brp_core_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section TEXT NOT NULL,
  subsection TEXT,
  content TEXT NOT NULL,
  page_hint TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS brp_core_rules_fts USING fts5(
  section,
  subsection,
  content,
  content='brp_core_rules',
  content_rowid='id'
);

CREATE TABLE IF NOT EXISTS brp_characteristics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT NOT NULL,
  dice TEXT NOT NULL,
  description TEXT,
  characteristic_roll TEXT
);

CREATE TABLE IF NOT EXISTS brp_derived_characteristics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  formula TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS brp_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  base_chance TEXT NOT NULL,
  description TEXT,
  specialty_note TEXT
);

CREATE TABLE IF NOT EXISTS brp_professions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  professional_skills TEXT
);

CREATE TABLE IF NOT EXISTS brp_weapons_melee (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  skill TEXT,
  base_chance INTEGER,
  damage TEXT,
  hands TEXT,
  hit_points INTEGER,
  range TEXT
);

CREATE TABLE IF NOT EXISTS brp_weapons_missile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  skill TEXT,
  base_chance INTEGER,
  damage TEXT,
  hands TEXT,
  hit_points INTEGER,
  range TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS brp_armor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  armor_points INTEGER,
  skill_modifier TEXT
);

CREATE TABLE IF NOT EXISTS brp_shields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  base_chance INTEGER,
  skill TEXT,
  hit_points INTEGER,
  damage TEXT
);

CREATE TABLE IF NOT EXISTS brp_spot_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT
);

CREATE TABLE IF NOT EXISTS brp_sample_foes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  characteristics TEXT,
  move INTEGER,
  hit_points INTEGER,
  damage_bonus TEXT,
  armor TEXT,
  skills TEXT,
  attacks TEXT
);
`;
