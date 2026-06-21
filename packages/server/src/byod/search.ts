// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fts5QueryStrategy } from "@2d6mcp/shared";
import { PROJECT_ROOT } from "../config.js";

const BYOD_DB_PREFIX = "byod_ws_";
const BYOD_DB_SUFFIX = ".db";

function hashByodPath(byodPath: string): string {
  return createHash("sha256").update(byodPath).digest("hex").slice(0, 16);
}

export function getByodDbPath(byodPath: string): string {
  const byodDir = resolve(PROJECT_ROOT, "data", "byod");
  if (!existsSync(byodDir)) {
    mkdirSync(byodDir, { recursive: true });
  }
  const slug = hashByodPath(byodPath);
  return resolve(byodDir, `${BYOD_DB_PREFIX}${slug}${BYOD_DB_SUFFIX}`);
}

const workspaceDbs = new Map<string, Database.Database>();

export function getByodDatabase(byodPath: string): Database.Database {
  const dbPath = getByodDbPath(byodPath);

  const existing = workspaceDbs.get(dbPath);
  if (existing) return existing;

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS byod_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      relative_path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      ext TEXT,
      size INTEGER,
      ingested_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const cols = db
    .prepare("PRAGMA table_info(byod_files)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "file_hash")) {
    db.exec("ALTER TABLE byod_files ADD COLUMN file_hash TEXT;");
  }
  if (!cols.some((c) => c.name === "content_hash")) {
    db.exec("ALTER TABLE byod_files ADD COLUMN content_hash TEXT;");
  }

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS byod_fts USING fts5(
      title,
      content,
      file_name,
      content='byod_chunks',
      content_rowid='id'
    );

    CREATE TABLE IF NOT EXISTS byod_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      file_path TEXT,
      file_name TEXT,
      title TEXT,
      content TEXT,
      chunk_index INTEGER,
      FOREIGN KEY (file_id) REFERENCES byod_files(id) ON DELETE CASCADE
    );
  `);

  workspaceDbs.set(dbPath, db);
  return db;
}

export function indexChunks(
  db: Database.Database,
  filePath: string,
  fileName: string,
  ext: string,
  size: number,
  fileHash: string,
  contentHash: string | null,
  chunks: { title: string; content: string; chunkIndex: number }[]
): void {
  const insertFile = db.prepare(`
    INSERT OR REPLACE INTO byod_files (relative_path, file_name, ext, size, file_hash, content_hash, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const existing = db
    .prepare("SELECT id, file_hash FROM byod_files WHERE relative_path = ?")
    .get(filePath) as { id: number; file_hash: string } | undefined;

  if (existing) {
    if (existing.file_hash === fileHash) {
      return;
    }
    db.prepare("DELETE FROM byod_chunks WHERE file_id = ?").run(existing.id);
  }

  const result = insertFile.run(filePath, fileName, ext, size, fileHash, contentHash);
  const fileId = Number(result.lastInsertRowid);

  const insertChunk = db.prepare(`
    INSERT INTO byod_chunks (file_id, file_path, file_name, title, content, chunk_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const chunk of chunks) {
    insertChunk.run(fileId, filePath, fileName, chunk.title, chunk.content, chunk.chunkIndex);
  }
}

export const FAILED_HASH = "__failed__";

export function markFileFailed(
  db: Database.Database,
  filePath: string,
  fileName: string,
  ext: string,
  size: number
): void {
  const existing = db
    .prepare("SELECT id, file_hash FROM byod_files WHERE relative_path = ?")
    .get(filePath) as { id: number; file_hash: string } | undefined;

  if (existing) {
    if (existing.file_hash === FAILED_HASH) return;
    db.prepare("DELETE FROM byod_chunks WHERE file_id = ?").run(existing.id);
  }

  db.prepare(
    `INSERT OR REPLACE INTO byod_files (relative_path, file_name, ext, size, file_hash, ingested_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(filePath, fileName, ext, size, FAILED_HASH);
}

export function rebuildByodFts(db: Database.Database): void {
  db.exec(`INSERT INTO byod_fts(byod_fts) VALUES ('rebuild');`);
}

export function hasIndexedFiles(db: Database.Database): boolean {
  const row = db.prepare("SELECT COUNT(*) AS cnt FROM byod_files").get() as { cnt: number };
  return row.cnt > 0;
}

export function getStoredFileHash(
  db: Database.Database,
  relativePath: string
): string | null {
  const row = db
    .prepare("SELECT file_hash FROM byod_files WHERE relative_path = ?")
    .get(relativePath) as { file_hash: string } | undefined;
  return row?.file_hash ?? null;
}

export interface ByodFileEntry {
  fileName: string;
  relativePath: string;
  ext: string;
  size: number;
  chunks: number;
  ingestedAt: string;
  status: "indexed" | "failed";
}

export function listByodFiles(db: Database.Database): ByodFileEntry[] {
  const rows = db.prepare(`
    SELECT f.file_name, f.relative_path, f.ext, f.size, f.file_hash, f.ingested_at,
           COUNT(c.id) AS chunks
    FROM byod_files f
    LEFT JOIN byod_chunks c ON c.file_id = f.id
    GROUP BY f.id
    ORDER BY f.file_name
  `).all() as {
    file_name: string;
    relative_path: string;
    ext: string;
    size: number;
    file_hash: string;
    ingested_at: string;
    chunks: number;
  }[];

  return rows.map((r) => ({
    fileName: r.file_name,
    relativePath: r.relative_path,
    ext: r.ext,
    size: r.size,
    chunks: r.chunks,
    ingestedAt: r.ingested_at,
    status: r.file_hash === FAILED_HASH ? "failed" : "indexed",
  }));
}

export interface ByodFileChunk {
  title: string;
  size: number;
  chunkIndex: number;
}

export function getFileChunks(
  db: Database.Database,
  relativePath: string
): { file: ByodFileEntry | null; chunks: ByodFileChunk[] } {
  const fileRow = db.prepare(`
    SELECT f.file_name, f.relative_path, f.ext, f.size, f.file_hash, f.ingested_at,
           COUNT(c.id) AS chunks
    FROM byod_files f
    LEFT JOIN byod_chunks c ON c.file_id = f.id
    WHERE f.relative_path = ?
    GROUP BY f.id
  `).get(relativePath) as {
    file_name: string;
    relative_path: string;
    ext: string;
    size: number;
    file_hash: string;
    ingested_at: string;
    chunks: number;
  } | undefined;

  if (!fileRow) return { file: null, chunks: [] };

  const file: ByodFileEntry = {
    fileName: fileRow.file_name,
    relativePath: fileRow.relative_path,
    ext: fileRow.ext,
    size: fileRow.size,
    chunks: fileRow.chunks,
    ingestedAt: fileRow.ingested_at,
    status: fileRow.file_hash === FAILED_HASH ? "failed" : "indexed",
  };

  const chunkRows = db.prepare(`
    SELECT title, LENGTH(content) AS size, chunk_index
    FROM byod_chunks
    WHERE file_path = ?
    ORDER BY chunk_index
  `).all(relativePath) as { title: string; size: number; chunk_index: number }[];

  const chunks: ByodFileChunk[] = chunkRows.map((r) => ({
    title: r.title,
    size: r.size,
    chunkIndex: r.chunk_index,
  }));

  return { file, chunks };
}

export function getChunkContent(
  db: Database.Database,
  relativePath: string,
  chunkIndex: number
): { file: ByodFileEntry; chunk: { title: string; content: string; chunkIndex: number } } | null {
  const fileRow = db.prepare(`
    SELECT f.file_name, f.relative_path, f.ext, f.size, f.file_hash, f.ingested_at,
           COUNT(c.id) AS chunks
    FROM byod_files f
    LEFT JOIN byod_chunks c ON c.file_id = f.id
    WHERE f.relative_path = ?
    GROUP BY f.id
  `).get(relativePath) as {
    file_name: string;
    relative_path: string;
    ext: string;
    size: number;
    file_hash: string;
    ingested_at: string;
    chunks: number;
  } | undefined;

  if (!fileRow) return null;

  const file: ByodFileEntry = {
    fileName: fileRow.file_name,
    relativePath: fileRow.relative_path,
    ext: fileRow.ext,
    size: fileRow.size,
    chunks: fileRow.chunks,
    ingestedAt: fileRow.ingested_at,
    status: fileRow.file_hash === FAILED_HASH ? "failed" : "indexed",
  };

  const chunkRow = db.prepare(`
    SELECT title, content, chunk_index
    FROM byod_chunks
    WHERE file_path = ? AND chunk_index = ?
  `).get(relativePath, chunkIndex) as {
    title: string;
    content: string;
    chunk_index: number;
  } | undefined;

  if (!chunkRow) return null;

  return {
    file,
    chunk: {
      title: chunkRow.title,
      content: chunkRow.content,
      chunkIndex: chunkRow.chunk_index,
    },
  };
}

export interface SearchResult {
  title: string;
  snippet: string;
  fileName: string;
  filePath: string;
}

function tryFts5Query(
  db: Database.Database,
  stmt: Database.Statement,
  query: string,
  limit: number
): SearchResult[] {
  try {
    const rows = stmt.all(query, limit) as {
      title: string;
      snippet: string;
      file_name: string;
      file_path: string;
    }[];

    if (rows.length === 0) return [];

    return rows.map((r) => ({
      title: r.title,
      snippet: r.snippet,
      fileName: r.file_name,
      filePath: r.file_path,
    }));
  } catch {
    return [];
  }
}

export function searchByodIndex(
  db: Database.Database,
  searchTerm: string,
  limit = 20
): SearchResult[] {
  // Try exact → prefix-wildcard → fuzzy OR, stopping at the first match
  const strategies = fts5QueryStrategy(searchTerm);
  if (strategies.length === 0) return [];

  const stmt = db.prepare(`
    SELECT byod_fts.title, snippet(byod_fts, 1, '<mark>', '</mark>', '...', 64) AS snippet, byod_fts.file_name, byod_chunks.file_path
    FROM byod_fts
    JOIN byod_chunks ON byod_chunks.id = byod_fts.rowid
    WHERE byod_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  for (const ftsMatch of strategies) {
    const results = tryFts5Query(db, stmt, ftsMatch, limit);
    if (results.length > 0) return results;
  }

  return [];
}

export function closeByodDatabase(byodPath?: string): void {
  if (byodPath) {
    const dbPath = getByodDbPath(byodPath);
    const db = workspaceDbs.get(dbPath);
    if (db) {
      db.close();
      workspaceDbs.delete(dbPath);
    }
    return;
  }

  for (const [, db] of workspaceDbs) {
    db.close();
  }
  workspaceDbs.clear();
}

export function clearByodDatabase(byodPath: string): { deleted: boolean; message: string } {
  closeByodDatabase(byodPath);

  const dbPath = getByodDbPath(byodPath);

  if (!existsSync(dbPath)) {
    return { deleted: false, message: "BYOD database does not exist (already clear)." };
  }

  try {
    unlinkSync(dbPath);
    return { deleted: true, message: "BYOD database deleted. It will be recreated on the next sync_byod call." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { deleted: false, message: `Failed to delete BYOD database: ${msg}` };
  }
}
