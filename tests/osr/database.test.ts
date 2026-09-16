/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getOsrDatabase, initOsrSchema, ensureOsrSchema, closeOsrDatabase } from "@2d6mcp/osr/database";

const TMP = join(tmpdir(), `2d6mcp-test-osr-${Date.now()}`);
const DB_PATH = join(TMP, "test-osr.db");

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
});

afterAll(() => {
  closeOsrDatabase();
  rmSync(TMP, { recursive: true, force: true });
});

describe("OSR database", () => {
  it("creates database file", () => {
    const db = getOsrDatabase(DB_PATH);
    expect(db).toBeDefined();
    expect(existsSync(DB_PATH)).toBe(true);
  });

  it("initializes schema without error", () => {
    const db = getOsrDatabase(DB_PATH);
    expect(() => initOsrSchema(db)).not.toThrow();
  });

  it("creates expected tables", () => {
    const db = getOsrDatabase(DB_PATH);
    initOsrSchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("osr_categories");
    expect(names).toContain("osr_core_rules");
    expect(names).toContain("osr_procedures");
    expect(names).toContain("osr_tables");
  });

  it("creates FTS5 virtual tables", () => {
    const db = getOsrDatabase(DB_PATH);
    initOsrSchema(db);
    const vtables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts'")
      .all() as { name: string }[];
    expect(vtables.map((t) => t.name)).toContain("osr_core_rules_fts");
  });

  it("ensureOsrSchema is idempotent", () => {
    closeOsrDatabase();
    expect(() => ensureOsrSchema(DB_PATH)).not.toThrow();
    expect(() => ensureOsrSchema(DB_PATH)).not.toThrow();
  });
});
