import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { getDatabase, initSchema, ensureSchema, closeDatabase } from "@2d6mcp/ogl/database";
import { SCHEMA_DDL } from "@2d6mcp/ogl/schema";

const TMP = join(tmpdir(), `2d6mcp-test-ogl-${Date.now()}`);
const DB_PATH = join(TMP, "test-ogl.db");

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
});

afterAll(() => {
  closeDatabase();
  rmSync(TMP, { recursive: true, force: true });
});

describe("OGL database", () => {
  it("creates database file", () => {
    const db = getDatabase(DB_PATH);
    expect(db).toBeDefined();
    expect(existsSync(DB_PATH)).toBe(true);
  });

  it("initializes schema without error", () => {
    const db = getDatabase(DB_PATH);
    expect(() => initSchema(db)).not.toThrow();
  });

  it("creates expected tables", () => {
    const db = getDatabase(DB_PATH);
    initSchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("rules_categories");
    expect(names).toContain("rules_text");
    expect(names).toContain("tables_2d6");
    expect(names).toContain("skills");
    expect(names).toContain("careers");
    expect(names).toContain("equipment");
    expect(names).toContain("combat");
    expect(names).toContain("starship_operations");
    expect(names).toContain("world_building");
    expect(names).toContain("core_rules");
  });

  it("creates FTS5 virtual tables", () => {
    const db = getDatabase(DB_PATH);
    initSchema(db);
    const vtables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts'")
      .all() as { name: string }[];
    const names = vtables.map((t) => t.name);
    expect(names).toContain("rules_fts");
    expect(names).toContain("core_rules_fts");
  });

  it("can insert and query data", () => {
    const db = getDatabase(DB_PATH);
    initSchema(db);

    db.prepare("INSERT INTO skills (name, description, characteristic) VALUES (?, ?, ?)").run(
      "Pilot",
      "Operating spacecraft",
      "DEX"
    );

    const row = db.prepare("SELECT * FROM skills WHERE name = ?").get("Pilot") as {
      name: string;
      description: string;
      characteristic: string;
    };
    expect(row.name).toBe("Pilot");
    expect(row.description).toBe("Operating spacecraft");
    expect(row.characteristic).toBe("DEX");
  });

  it("ensureSchema is idempotent", () => {
    closeDatabase();
    expect(() => ensureSchema(DB_PATH)).not.toThrow();
    expect(() => ensureSchema(DB_PATH)).not.toThrow();
  });
});
