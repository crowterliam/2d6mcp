export const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS rules_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS rules_text (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'Cepheus Engine SRD',
  FOREIGN KEY (category_id) REFERENCES rules_categories(id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS rules_fts USING fts5(
  title,
  content,
  source,
  content='rules_text',
  content_rowid='id'
);

CREATE TABLE IF NOT EXISTS tables_2d6 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  dice_type TEXT NOT NULL DEFAULT '2d6',
  min_roll INTEGER NOT NULL,
  max_roll INTEGER NOT NULL,
  result TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tables_name ON tables_2d6(name);

CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  characteristic TEXT,
  specializations TEXT
);

CREATE TABLE IF NOT EXISTS careers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  qualification TEXT,
  survival TEXT,
  advancement TEXT,
  ranks TEXT,
  mustering_out TEXT,
  skills_and_training TEXT
);

CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  tech_level INTEGER,
  cost TEXT,
  weight TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS combat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT
);

CREATE TABLE IF NOT EXISTS starship_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT
);

CREATE TABLE IF NOT EXISTS world_building (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT
);

CREATE TABLE IF NOT EXISTS core_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section TEXT NOT NULL,
  subsection TEXT,
  content TEXT NOT NULL,
  page_hint TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS core_rules_fts USING fts5(
  section,
  subsection,
  content,
  content='core_rules',
  content_rowid='id'
);
`;
