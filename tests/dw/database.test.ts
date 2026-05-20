import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { getDwDatabase, initDwSchema, ensureDwSchema, closeDwDatabase } from "../../src/dw/database.js";

const TMP = join(tmpdir(), `2d6mcp-test-dw-${Date.now()}`);
const DB_PATH = join(TMP, "test-dw.db");

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
});

afterAll(() => {
  closeDwDatabase();
  rmSync(TMP, { recursive: true, force: true });
});

describe("DW database", () => {
  it("creates database file", () => {
    const db = getDwDatabase(DB_PATH);
    expect(db).toBeDefined();
    expect(existsSync(DB_PATH)).toBe(true);
  });

  it("initializes schema without error", () => {
    const db = getDwDatabase(DB_PATH);
    expect(() => initDwSchema(db)).not.toThrow();
  });

  it("creates expected tables", () => {
    const db = getDwDatabase(DB_PATH);
    initDwSchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("dw_sections");
    expect(names).toContain("dw_moves");
    expect(names).toContain("dw_classes");
    expect(names).toContain("dw_spells");
    expect(names).toContain("dw_equipment");
    expect(names).toContain("dw_monsters");
    expect(names).toContain("dw_gm_tools");
  });

  it("creates FTS5 virtual tables", () => {
    const db = getDwDatabase(DB_PATH);
    initDwSchema(db);
    const vtables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts'")
      .all() as { name: string }[];
    const names = vtables.map((t) => t.name);
    expect(names).toContain("dw_sections_fts");
  });

  it("can insert and query DW moves", () => {
    const db = getDwDatabase(DB_PATH);
    initDwSchema(db);

    db.prepare(
      "INSERT INTO dw_moves (name, description, stat, category) VALUES (?, ?, ?, ?)"
    ).run("Hack and Slash", "When you attack in melee", "STR", "basic");

    const row = db.prepare("SELECT * FROM dw_moves WHERE name = ?").get("Hack and Slash") as {
      name: string;
      description: string;
      stat: string;
      category: string;
    };
    expect(row.name).toBe("Hack and Slash");
    expect(row.stat).toBe("STR");
    expect(row.category).toBe("basic");
  });

  it("ensureDwSchema is idempotent", () => {
    closeDwDatabase();
    expect(() => ensureDwSchema(DB_PATH)).not.toThrow();
    expect(() => ensureDwSchema(DB_PATH)).not.toThrow();
  });
});
