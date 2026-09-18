import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const originalEnv = { ...process.env };
const TMP = join(tmpdir(), `2d6mcp-test-sync-${Date.now()}`);
let testCounter = 0;

function uniqueByodPath(): string {
  return join(TMP, `src-${testCounter++}`);
}

beforeEach(() => {
  process.env = { ...originalEnv };
  process.env.AGREE_BYOD_USE = "true";
  mkdirSync(TMP, { recursive: true });
});

afterEach(async () => {
  const { closeByodDatabase } = await import("../../packages/server/src/byod/search.js");
  closeByodDatabase();
  process.env = { ...originalEnv };
  rmSync(TMP, { recursive: true, force: true });
});

describe("syncByodIndex", () => {
  it("returns complete:false then continues on the next call", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(join(byodPath, "a"), { recursive: true });
    mkdirSync(join(byodPath, "b"), { recursive: true });
    writeFileSync(join(byodPath, "root.txt"), "root content for indexing");
    writeFileSync(join(byodPath, "a", "one.txt"), "file in a");
    writeFileSync(join(byodPath, "b", "two.txt"), "file in b");
    process.env.BYOD_PATH = byodPath;

    const { loadConfig } = await import("../../packages/server/src/config.js");
    const { syncByodIndex } = await import("../../packages/server/src/tools/helpers.js");
    const { listByodFiles, getByodDatabase, closeByodDatabase } = await import(
      "../../packages/server/src/byod/search.js"
    );

    const first = await syncByodIndex({ ...loadConfig(), byodSyncTimeoutMs: 0 }, { roots: [""] });
    expect(first.complete).toBe(false);
    expect(first.walkComplete).toBe(false);

    let result = first;
    for (let i = 0; i < 20 && !result.complete; i++) {
      result = await syncByodIndex({ ...loadConfig(), byodSyncTimeoutMs: 30_000 }, { roots: [""] });
    }
    expect(result.complete).toBe(true);
    expect(result.walkComplete).toBe(true);
    expect(result.discovered).toBe(3);

    const db = getByodDatabase(byodPath);
    const files = listByodFiles(db);
    expect(files.filter((f) => f.status === "indexed")).toHaveLength(3);
    closeByodDatabase(byodPath);
  });

  it("resumes from persisted pending directories", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(join(byodPath, "skipped"), { recursive: true });
    mkdirSync(join(byodPath, "kept"), { recursive: true });
    writeFileSync(join(byodPath, "skipped", "nope.txt"), "should not be walked");
    writeFileSync(join(byodPath, "kept", "yes.txt"), "should be indexed");
    process.env.BYOD_PATH = byodPath;

    const { loadConfig } = await import("../../packages/server/src/config.js");
    const { syncByodIndex } = await import("../../packages/server/src/tools/helpers.js");
    const { getByodDatabase, saveWalkState, listByodFiles, closeByodDatabase } = await import(
      "../../packages/server/src/byod/search.js"
    );

    const db = getByodDatabase(byodPath);
    saveWalkState(db, {
      pendingDirs: ["kept"],
      pendingFiles: [],
      walkComplete: false,
      discovered: 0,
      slowFs: false,
      scopeKey: JSON.stringify(["kept"]),
      completedRoots: [],
    });

    const result = await syncByodIndex({ ...loadConfig(), byodSyncTimeoutMs: 30_000 }, { roots: ["kept"] });
    expect(result.complete).toBe(true);
    const files = listByodFiles(db);
    expect(files.map((f) => f.fileName)).toEqual(["yes.txt"]);
    closeByodDatabase(byodPath);
  });

  it("indexes only collections matching the query", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(join(byodPath, "Traveller"), { recursive: true });
    mkdirSync(join(byodPath, "Call of Cthulhu"), { recursive: true });
    writeFileSync(join(byodPath, "Traveller", "core.txt"), "Jump drives take one week.");
    writeFileSync(join(byodPath, "Call of Cthulhu", "sanity.txt"), "Sanity loss is d100.");
    process.env.BYOD_PATH = byodPath;

    const { loadConfig } = await import("../../packages/server/src/config.js");
    const { syncByodIndex } = await import("../../packages/server/src/tools/helpers.js");
    const { listByodFiles, getByodDatabase, closeByodDatabase } = await import(
      "../../packages/server/src/byod/search.js"
    );

    const listed = await syncByodIndex(loadConfig());
    expect(listed.complete).toBe(true);
    expect(listed.catalog?.map((e) => e.name).sort()).toEqual(["Call of Cthulhu", "Traveller"]);

    const result = await syncByodIndex(
      { ...loadConfig(), byodSyncTimeoutMs: 30_000 },
      { query: "traveller jump drive" }
    );
    expect(result.complete).toBe(true);
    expect(result.matchedRoots).toEqual(["Traveller"]);

    const db = getByodDatabase(byodPath);
    const files = listByodFiles(db);
    expect(files.map((f) => f.fileName)).toEqual(["core.txt"]);
    closeByodDatabase(byodPath);
  });

  it("reuses a completed collection on search but refreshes on an explicit sync", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(join(byodPath, "Traveller"), { recursive: true });
    writeFileSync(join(byodPath, "Traveller", "core.txt"), "Jump drives take one week.");
    process.env.BYOD_PATH = byodPath;

    const { loadConfig } = await import("../../packages/server/src/config.js");
    const { syncByodIndex, ensureByodForQuery } = await import("../../packages/server/src/tools/helpers.js");
    const { listByodFiles, getByodDatabase, closeByodDatabase } = await import(
      "../../packages/server/src/byod/search.js"
    );

    const indexed = await syncByodIndex(
      { ...loadConfig(), byodSyncTimeoutMs: 30_000 },
      { query: "traveller" }
    );
    expect(indexed.complete).toBe(true);

    writeFileSync(join(byodPath, "Traveller", "hg.txt"), "High Guard adds spinal mounts.");

    const ensured = await ensureByodForQuery({ ...loadConfig(), byodSyncTimeoutMs: 30_000 }, "traveller jump");
    expect(ensured.sync.complete).toBe(true);
    const db = getByodDatabase(byodPath);
    expect(listByodFiles(db).map((f) => f.fileName)).toEqual(["core.txt"]);

    const refreshed = await syncByodIndex(
      { ...loadConfig(), byodSyncTimeoutMs: 30_000 },
      { query: "traveller" }
    );
    expect(refreshed.complete).toBe(true);
    expect(listByodFiles(db).map((f) => f.fileName).sort()).toEqual(["core.txt", "hg.txt"]);
    closeByodDatabase(byodPath);
  });

  it("indexes only a nested directory root and skips sibling folders", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(join(byodPath, "parent", "line"), { recursive: true });
    mkdirSync(join(byodPath, "parent", "other"), { recursive: true });
    writeFileSync(join(byodPath, "parent", "line", "keep.txt"), "stay inside this root");
    writeFileSync(join(byodPath, "parent", "other", "skip.txt"), "sibling must not be walked");
    process.env.BYOD_PATH = byodPath;

    const { loadConfig } = await import("../../packages/server/src/config.js");
    const { syncByodIndex } = await import("../../packages/server/src/tools/helpers.js");
    const { listByodFiles, getByodDatabase, closeByodDatabase } = await import(
      "../../packages/server/src/byod/search.js"
    );

    const result = await syncByodIndex(
      { ...loadConfig(), byodSyncTimeoutMs: 30_000 },
      { root: join("parent", "line") }
    );
    expect(result.complete).toBe(true);
    expect(result.matchedRoots.map((p) => p.replace(/\\/g, "/"))).toEqual(["parent/line"]);

    const db = getByodDatabase(byodPath);
    const files = listByodFiles(db);
    expect(files.map((f) => f.fileName)).toEqual(["keep.txt"]);
    expect(files[0].relativePath.replace(/\\/g, "/")).toBe("parent/line/keep.txt");
    closeByodDatabase(byodPath);
  });

  it("does not pull a sibling folder that only shares a name prefix", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(join(byodPath, "collection-a"), { recursive: true });
    mkdirSync(join(byodPath, "collection-a-website-dump"), { recursive: true });
    writeFileSync(join(byodPath, "collection-a", "book.txt"), "indexed collection text");
    writeFileSync(join(byodPath, "collection-a-website-dump", "dump.txt"), "unrelated website dump");
    process.env.BYOD_PATH = byodPath;

    const { loadConfig } = await import("../../packages/server/src/config.js");
    const { syncByodIndex } = await import("../../packages/server/src/tools/helpers.js");
    const { listByodFiles, getByodDatabase, closeByodDatabase } = await import(
      "../../packages/server/src/byod/search.js"
    );

    const result = await syncByodIndex(
      { ...loadConfig(), byodSyncTimeoutMs: 30_000 },
      { query: "collection-a" }
    );
    expect(result.complete).toBe(true);
    expect(result.matchedRoots).toEqual(["collection-a"]);

    const db = getByodDatabase(byodPath);
    expect(listByodFiles(db).map((f) => f.fileName)).toEqual(["book.txt"]);
    closeByodDatabase(byodPath);
  });

  it("includes failed relative paths in the sync result", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(join(byodPath, "collection-a"), { recursive: true });
    writeFileSync(join(byodPath, "collection-a", "ok.txt"), "enough text to index this file");
    writeFileSync(join(byodPath, "collection-a", "empty.txt"), "");
    process.env.BYOD_PATH = byodPath;

    const { loadConfig } = await import("../../packages/server/src/config.js");
    const { syncByodIndex } = await import("../../packages/server/src/tools/helpers.js");
    const { closeByodDatabase } = await import("../../packages/server/src/byod/search.js");

    const result = await syncByodIndex(
      { ...loadConfig(), byodSyncTimeoutMs: 30_000 },
      { query: "collection-a" }
    );
    expect(result.complete).toBe(true);
    expect(result.failedPaths.some((p) => p.replace(/\\/g, "/").endsWith("collection-a/empty.txt"))).toBe(true);
    expect(result.message).toContain("empty.txt");
    closeByodDatabase(byodPath);
  });

  it("rejects a root that escapes BYOD_PATH", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    process.env.BYOD_PATH = byodPath;

    const { loadConfig } = await import("../../packages/server/src/config.js");
    const { syncByodIndex, resolveSyncTarget } = await import("../../packages/server/src/tools/helpers.js");
    const { closeByodDatabase } = await import("../../packages/server/src/byod/search.js");

    expect(resolveSyncTarget(byodPath, join("..", "outside")).kind).toBe("denied");
    const result = await syncByodIndex(
      { ...loadConfig(), byodSyncTimeoutMs: 30_000 },
      { root: join("..", "outside") }
    );
    expect(result.message).toContain("Access denied");
    expect(result.matchedRoots).toEqual([]);
    expect(result.filesIndexed).toBe(0);
    closeByodDatabase(byodPath);
  });

  it("stops starting files on a network mount when remaining budget is below the floor", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(join(byodPath, "collection-a"), { recursive: true });
    writeFileSync(join(byodPath, "collection-a", "one.txt"), "first file");
    writeFileSync(join(byodPath, "collection-a", "two.txt"), "second file");
    process.env.BYOD_PATH = byodPath;

    const { loadConfig } = await import("../../packages/server/src/config.js");
    const { syncByodIndex, NETWORK_INDEX_BUDGET_FLOOR_MS } = await import(
      "../../packages/server/src/tools/helpers.js"
    );
    const { closeByodDatabase } = await import("../../packages/server/src/byod/search.js");

    expect(NETWORK_INDEX_BUDGET_FLOOR_MS).toBeGreaterThan(0);
    const result = await syncByodIndex(
      { ...loadConfig(), byodSyncTimeoutMs: 50, byodNetwork: true },
      { query: "collection-a" }
    );
    expect(result.complete).toBe(false);
    expect(result.filesIndexed).toBe(0);
    expect(result.remaining + result.dirsRemaining).toBeGreaterThan(0);
    closeByodDatabase(byodPath);
  });

  it("CLI helper loops until complete and stops at the round cap", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(join(byodPath, "a"), { recursive: true });
    mkdirSync(join(byodPath, "b"), { recursive: true });
    writeFileSync(join(byodPath, "root.txt"), "root content for indexing");
    writeFileSync(join(byodPath, "a", "one.txt"), "file in a");
    writeFileSync(join(byodPath, "b", "two.txt"), "file in b");
    process.env.BYOD_PATH = byodPath;

    const { loadConfig } = await import("../../packages/server/src/config.js");
    const { syncByodUntilComplete } = await import("../../packages/server/src/tools/helpers.js");
    const { closeByodDatabase } = await import("../../packages/server/src/byod/search.js");

    const capped = await syncByodUntilComplete(
      { ...loadConfig(), byodSyncTimeoutMs: 0 },
      { roots: [""] },
      2
    );
    expect(capped.stoppedEarly).toBe(true);
    expect(capped.rounds).toBe(2);
    expect(capped.result.complete).toBe(false);

    const finished = await syncByodUntilComplete(
      { ...loadConfig(), byodSyncTimeoutMs: 30_000 },
      { roots: [""] },
      20
    );
    expect(finished.stoppedEarly).toBe(false);
    expect(finished.result.complete).toBe(true);
    closeByodDatabase(byodPath);
  });
});

