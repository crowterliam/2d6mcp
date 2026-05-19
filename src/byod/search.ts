// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PROJECT_ROOT } from "../config.js";

function sanitizeFts5Query(term: string): string {
  let cleaned = term.replace(/[\x00-\x1F\x7F]/g, "").trim();
  if (!cleaned) return "";

  cleaned = cleaned.replace(/"(?:(?!").)*"/g, (m) => m);

  const outsideQuotes = cleaned.replace(/"(?:(?!").)*"/g, "");
  if (outsideQuotes.includes("*")) {
    cleaned = cleaned
      .replace(/(\S)\*+/g, "$1*")
      .replace(/\*(\S)/g, "* $1");
  }

  cleaned = cleaned.replace(/[()^]/g, "");

  return cleaned.trim();
}

const BYOD_DB_NAME = "byod_index.db";

function getByodDbPath(): string {
  const byodDir = resolve(PROJECT_ROOT, "data", "byod");
  if (!existsSync(byodDir)) {
    mkdirSync(byodDir, { recursive: true });
  }
  return resolve(byodDir, BYOD_DB_NAME);
}

let byodDb: Database.Database | null = null;

export function getByodDatabase(): Database.Database {
  if (byodDb) return byodDb;

  const dbPath = getByodDbPath();
  byodDb = new Database(dbPath);
  byodDb.pragma("journal_mode = WAL");

  byodDb.exec(`
    CREATE TABLE IF NOT EXISTS byod_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      relative_path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      ext TEXT,
      size INTEGER,
      ingested_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const cols = byodDb
    .prepare("PRAGMA table_info(byod_files)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "file_hash")) {
    byodDb.exec("ALTER TABLE byod_files ADD COLUMN file_hash TEXT;");
  }

  byodDb.exec(`
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

  return byodDb;
}

export function indexChunks(
  db: Database.Database,
  filePath: string,
  fileName: string,
  ext: string,
  size: number,
  fileHash: string,
  chunks: { title: string; content: string; chunkIndex: number }[]
): void {
  const insertFile = db.prepare(`
    INSERT OR REPLACE INTO byod_files (relative_path, file_name, ext, size, file_hash, ingested_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
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

  const result = insertFile.run(filePath, fileName, ext, size, fileHash);
  const fileId = Number(result.lastInsertRowid);

  const insertChunk = db.prepare(`
    INSERT INTO byod_chunks (file_id, file_path, file_name, title, content, chunk_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const chunk of chunks) {
    insertChunk.run(fileId, filePath, fileName, chunk.title, chunk.content, chunk.chunkIndex);
  }
}

export function rebuildByodFts(db: Database.Database): void {
  db.exec(`INSERT INTO byod_fts(byod_fts) VALUES ('rebuild');`);
}

export function hasIndexedFiles(db: Database.Database): boolean {
  const row = db.prepare("SELECT COUNT(*) AS cnt FROM byod_files").get() as { cnt: number };
  return row.cnt > 0;
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

function tokenizeForOr(safeTerm: string): string | null {
  const tokens = safeTerm
    .split(/\s+/)
    .map((t) => sanitizeFts5Query(t).trim())
    .filter((t) => t.length > 0);

  if (tokens.length < 3) return null;

  return tokens.join(" OR ");
}

export function searchByodIndex(
  db: Database.Database,
  searchTerm: string,
  limit = 20
): SearchResult[] {
  const safeTerm = sanitizeFts5Query(searchTerm);
  if (!safeTerm) return [];

  const stmt = db.prepare(`
    SELECT byod_fts.title, snippet(byod_fts, 1, '<mark>', '</mark>', '...', 64) AS snippet, byod_fts.file_name, byod_chunks.file_path
    FROM byod_fts
    JOIN byod_chunks ON byod_chunks.id = byod_fts.rowid
    WHERE byod_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  let results = tryFts5Query(db, stmt, safeTerm, limit);
  if (results.length > 0) return results;

  const orQuery = tokenizeForOr(safeTerm);
  if (orQuery) {
    results = tryFts5Query(db, stmt, orQuery, limit);
  }

  return results;
}

export function closeByodDatabase(): void {
  if (byodDb) {
    byodDb.close();
    byodDb = null;
  }
}
