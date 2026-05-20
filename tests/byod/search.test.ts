import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const originalEnv = { ...process.env };
const TMP = join(tmpdir(), `2d6mcp-test-search-${Date.now()}`);
let testCounter = 0;

function uniqueByodPath(): string {
  return join(TMP, `byod-source-${testCounter++}`);
}

beforeEach(() => {
  process.env = { ...originalEnv };
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  process.env = { ...originalEnv };
  rmSync(TMP, { recursive: true, force: true });
});

describe("getByodDatabase", () => {
  it("creates a database for a BYOD path", async () => {
    const { getByodDatabase, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    expect(db).toBeDefined();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("byod_files");
    expect(names).toContain("byod_chunks");
    expect(names).toContain("byod_fts");
    closeByodDatabase(byodPath);
  });

  it("returns the same db for the same path", async () => {
    const { getByodDatabase, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db1 = getByodDatabase(byodPath);
    const db2 = getByodDatabase(byodPath);
    expect(db1).toBe(db2);
    closeByodDatabase(byodPath);
  });
});

describe("indexChunks", () => {
  it("indexes chunks for a file", async () => {
    const { getByodDatabase, indexChunks, rebuildByodFts, listByodFiles, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    indexChunks(db, "test.md", "test.md", ".md", 100, "hash1", null, [
      { title: "Section 1", content: "Content of section one", chunkIndex: 0 },
      { title: "Section 2", content: "Content of section two", chunkIndex: 1 },
    ]);
    rebuildByodFts(db);

    const files = listByodFiles(db);
    expect(files).toHaveLength(1);
    expect(files[0].fileName).toBe("test.md");
    expect(files[0].chunks).toBe(2);
    expect(files[0].status).toBe("indexed");
    closeByodDatabase(byodPath);
  });

  it("skips re-indexing when hash matches", async () => {
    const { getByodDatabase, indexChunks, rebuildByodFts, listByodFiles, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    indexChunks(db, "test.md", "test.md", ".md", 100, "hash1", null, [
      { title: "S1", content: "C1", chunkIndex: 0 },
    ]);
    rebuildByodFts(db);
    indexChunks(db, "test.md", "test.md", ".md", 100, "hash1", null, [
      { title: "S2", content: "C2", chunkIndex: 0 },
    ]);
    rebuildByodFts(db);
    const files = listByodFiles(db);
    expect(files[0].chunks).toBe(1);
    closeByodDatabase(byodPath);
  });

  it("replaces chunks when hash changes", async () => {
    const { getByodDatabase, indexChunks, rebuildByodFts, getFileChunks, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    indexChunks(db, "test.md", "test.md", ".md", 100, "hash1", null, [
      { title: "Old", content: "Old content", chunkIndex: 0 },
    ]);
    rebuildByodFts(db);
    indexChunks(db, "test.md", "test.md", ".md", 100, "hash2", null, [
      { title: "New", content: "New content", chunkIndex: 0 },
    ]);
    rebuildByodFts(db);
    const result = getFileChunks(db, "test.md");
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].title).toBe("New");
    closeByodDatabase(byodPath);
  });
});

describe("searchByodIndex", () => {
  it("finds indexed content", async () => {
    const { getByodDatabase, indexChunks, rebuildByodFts, searchByodIndex, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    indexChunks(db, "rules.md", "rules.md", ".md", 100, "h1", null, [
      { title: "Combat Rules", content: "When attacking, roll 2d6 and add your skill modifier", chunkIndex: 0 },
    ]);
    rebuildByodFts(db);

    const results = searchByodIndex(db, "attacking");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toContain("Combat Rules");
    expect(results[0].filePath).toBe("rules.md");
    closeByodDatabase(byodPath);
  });

  it("returns empty for no matches", async () => {
    const { getByodDatabase, indexChunks, rebuildByodFts, searchByodIndex, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    indexChunks(db, "test.md", "test.md", ".md", 100, "h1", null, [
      { title: "Stuff", content: "Random content", chunkIndex: 0 },
    ]);
    rebuildByodFts(db);

    const results = searchByodIndex(db, "xyzzyplughnothing");
    expect(results).toEqual([]);
    closeByodDatabase(byodPath);
  });

  it("returns empty for empty search", async () => {
    const { getByodDatabase, searchByodIndex, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    const results = searchByodIndex(db, "");
    expect(results).toEqual([]);
    closeByodDatabase(byodPath);
  });
});

describe("hasIndexedFiles", () => {
  it("returns false when no files indexed", async () => {
    const { getByodDatabase, hasIndexedFiles, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    expect(hasIndexedFiles(db)).toBe(false);
    closeByodDatabase(byodPath);
  });

  it("returns true when files are indexed", async () => {
    const { getByodDatabase, indexChunks, hasIndexedFiles, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    indexChunks(db, "f.txt", "f.txt", ".txt", 10, "h", null, [
      { title: "T", content: "C", chunkIndex: 0 },
    ]);
    expect(hasIndexedFiles(db)).toBe(true);
    closeByodDatabase(byodPath);
  });
});

describe("getStoredFileHash", () => {
  it("returns null for unknown file", async () => {
    const { getByodDatabase, getStoredFileHash, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    expect(getStoredFileHash(db, "unknown.txt")).toBeNull();
    closeByodDatabase(byodPath);
  });

  it("returns the stored hash", async () => {
    const { getByodDatabase, indexChunks, getStoredFileHash, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    indexChunks(db, "known.txt", "known.txt", ".txt", 10, "abc123", null, [
      { title: "T", content: "C", chunkIndex: 0 },
    ]);
    expect(getStoredFileHash(db, "known.txt")).toBe("abc123");
    closeByodDatabase(byodPath);
  });
});

describe("markFileFailed", () => {
  it("marks a file as failed", async () => {
    const { getByodDatabase, markFileFailed, listByodFiles, getStoredFileHash, FAILED_HASH, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    markFileFailed(db, "bad.pdf", "bad.pdf", ".pdf", 500);
    const files = listByodFiles(db);
    const f = files.find((f) => f.fileName === "bad.pdf");
    expect(f).toBeDefined();
    expect(f!.status).toBe("failed");
    expect(getStoredFileHash(db, "bad.pdf")).toBe(FAILED_HASH);
    closeByodDatabase(byodPath);
  });

  it("removes chunks when marking as failed", async () => {
    const { getByodDatabase, indexChunks, markFileFailed, getFileChunks, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    indexChunks(db, "willfail.txt", "willfail.txt", ".txt", 10, "h1", null, [
      { title: "T", content: "C", chunkIndex: 0 },
    ]);
    markFileFailed(db, "willfail.txt", "willfail.txt", ".txt", 10);
    const result = getFileChunks(db, "willfail.txt");
    expect(result.chunks).toHaveLength(0);
    expect(result.file!.status).toBe("failed");
    closeByodDatabase(byodPath);
  });
});

describe("getFileChunks", () => {
  it("returns null for nonexistent file", async () => {
    const { getByodDatabase, getFileChunks, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    const result = getFileChunks(db, "nope.txt");
    expect(result.file).toBeNull();
    expect(result.chunks).toEqual([]);
    closeByodDatabase(byodPath);
  });

  it("returns file and chunks", async () => {
    const { getByodDatabase, indexChunks, getFileChunks, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    indexChunks(db, "multi.txt", "multi.txt", ".txt", 10, "h1", null, [
      { title: "Part 1", content: "First part", chunkIndex: 0 },
      { title: "Part 2", content: "Second part", chunkIndex: 1 },
    ]);
    const result = getFileChunks(db, "multi.txt");
    expect(result.file).not.toBeNull();
    expect(result.file!.fileName).toBe("multi.txt");
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0].title).toBe("Part 1");
    expect(result.chunks[1].chunkIndex).toBe(1);
    closeByodDatabase(byodPath);
  });
});

describe("getChunkContent", () => {
  it("returns null for nonexistent file", async () => {
    const { getByodDatabase, getChunkContent, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    expect(getChunkContent(db, "nope.txt", 0)).toBeNull();
    closeByodDatabase(byodPath);
  });

  it("returns null for nonexistent chunk index", async () => {
    const { getByodDatabase, indexChunks, getChunkContent, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    indexChunks(db, "content.txt", "content.txt", ".txt", 10, "h1", null, [
      { title: "T", content: "C", chunkIndex: 0 },
    ]);
    expect(getChunkContent(db, "content.txt", 99)).toBeNull();
    closeByodDatabase(byodPath);
  });

  it("returns the chunk content", async () => {
    const { getByodDatabase, indexChunks, getChunkContent, closeByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    indexChunks(db, "content.txt", "content.txt", ".txt", 10, "h1", null, [
      { title: "My Chunk", content: "Full content here", chunkIndex: 0 },
    ]);
    const result = getChunkContent(db, "content.txt", 0);
    expect(result).not.toBeNull();
    expect(result!.chunk.content).toBe("Full content here");
    expect(result!.chunk.title).toBe("My Chunk");
    expect(result!.file.fileName).toBe("content.txt");
    closeByodDatabase(byodPath);
  });
});

describe("clearByodDatabase", () => {
  it("deletes the database file", async () => {
    const { getByodDatabase, indexChunks, closeByodDatabase, clearByodDatabase } = await import("../../src/byod/search.js");
    const byodPath = uniqueByodPath();
    mkdirSync(byodPath, { recursive: true });
    const db = getByodDatabase(byodPath);
    indexChunks(db, "f.txt", "f.txt", ".txt", 10, "h", null, [
      { title: "T", content: "C", chunkIndex: 0 },
    ]);
    closeByodDatabase(byodPath);
    const result = clearByodDatabase(byodPath);
    expect(result.deleted).toBe(true);
    expect(result.message).toContain("deleted");
  });

  it("reports when database does not exist", async () => {
    const { closeByodDatabase, clearByodDatabase } = await import("../../src/byod/search.js");
    closeByodDatabase();
    const result = clearByodDatabase("/nonexistent/path/that/does/not/exist");
    expect(result.deleted).toBe(false);
    expect(result.message).toContain("already clear");
  });
});
