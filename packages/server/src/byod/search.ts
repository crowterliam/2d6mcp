// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { fts5QueryStrategy } from "@2d6mcp/shared";
import { PROJECT_ROOT } from "../config.js";
import { pathMatchesAnyPrefix } from "./paths.js";

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

    CREATE TABLE IF NOT EXISTS byod_walk (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      pending_dirs TEXT NOT NULL,
      pending_files TEXT NOT NULL,
      walk_complete INTEGER NOT NULL DEFAULT 0,
      discovered INTEGER NOT NULL DEFAULT 0,
      slow_fs INTEGER NOT NULL DEFAULT 0,
      scope_key TEXT NOT NULL DEFAULT '',
      completed_roots TEXT NOT NULL DEFAULT '[]'
    );
  `);

  ensureWalkColumns(db);

  workspaceDbs.set(dbPath, db);
  return db;
}

function ensureWalkColumns(db: Database.Database): void {
  const cols = db.prepare("PRAGMA table_info(byod_walk)").all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("slow_fs")) {
    db.exec("ALTER TABLE byod_walk ADD COLUMN slow_fs INTEGER NOT NULL DEFAULT 0;");
  }
  if (!names.has("discovered")) {
    db.exec("ALTER TABLE byod_walk ADD COLUMN discovered INTEGER NOT NULL DEFAULT 0;");
  }
  if (!names.has("scope_key")) {
    db.exec("ALTER TABLE byod_walk ADD COLUMN scope_key TEXT NOT NULL DEFAULT '';");
  }
  if (!names.has("completed_roots")) {
    db.exec("ALTER TABLE byod_walk ADD COLUMN completed_roots TEXT NOT NULL DEFAULT '[]';");
  }
}

export interface PersistedIngestedFile {
  path: string;
  relativePath: string;
  name: string;
  size: number;
  ext: string;
  hash: string;
}

export interface ByodWalkState {
  pendingDirs: string[];
  pendingFiles: PersistedIngestedFile[];
  walkComplete: boolean;
  discovered: number;
  slowFs: boolean;
  scopeKey: string;
  completedRoots: string[];
}

export function scopeKeyFor(roots: string[]): string {
  return JSON.stringify([...roots].sort());
}

export function freshWalkState(slowFs = false, pendingDirs: string[] = []): ByodWalkState {
  return {
    pendingDirs,
    pendingFiles: [],
    walkComplete: false,
    discovered: 0,
    slowFs,
    scopeKey: scopeKeyFor(pendingDirs),
    completedRoots: [],
  };
}

export function loadWalkState(db: Database.Database): ByodWalkState | null {
  const row = db
    .prepare(
      `SELECT pending_dirs, pending_files, walk_complete, discovered, slow_fs, scope_key, completed_roots FROM byod_walk WHERE id = 1`
    )
    .get() as
    | {
        pending_dirs: string;
        pending_files: string;
        walk_complete: number;
        discovered: number;
        slow_fs: number;
        scope_key: string;
        completed_roots: string;
      }
    | undefined;
  if (!row) return null;

  let pendingDirs: string[] = [];
  let pendingFiles: PersistedIngestedFile[] = [];
  try {
    const dirs = JSON.parse(row.pending_dirs) as unknown;
    pendingDirs = Array.isArray(dirs) ? dirs.filter((d): d is string => typeof d === "string") : [];
  } catch {
    pendingDirs = [];
  }
  try {
    const files = JSON.parse(row.pending_files) as unknown;
    pendingFiles = Array.isArray(files) ? files.filter(isPersistedIngestedFile) : [];
  } catch {
    pendingFiles = [];
  }

  let completedRoots: string[] = [];
  try {
    const roots = JSON.parse(row.completed_roots || "[]") as unknown;
    completedRoots = Array.isArray(roots) ? roots.filter((r): r is string => typeof r === "string") : [];
  } catch {
    completedRoots = [];
  }

  return {
    pendingDirs,
    pendingFiles,
    walkComplete: row.walk_complete === 1,
    discovered: Number(row.discovered) || 0,
    slowFs: row.slow_fs === 1,
    scopeKey: row.scope_key || "",
    completedRoots,
  };
}

function isPersistedIngestedFile(value: unknown): value is PersistedIngestedFile {
  if (typeof value !== "object" || value === null) return false;
  const f = value as PersistedIngestedFile;
  return (
    typeof f.path === "string" &&
    typeof f.relativePath === "string" &&
    typeof f.name === "string" &&
    typeof f.size === "number" &&
    typeof f.ext === "string" &&
    typeof f.hash === "string"
  );
}

export function saveWalkState(db: Database.Database, state: ByodWalkState): void {
  db.prepare(
    `INSERT INTO byod_walk (id, pending_dirs, pending_files, walk_complete, discovered, slow_fs, scope_key, completed_roots)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       pending_dirs = excluded.pending_dirs,
       pending_files = excluded.pending_files,
       walk_complete = excluded.walk_complete,
       discovered = excluded.discovered,
       slow_fs = excluded.slow_fs,
       scope_key = excluded.scope_key,
       completed_roots = excluded.completed_roots`
  ).run(
    JSON.stringify(state.pendingDirs),
    JSON.stringify(state.pendingFiles),
    state.walkComplete ? 1 : 0,
    state.discovered,
    state.slowFs ? 1 : 0,
    state.scopeKey,
    JSON.stringify(state.completedRoots)
  );
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

  if (existing && existing.file_hash === fileHash) {
    return;
  }

  const run = db.transaction(() => {
    if (existing) {
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
  });
  run();
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

/** Rebuild contentless byod_fts. COUNT(*) cannot detect a stale index. */
export function ensureByodFts(db: Database.Database): void {
  rebuildByodFts(db);
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
  chunkIndex: number;
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
      chunk_index: number;
    }[];

    if (rows.length === 0) return [];

    return rows.map((r) => ({
      title: r.title,
      snippet: r.snippet,
      fileName: r.file_name,
      filePath: r.file_path,
      chunkIndex: r.chunk_index,
    }));
  } catch {
    return [];
  }
}

export function searchByodIndex(
  db: Database.Database,
  searchTerm: string,
  limit = 20,
  pathPrefixes?: string[]
): SearchResult[] {
  // Try exact → prefix-wildcard → fuzzy OR, stopping at the first match
  const strategies = fts5QueryStrategy(searchTerm);
  if (strategies.length === 0) return [];

  const fetchLimit = pathPrefixes && pathPrefixes.length > 0 ? Math.max(limit * 4, 40) : limit;

  const stmt = db.prepare(`
    SELECT byod_fts.title, snippet(byod_fts, 1, '<mark>', '</mark>', '...', 64) AS snippet, byod_fts.file_name, byod_chunks.file_path, byod_chunks.chunk_index
    FROM byod_fts
    JOIN byod_chunks ON byod_chunks.id = byod_fts.rowid
    WHERE byod_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  for (const ftsMatch of strategies) {
    const results = tryFts5Query(db, stmt, ftsMatch, fetchLimit);
    const scoped =
      pathPrefixes && pathPrefixes.length > 0
        ? results.filter((r) => pathMatchesAnyPrefix(r.filePath, pathPrefixes))
        : results;
    if (scoped.length > 0) return scoped.slice(0, limit);
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
