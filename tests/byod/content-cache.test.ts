import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  getContentCache,
  closeContentCache,
  computeContentHash,
  hasCachedChunks,
  getCachedChunks,
  storeCachedChunks,
  getCacheStats,
} from "../../packages/server/src/byod/content-cache.js";

const originalEnv = { ...process.env };
const TMP = join(tmpdir(), `2d6mcp-test-cache-${Date.now()}`);

beforeEach(() => {
  process.env = { ...originalEnv };
  process.env.BYOD_CONTENT_CACHE_PATH = join(TMP, "cache.db");
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  closeContentCache();
  process.env = { ...originalEnv };
  rmSync(TMP, { recursive: true, force: true });
});

describe("computeContentHash", () => {
  it("computes a SHA-256 hash", () => {
    const hash = computeContentHash(Buffer.from("hello"));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it("produces different hashes for different content", () => {
    const h1 = computeContentHash(Buffer.from("hello"));
    const h2 = computeContentHash(Buffer.from("world"));
    expect(h1).not.toBe(h2);
  });

  it("produces same hash for same content", () => {
    const h1 = computeContentHash(Buffer.from("test"));
    const h2 = computeContentHash(Buffer.from("test"));
    expect(h1).toBe(h2);
  });
});

describe("content cache", () => {
  it("stores and retrieves chunks", () => {
    const hash = computeContentHash(Buffer.from("test content"));
    storeCachedChunks(hash, [
      { title: "Section 1", content: "Content 1", chunkIndex: 0 },
      { title: "Section 2", content: "Content 2", chunkIndex: 1 },
    ]);

    expect(hasCachedChunks(hash)).toBe(true);
    const chunks = getCachedChunks(hash);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].title).toBe("Section 1");
    expect(chunks[1].chunkIndex).toBe(1);
  });

  it("returns false for unknown hash", () => {
    expect(hasCachedChunks("unknownhash")).toBe(false);
  });

  it("returns empty array for unknown hash", () => {
    expect(getCachedChunks("unknownhash")).toEqual([]);
  });

  it("does not duplicate on double store", () => {
    const hash = computeContentHash(Buffer.from("double store test"));
    storeCachedChunks(hash, [
      { title: "T", content: "C", chunkIndex: 0 },
    ]);
    storeCachedChunks(hash, [
      { title: "T2", content: "C2", chunkIndex: 0 },
    ]);
    const chunks = getCachedChunks(hash);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].title).toBe("T");
  });

  it("reports correct cache stats", () => {
    const h1 = computeContentHash(Buffer.from("stats1"));
    const h2 = computeContentHash(Buffer.from("stats2"));
    storeCachedChunks(h1, [{ title: "A", content: "a", chunkIndex: 0 }]);
    storeCachedChunks(h2, [
      { title: "B1", content: "b1", chunkIndex: 0 },
      { title: "B2", content: "b2", chunkIndex: 1 },
    ]);
    const stats = getCacheStats();
    expect(stats.totalHashes).toBe(2);
    expect(stats.totalChunks).toBe(3);
  });
});
