// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// DW SCOPE NOTICE:
// This file manages the SQLite database that stores game content derived from
// Dungeon World by Sage LaTorra and Adam Koebel (converted to Markdown by agude),
// licensed under CC-BY-3.0. The code is AGPL-3.0-only. The database output in
// data/dw/ is governed by the Creative Commons Attribution 3.0 Unported License
// (see data/dw/CC-BY-3.0.txt).

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DW_SCHEMA_DDL } from "./schema.sql.js";

let dwDb: Database.Database | null = null;
let dwSchemaReady = false;

export function getDwDatabase(dbPath: string): Database.Database {
  if (dwDb) return dwDb;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  dwDb = new Database(dbPath);
  dwDb.pragma("journal_mode = WAL");
  dwDb.pragma("foreign_keys = ON");

  return dwDb;
}

export function initDwSchema(db: Database.Database): void {
  const statements = DW_SCHEMA_DDL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    db.exec(stmt + ";");
  }
}

export function seedDwSections(db: Database.Database): void {
  db.exec(`
    INSERT INTO dw_sections (source_file, section_title, subsection_title, content, category)
    SELECT 'moves', category, name, description, 'moves' FROM dw_moves
    UNION ALL
    SELECT 'classes', name, NULL, COALESCE(description, ''), 'classes' FROM dw_classes
    UNION ALL
    SELECT 'spells', spell_class, name, description, 'spells' FROM dw_spells
    UNION ALL
    SELECT 'equipment', category, name, COALESCE(description, ''), 'equipment' FROM dw_equipment
    UNION ALL
    SELECT 'monsters', COALESCE(source_setting, 'monsters'), name, COALESCE(description, ''), 'monsters' FROM dw_monsters
    UNION ALL
    SELECT 'gm_tools', COALESCE(category, 'gm'), topic, content, 'gm_tools' FROM dw_gm_tools;
  `);
  db.exec("INSERT INTO dw_sections_fts(dw_sections_fts) VALUES('rebuild');");
}

/** Backfill dw_sections from structured tables so FTS5 is not empty. */
export function seedDwSectionsIfEmpty(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM dw_sections").get() as { n: number };
  if (count.n > 0) return;
  seedDwSections(db);
}

export function ensureDwSchema(dbPath: string): Database.Database {
  const database = getDwDatabase(dbPath);
  if (dwSchemaReady) return database;
  initDwSchema(database);
  seedDwSectionsIfEmpty(database);
  dwSchemaReady = true;
  return database;
}

export function closeDwDatabase(): void {
  if (dwDb) {
    dwDb.close();
    dwDb = null;
  }
  dwSchemaReady = false;
}
