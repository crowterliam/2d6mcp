/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeOsrDatabase } from "@2d6mcp/osr/database";
import { populateOsrDatabase } from "@2d6mcp/osr/populate";
import {
  searchOsrRules,
  searchOsrProcedures,
  searchOsrTables,
  listOsrCategories,
  listOsrTables,
} from "@2d6mcp/osr";
import { ensureOsrSchema } from "@2d6mcp/osr/database";

const TMP = join(tmpdir(), `2d6mcp-test-osr-queries-${Date.now()}`);
const DB_PATH = join(TMP, "osr-procedures.db");
const NOTES = join(TMP, "notes");

beforeAll(() => {
  mkdirSync(NOTES, { recursive: true });
  writeFileSync(join(NOTES, "house-torch.md"), "A torch lasts six exploration turns at this table.");
  writeFileSync(join(NOTES, "vendored-book.pdf"), "%PDF-fake not imported");
  populateOsrDatabase(DB_PATH, { sourceDir: NOTES });
});

afterAll(() => {
  closeOsrDatabase();
  rmSync(TMP, { recursive: true, force: true });
});

describe("OSR queries against populated database", () => {
  it("searches original procedure summaries", () => {
    const db = ensureOsrSchema(DB_PATH);
    const results = searchOsrRules(db, "morale");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => /morale/i.test(r.snippet) || /morale/i.test(r.title))).toBe(true);
  });

  it("does not contain commercial book dump markers", () => {
    const db = ensureOsrSchema(DB_PATH);
    const rows = db.prepare("SELECT content FROM osr_core_rules").all() as { content: string }[];
    for (const row of rows) {
      expect(row.content.toLowerCase()).not.toContain(["necrotic", " gnome"].join(""));
      expect(row.content).not.toMatch(/©/);
    }
  });

  it("filters procedures by category", () => {
    const db = ensureOsrSchema(DB_PATH);
    const saves = searchOsrProcedures(db, "save", "saves");
    expect(saves.length).toBeGreaterThan(0);
    expect(saves.every((p) => p.category === "saves")).toBe(true);
  });

  it("lists reaction/morale/hireling tables", () => {
    const db = ensureOsrSchema(DB_PATH);
    const tables = listOsrTables(db);
    const names = tables.map((t) => t.name);
    expect(names).toContain("Monster Reaction");
    expect(names).toContain("Morale Check");
    expect(names).toContain("Hireling Reaction");
    expect(names).toContain("Wandering Encounter Tick");
  });

  it("loads a named reaction table", () => {
    const db = ensureOsrSchema(DB_PATH);
    const table = searchOsrTables(db, "Monster Reaction");
    expect(table).not.toBeNull();
    expect(table!.diceType).toBe("2d6");
    expect(table!.entries.length).toBeGreaterThanOrEqual(5);
  });

  it("lists categories", () => {
    const db = ensureOsrSchema(DB_PATH);
    const cats = listOsrCategories(db);
    expect(cats.map((c) => c.name)).toContain("Combat");
  });

  it("imports operator markdown notes from source-dir", () => {
    const db = ensureOsrSchema(DB_PATH);
    const imported = searchOsrRules(db, "torch");
    expect(imported.some((r) => r.section === "Operator import")).toBe(true);
  });

  it("does not import PDFs from source-dir", () => {
    const db = ensureOsrSchema(DB_PATH);
    const pdfHits = searchOsrRules(db, "vendored-book");
    expect(pdfHits.some((r) => r.title.includes("vendored-book"))).toBe(false);
  });
});
