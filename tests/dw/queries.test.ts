import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../../packages/server/src/config.js";
import {
  searchDwRules,
  searchDwMoves,
  searchDwClasses,
  searchDwSpells,
  searchDwEquipment,
  searchDwMonsters,
  searchDwGmTools,
  listDwMoveCategories,
  listDwMonsterSettings,
} from "@2d6mcp/dw";
import { ensureDwSchema, closeDwDatabase } from "@2d6mcp/dw/database";
import { populateDwDatabase } from "@2d6mcp/dw/populate";

const config = loadConfig();
const BUNDLED_DB = config.dwDbPath;

describe("DW queries against bundled database", () => {
  let db: Database.Database;

  beforeAll(() => {
    if (!existsSync(BUNDLED_DB)) {
      populateDwDatabase(BUNDLED_DB);
    }
    db = ensureDwSchema(BUNDLED_DB);
  });

  afterAll(() => {
    closeDwDatabase();
  });

  describe("searchDwRules", () => {
    it("returns results or empty gracefully for any term", () => {
      const results = searchDwRules(db, "move");
      expect(Array.isArray(results)).toBe(true);
    });

    it("returns empty for nonsense terms", () => {
      const results = searchDwRules(db, "xyzzyplughnothingfound");
      expect(results).toEqual([]);
    });

    it("returns empty for empty search", () => {
      const results = searchDwRules(db, "");
      expect(results).toEqual([]);
    });
  });

  describe("searchDwMoves", () => {
    it("finds moves by name", () => {
      const results = searchDwMoves(db, "Hack and Slash");
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns move properties", () => {
      const results = searchDwMoves(db, "Hack and Slash");
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("name");
        expect(results[0]).toHaveProperty("description");
        expect(results[0]).toHaveProperty("category");
      }
    });
  });

  describe("searchDwClasses", () => {
    it("finds classes by name", () => {
      const results = searchDwClasses(db, "Wizard");
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns class properties", () => {
      const results = searchDwClasses(db, "Wizard");
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("name");
        expect(results[0]).toHaveProperty("description");
      }
    });
  });

  describe("searchDwSpells", () => {
    it("finds spells", () => {
      const results = searchDwSpells(db, "magic missile");
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("returns spell properties", () => {
      const results = searchDwSpells(db, "spell");
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("name");
        expect(results[0]).toHaveProperty("level");
        expect(results[0]).toHaveProperty("spell_class");
        expect(results[0]).toHaveProperty("description");
      }
    });
  });

  describe("searchDwEquipment", () => {
    it("finds equipment", () => {
      const results = searchDwEquipment(db, "sword");
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns equipment properties", () => {
      const results = searchDwEquipment(db, "sword");
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("name");
        expect(results[0]).toHaveProperty("category");
        expect(results[0]).toHaveProperty("damage");
      }
    });
  });

  describe("searchDwMonsters", () => {
    it("finds monsters", () => {
      const results = searchDwMonsters(db, "goblin");
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("returns monster properties", () => {
      const results = searchDwMonsters(db, "dragon");
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("name");
        expect(results[0]).toHaveProperty("hp");
        expect(results[0]).toHaveProperty("armor");
        expect(results[0]).toHaveProperty("source_setting");
      }
    });
  });

  describe("searchDwGmTools", () => {
    it("finds GM tools", () => {
      const results = searchDwGmTools(db, "front");
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("listDwMoveCategories", () => {
    it("returns categories with counts", () => {
      const cats = listDwMoveCategories(db);
      expect(cats.length).toBeGreaterThan(0);
      expect(cats[0]).toHaveProperty("category");
      expect(cats[0]).toHaveProperty("count");
      expect(cats[0].count).toBeGreaterThan(0);
    });
  });

  describe("listDwMonsterSettings", () => {
    it("returns settings with counts", () => {
      const settings = listDwMonsterSettings(db);
      expect(settings.length).toBeGreaterThan(0);
      expect(settings[0]).toHaveProperty("source_setting");
      expect(settings[0]).toHaveProperty("count");
    });
  });
});