describe("syncFile", () => {
  it("indexes a file using a platform-relative path", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(join(byodPath, "subdir"), { recursive: true });
    writeFileSync(join(byodPath, "subdir", "sheet.txt"), "character sheet text");
    process.env.BYOD_PATH = byodPath;

    const { loadConfig } = await import("../../packages/server/src/config.js");
    const { syncFile } = await import("../../packages/server/src/tools/helpers.js");
    const { closeByodDatabase } = await import("../../packages/server/src/byod/search.js");

    const result = await syncFile(loadConfig(), join("subdir", "sheet.txt"));
    expect(result.status).toBe("indexed");
    expect(result.chunks).toBeGreaterThan(0);
    closeByodDatabase(byodPath);
  });
});

describe("handleSyncByod", () => {
  it("rejects a relative_path that escapes BYOD_PATH", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    process.env.BYOD_PATH = byodPath;

    const { handleSyncByod } = await import("../../packages/server/src/tools/handlers/byod.js");
    const { closeByodDatabase } = await import("../../packages/server/src/byod/search.js");

    const result = await handleSyncByod({ relative_path: join("..", "outside") });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Access denied");
    closeByodDatabase(byodPath);
  });

  it("indexes a directory when relative_path points at a folder", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(join(byodPath, "parent", "line"), { recursive: true });
    mkdirSync(join(byodPath, "parent", "other"), { recursive: true });
    writeFileSync(join(byodPath, "parent", "line", "keep.txt"), "stay inside this root");
    writeFileSync(join(byodPath, "parent", "other", "skip.txt"), "sibling must not be walked");
    process.env.BYOD_PATH = byodPath;

    const { handleSyncByod } = await import("../../packages/server/src/tools/handlers/byod.js");
    const { listByodFiles, getByodDatabase, closeByodDatabase } = await import(
      "../../packages/server/src/byod/search.js"
    );

    const result = await handleSyncByod({ relative_path: join("parent", "line") });
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text) as { complete: boolean; matchedRoots: string[] };
    expect(payload.complete).toBe(true);
    expect(payload.matchedRoots.map((p) => p.replace(/\\/g, "/"))).toEqual(["parent/line"]);

    const db = getByodDatabase(byodPath);
    expect(listByodFiles(db).map((f) => f.fileName)).toEqual(["keep.txt"]);
    closeByodDatabase(byodPath);
  });
});

describe("clear_byod walk state", () => {
  it("wipes persisted walk state with the database", async () => {
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });

    const {
      getByodDatabase,
      saveWalkState,
      loadWalkState,
      clearByodDatabase,
      closeByodDatabase,
    } = await import("../../packages/server/src/byod/search.js");

    const db = getByodDatabase(byodPath);
    saveWalkState(db, {
      pendingDirs: ["left"],
      pendingFiles: [],
      walkComplete: false,
      discovered: 4,
      slowFs: true,
      scopeKey: JSON.stringify(["left"]),
      completedRoots: [],
    });
    expect(loadWalkState(db)?.pendingDirs).toEqual(["left"]);
    closeByodDatabase(byodPath);

    const cleared = clearByodDatabase(byodPath);
    expect(cleared.deleted).toBe(true);

    const reopened = getByodDatabase(byodPath);
    expect(loadWalkState(reopened)).toBeNull();
    closeByodDatabase(byodPath);
  });
});
