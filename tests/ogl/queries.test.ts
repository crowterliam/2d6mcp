import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../../src/config.js";
import {
  searchOglRules,
  searchOglTables,
  searchOglSkills,
  searchOglCareers,
  searchOglEquipment,
  listOglCategories,
  listOglTables,
  searchCombat,
  searchShipOps,
  searchWorldBuilding,
} from "../../src/ogl/queries.js";
import { getDatabase, initSchema, ensureSchema, closeDatabase } from "../../src/ogl/database.js";
import { populateOglDatabase } from "../../src/ogl/populate.js";

const config = loadConfig();
const BUNDLED_DB = config.oglDbPath;

describe("OGL queries against bundled database", () => {
  let db: Database.Database;

  beforeAll(() => {
    if (!existsSync(BUNDLED_DB)) {
      populateOglDatabase(BUNDLED_DB);
    }
    db = getDatabase(BUNDLED_DB);
  });

  afterAll(() => {
    closeDatabase();
  });

  describe("searchOglRules", () => {
    it("returns results for common search terms", () => {
      const results = searchOglRules(db, "combat");
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r).toHaveProperty("title");
        expect(r).toHaveProperty("snippet");
        expect(r).toHaveProperty("section");
      }
    });

    it("returns empty for nonsense terms", () => {
      const results = searchOglRules(db, "xyzzyplughnothingfound");
      expect(results).toEqual([]);
    });

    it("returns empty for empty search", () => {
      const results = searchOglRules(db, "");
      expect(results).toEqual([]);
    });
  });

  describe("searchOglSkills", () => {
    it("finds skills by name", () => {
      const results = searchOglSkills(db, "Pilot");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name.toLowerCase()).toContain("pilot");
    });

    it("returns skill properties", () => {
      const results = searchOglSkills(db, "Pilot");
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("name");
        expect(results[0]).toHaveProperty("description");
        expect(results[0]).toHaveProperty("characteristic");
      }
    });
  });

  describe("searchOglCareers", () => {
    it("finds careers by name", () => {
      const results = searchOglCareers(db, "Navy");
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns career properties", () => {
      const results = searchOglCareers(db, "Navy");
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("name");
        expect(results[0]).toHaveProperty("description");
        expect(results[0]).toHaveProperty("qualification");
      }
    });
  });

  describe("searchOglEquipment", () => {
    it("finds equipment by name", () => {
      const results = searchOglEquipment(db, "laser");
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns equipment properties", () => {
      const results = searchOglEquipment(db, "laser");
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("name");
        expect(results[0]).toHaveProperty("category");
        expect(results[0]).toHaveProperty("techLevel");
        expect(results[0]).toHaveProperty("cost");
      }
    });
  });

  describe("searchOglTables", () => {
    it("returns null for unknown table", () => {
      expect(searchOglTables(db, "Nonexistent Table XYZ")).toBeNull();
    });

    it("returns table structure for known tables", () => {
      const tables = listOglTables(db);
      if (tables.length > 0) {
        const result = searchOglTables(db, tables[0].name);
        expect(result).not.toBeNull();
        expect(result!.entries.length).toBeGreaterThan(0);
        expect(result!.entries[0]).toHaveProperty("min");
        expect(result!.entries[0]).toHaveProperty("max");
        expect(result!.entries[0]).toHaveProperty("result");
      }
    });
  });

  describe("listOglCategories", () => {
    it("returns categories", () => {
      const cats = listOglCategories(db);
      expect(cats.length).toBeGreaterThan(0);
      expect(cats[0]).toHaveProperty("name");
    });
  });

  describe("listOglTables", () => {
    it("returns tables", () => {
      const tables = listOglTables(db);
      expect(tables.length).toBeGreaterThan(0);
      expect(tables[0]).toHaveProperty("name");
      expect(tables[0]).toHaveProperty("entryCount");
    });
  });

  describe("searchCombat", () => {
    it("returns combat rules", () => {
      const results = searchCombat(db, "damage");
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("searchShipOps", () => {
    it("returns ship operations rules", () => {
      const results = searchShipOps(db, "jump");
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("searchWorldBuilding", () => {
    it("returns world building rules", () => {
      const results = searchWorldBuilding(db, "starport");
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
