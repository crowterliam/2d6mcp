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

export function ensureDwSchema(dbPath: string): Database.Database {
  const database = getDwDatabase(dbPath);
  initDwSchema(database);
  return database;
}

export function closeDwDatabase(): void {
  if (dwDb) {
    dwDb.close();
    dwDb = null;
  }
}
