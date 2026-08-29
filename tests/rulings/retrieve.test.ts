import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { retrieveRulesContext, questionFromTranscript } from "../../packages/server/src/rulings/retrieve.js";
import { openSessionDb, createSession, closeSessionDb } from "../../packages/server/src/session/database.js";
import {
  getByodDatabase,
  indexChunks,
  rebuildByodFts,
  closeByodDatabase,
} from "../../packages/server/src/byod/search.js";

const originalEnv = { ...process.env };

describe("questionFromTranscript", () => {
  it("prefers the last line that contains a question mark", () => {
    const q = questionFromTranscript("The party enters the room.\nCan I hide behind cover?\nI roll.");
    expect(q).toContain("hide behind cover");
  });
});

describe("retrieveRulesContext", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    closeSessionDb();
  });

  afterEach(() => {
    closeSessionDb();
    process.env = { ...originalEnv };
  });

  it("scopes lookup to an explicit rules system", async () => {
    const result = await retrieveRulesContext({
      question: "cover in combat",
      rulesSystem: "ogl",
    });
    expect(result.resolvedSystem).toBe("ogl");
    expect(result.systemsSearched).toEqual(["ogl"]);
    expect(result.searchCalls).toBeLessThanOrEqual(8);
    expect(result.searchCalls).toBeGreaterThanOrEqual(5);
    expect(result.context.length).toBeGreaterThan(0);
  });

  it("uses session.rules_system when the arg is omitted", async () => {
    const sessionPath = join(tmpdir(), `2d6mcp-retrieve-session-${Date.now()}.db`);
    process.env.SESSION_DB_PATH = sessionPath;
    closeSessionDb();
    const db = openSessionDb(sessionPath);
    const session = createSession(db, "dw", "retrieve-test");

    const result = await retrieveRulesContext({
      question: "hack and slash",
      sessionId: session.id,
    });
    expect(result.resolvedSystem).toBe("dw");
    expect(result.systemsSearched).toEqual(["dw"]);
    expect(result.searchCalls).toBeLessThanOrEqual(8);
  });

  it("runs BYOD for ogl when consent is on", async () => {
    const byodPath = join(tmpdir(), `2d6mcp-retrieve-byod-${Date.now()}`);
    mkdirSync(join(byodPath, "Uniquebyodgrant"), { recursive: true });
    writeFileSync(
      join(byodPath, "Uniquebyodgrant", "house.md"),
      "Uniquebyodgrant: cover always grants a -2 DM."
    );
    process.env.AGREE_BYOD_USE = "true";
    process.env.BYOD_PATH = byodPath;

    const db = getByodDatabase(byodPath);
    indexChunks(db, "Uniquebyodgrant/house.md", "house.md", ".md", 40, "h1", null, [
      {
        title: "Cover",
        content: "Uniquebyodgrant: cover always grants a -2 DM in combat.",
        chunkIndex: 0,
      },
    ]);
    rebuildByodFts(db);

    const result = await retrieveRulesContext({
      question: "uniquebyodgrant",
      rulesSystem: "ogl",
    });
    expect(result.byodSearched).toBe(true);
    expect(result.systemsSearched).toEqual(["ogl"]);
    expect(result.context).toMatch(/Uniquebyodgrant/i);

    closeByodDatabase(byodPath);
    rmSync(byodPath, { recursive: true, force: true });
  });

  it("uses session byod_system folder without requiring it in the filename", async () => {
    const byodPath = join(tmpdir(), `2d6mcp-retrieve-byod-sys-${Date.now()}`);
    mkdirSync(join(byodPath, "Traveller"), { recursive: true });
    mkdirSync(join(byodPath, "Call of Cthulhu"), { recursive: true });
    process.env.AGREE_BYOD_USE = "true";
    process.env.BYOD_PATH = byodPath;

    const byodDb = getByodDatabase(byodPath);
    indexChunks(byodDb, "Traveller/core.md", "core.md", ".md", 80, "h1", null, [
      { title: "Jump", content: "Xyzzyplugh: jump drives take one week in this sci-fi collection.", chunkIndex: 0 },
    ]);
    indexChunks(byodDb, "Call of Cthulhu/sanity.md", "sanity.md", ".md", 80, "h2", null, [
      { title: "Sanity", content: "Xyzzyplugh: jumping at shadows costs sanity in this horror collection.", chunkIndex: 0 },
    ]);
    rebuildByodFts(byodDb);

    const sessionPath = join(tmpdir(), `2d6mcp-retrieve-byod-session-${Date.now()}.db`);
    process.env.SESSION_DB_PATH = sessionPath;
    closeSessionDb();
    const sessionDb = openSessionDb(sessionPath);
    const session = createSession(sessionDb, "ogl", "byod-folder-scope", "traveller");

    const result = await retrieveRulesContext({
      question: "xyzzyplugh",
      rulesSystem: "ogl",
      sessionId: session.id,
    });
    expect(result.context).toMatch(/jump drives take one week/i);
    expect(result.context).not.toMatch(/jumping at shadows/i);

    closeByodDatabase(byodPath);
    rmSync(byodPath, { recursive: true, force: true });
  });

  it("keeps searchCalls O(categories) rather than O(fuzzy terms × tables)", async () => {
    const ogl = await retrieveRulesContext({
      question: "what is the modifier for attacking from cover in ranged combat with a laser rifle",
      rulesSystem: "ogl",
    });
    expect(ogl.searchCalls).toBeGreaterThanOrEqual(5);
    expect(ogl.searchCalls).toBeLessThanOrEqual(7);

    const auto = await retrieveRulesContext({
      question: "combat cover",
      rulesSystem: "auto",
    });
    expect(auto.searchCalls).toBeLessThan(40);
    expect(auto.systemsSearched).toHaveLength(5);
  });
});
