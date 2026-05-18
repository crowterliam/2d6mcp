import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PROJECT_ROOT } from "../config.js";

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
  chunks: { title: string; content: string; chunkIndex: number }[]
): void {
  const insertFile = db.prepare(`
    INSERT OR REPLACE INTO byod_files (relative_path, file_name, ext, size, ingested_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  const existing = db
    .prepare("SELECT id FROM byod_files WHERE relative_path = ?")
    .get(filePath) as { id: number } | undefined;

  let fileId: number;

  if (existing) {
    fileId = existing.id;
    db.prepare("DELETE FROM byod_chunks WHERE file_id = ?").run(fileId);
  }

  const result = insertFile.run(filePath, fileName, ext, size);
  fileId = Number(result.lastInsertRowid);

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

export function searchByodIndex(
  db: Database.Database,
  searchTerm: string,
  limit = 10
): { title: string; snippet: string; fileName: string; filePath: string }[] {
  const stmt = db.prepare(`
    SELECT title, snippet(byod_fts, 1, '<mark>', '</mark>', '...', 40) AS snippet, file_name, file_path
    FROM byod_fts
    WHERE byod_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  try {
    const rows = stmt.all(searchTerm, limit) as {
      title: string;
      snippet: string;
      file_name: string;
      file_path: string;
    }[];
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

export function closeByodDatabase(): void {
  if (byodDb) {
    byodDb.close();
    byodDb = null;
  }
}
