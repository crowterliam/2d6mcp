// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// BRP SCOPE NOTICE:
// This file manages the SQLite database that stores Open Game Content governed
// by the BRP Open Game License v1.0. The code is AGPL-3.0-only. The database
// output in data/brp/ is designated as Open Game Content under the BRP OGL.
//
// This work created using the BRP Open Game License.
// BRP Open Game License v 1.0 (c) copyright 2020 Chaosium Inc.
// Basic Roleplaying (c) copyright 1980-2020 Chaosium Inc.
// Basic Roleplaying and the BRP logo are trademarks of Chaosium Inc.
// Used with permission.

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { BRP_SCHEMA_DDL } from "./schema.sql.js";

let brpDb: Database.Database | null = null;

export function getBrpDatabase(dbPath: string): Database.Database {
  if (brpDb) return brpDb;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  brpDb = new Database(dbPath);
  brpDb.pragma("journal_mode = WAL");
  brpDb.pragma("foreign_keys = ON");

  return brpDb;
}

export function initBrpSchema(db: Database.Database): void {
  const statements = BRP_SCHEMA_DDL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    db.exec(stmt + ";");
  }
}

export function ensureBrpSchema(dbPath: string): Database.Database {
  const database = getBrpDatabase(dbPath);
  initBrpSchema(database);
  return database;
}

export function closeBrpDatabase(): void {
  if (brpDb) {
    brpDb.close();
    brpDb = null;
  }
}
