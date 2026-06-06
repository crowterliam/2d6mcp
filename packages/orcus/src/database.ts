// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// OGL SCOPE NOTICE:
// This file manages the SQLite database that stores Open Game Content from
// the Orcus retro-clone rules, governed by OGL v1.0a. The code is AGPL-3.0-only.
// The database output in data/orcus/ is designated as Open Game Content under OGL v1.0a.
//
// Orcus is a retro-clone of 4th Edition by Chris Sakkas (Sanglorian).
// See data/orcus/ATTRIBUTION for full details.

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ORCUS_SCHEMA_DDL } from "./schema.sql.js";

let orcusDb: Database.Database | null = null;

export function getOrcusDatabase(dbPath: string): Database.Database {
  if (orcusDb) return orcusDb;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  orcusDb = new Database(dbPath);
  orcusDb.pragma("journal_mode = WAL");
  orcusDb.pragma("foreign_keys = ON");

  return orcusDb;
}

export function initOrcusSchema(db: Database.Database): void {
  const statements = ORCUS_SCHEMA_DDL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    db.exec(stmt + ";");
  }
}

export function ensureOrcusSchema(dbPath: string): Database.Database {
  const database = getOrcusDatabase(dbPath);
  initOrcusSchema(database);
  return database;
}

export function closeOrcusDatabase(): void {
  if (orcusDb) {
    orcusDb.close();
    orcusDb = null;
  }
}
