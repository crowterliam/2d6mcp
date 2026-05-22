// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// 5E-COMPATIBLE SCOPE NOTICE:
// This file manages the SQLite database that stores Open Game Content from
// the 5.2.1 SRD, governed by CC-BY-4.0. The code is AGPL-3.0-only.
// The database output in data/5ecompatible/ is designated as Open Game Content under CC-BY-4.0.
//
// This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1")
// by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd.
// Licensed under CC-BY-4.0. See data/5ecompatible/SRD-NOTICE.txt for full attribution.

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SR5E_SCHEMA_DDL } from "./schema.sql.js";

let sr5eDb: Database.Database | null = null;

export function get5ecompatibleDatabase(dbPath: string): Database.Database {
  if (sr5eDb) return sr5eDb;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  sr5eDb = new Database(dbPath);
  sr5eDb.pragma("journal_mode = WAL");
  sr5eDb.pragma("foreign_keys = ON");

  return sr5eDb;
}

export function init5ecompatibleSchema(db: Database.Database): void {
  const statements = SR5E_SCHEMA_DDL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    db.exec(stmt + ";");
  }
}

export function ensure5ecompatibleSchema(dbPath: string): Database.Database {
  const database = get5ecompatibleDatabase(dbPath);
  init5ecompatibleSchema(database);
  return database;
}

export function close5ecompatibleDatabase(): void {
  if (sr5eDb) {
    sr5eDb.close();
    sr5eDb = null;
  }
}
