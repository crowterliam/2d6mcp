// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { PROJECT_ROOT } from "../config.js";

const DEFAULT_CACHE_DB_PATH = resolve(PROJECT_ROOT, "data", "byod", "content_cache.db");

let cacheDb: Database.Database | null = null;

export function getContentCachePath(): string {
  const envPath = process.env.BYOD_CONTENT_CACHE_PATH;
  return envPath || DEFAULT_CACHE_DB_PATH;
}

export function getContentCache(): Database.Database {
  if (cacheDb) return cacheDb;

  const dbPath = getContentCachePath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  cacheDb = new Database(dbPath);
  cacheDb.pragma("journal_mode = WAL");

  cacheDb.exec(`
    CREATE TABLE IF NOT EXISTS cached_chunks (
      content_hash TEXT NOT NULL,
      title TEXT,
      content TEXT,
      chunk_index INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (content_hash, chunk_index)
    );
  `);

  cacheDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_cached_chunks_hash
    ON cached_chunks(content_hash);
  `);

  return cacheDb;
}

export function closeContentCache(): void {
  if (cacheDb) {
    cacheDb.close();
    cacheDb = null;
  }
}

export function computeContentHash(fileBytes: Buffer): string {
  return createHash("sha256").update(fileBytes).digest("hex");
}

export interface CachedChunk {
  title: string;
  content: string;
  chunkIndex: number;
}

export function hasCachedChunks(contentHash: string): boolean {
  const db = getContentCache();
  const row = db
    .prepare("SELECT 1 FROM cached_chunks WHERE content_hash = ? LIMIT 1")
    .get(contentHash);
  return row !== undefined;
}

export function getCachedChunks(contentHash: string): CachedChunk[] {
  const db = getContentCache();
  const rows = db
    .prepare(
      "SELECT title, content, chunk_index FROM cached_chunks WHERE content_hash = ? ORDER BY chunk_index"
    )
    .all(contentHash) as {
    title: string;
    content: string;
    chunk_index: number;
  }[];

  return rows.map((r) => ({
    title: r.title,
    content: r.content,
    chunkIndex: r.chunk_index,
  }));
}

export function storeCachedChunks(
  contentHash: string,
  chunks: CachedChunk[]
): void {
  const db = getContentCache();

  const existing = db
    .prepare("SELECT 1 FROM cached_chunks WHERE content_hash = ? LIMIT 1")
    .get(contentHash);
  if (existing) return;

  const insert = db.prepare(
    "INSERT INTO cached_chunks (content_hash, title, content, chunk_index) VALUES (?, ?, ?, ?)"
  );

  const insertAll = db.transaction((items: CachedChunk[]) => {
    for (const chunk of items) {
      insert.run(contentHash, chunk.title, chunk.content, chunk.chunkIndex);
    }
  });

  insertAll(chunks);
}

export function getCacheStats(): { totalHashes: number; totalChunks: number } {
  const db = getContentCache();
  const hashes = db
    .prepare("SELECT COUNT(DISTINCT content_hash) AS cnt FROM cached_chunks")
    .get() as { cnt: number };
  const chunks = db
    .prepare("SELECT COUNT(*) AS cnt FROM cached_chunks")
    .get() as { cnt: number };
  return { totalHashes: hashes.cnt, totalChunks: chunks.cnt };
}
