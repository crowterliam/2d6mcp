// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// OGL SCOPE NOTICE:
// This file manages the SQLite database that stores Open Game Content. The code
// is AGPL-3.0-only. The database it manages is governed by the Open Game License
// v1.0a and its output in data/ogl/ is designated as Open Game Content.

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_DDL } from "./schema.sql.js";

let db: Database.Database | null = null;

export function getDatabase(dbPath: string): Database.Database {
  if (db) return db;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}

export function initSchema(db: Database.Database): void {
  const statements = SCHEMA_DDL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    db.exec(stmt + ";");
  }
}

export function ensureSchema(dbPath: string): Database.Database {
  const database = getDatabase(dbPath);
  initSchema(database);
  return database;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
