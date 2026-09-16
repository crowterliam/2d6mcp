// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { OSR_SCHEMA_DDL } from "./schema.sql.js";

let osrDb: Database.Database | null = null;
let osrSchemaReady = false;

export function getOsrDatabase(dbPath: string): Database.Database {
  if (osrDb) return osrDb;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  osrDb = new Database(dbPath);
  osrDb.pragma("journal_mode = WAL");
  osrDb.pragma("foreign_keys = ON");

  return osrDb;
}

export function initOsrSchema(db: Database.Database): void {
  const statements = OSR_SCHEMA_DDL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    db.exec(stmt + ";");
  }
}

export function ensureOsrSchema(dbPath: string): Database.Database {
  const database = getOsrDatabase(dbPath);
  if (osrSchemaReady) return database;
  initOsrSchema(database);
  osrSchemaReady = true;
  return database;
}

export function closeOsrDatabase(): void {
  if (osrDb) {
    osrDb.close();
    osrDb = null;
  }
  osrSchemaReady = false;
}
