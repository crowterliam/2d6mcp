// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import Database from "better-sqlite3";
import { fts5QueryStrategy, searchWithFuzzyFallback } from "@2d6mcp/shared";

export interface OsrSearchResult {
  title: string;
  snippet: string;
  section: string;
  subsection: string | null;
}

export function searchOsrRules(db: Database.Database, searchTerm: string): OsrSearchResult[] {
  const results: OsrSearchResult[] = [];

  const ftsQuery = db.prepare(`
    SELECT section, subsection, snippet(osr_core_rules_fts, 1, '<mark>', '</mark>', '...', 40) AS snippet
    FROM osr_core_rules_fts
    WHERE osr_core_rules_fts MATCH ?
    ORDER BY rank
    LIMIT 20
  `);

  for (const ftsMatch of fts5QueryStrategy(searchTerm)) {
    try {
      const rows = ftsQuery.all(ftsMatch) as { section: string; subsection: string | null; snippet: string }[];
      for (const row of rows) {
        results.push({
          title: row.subsection || row.section,
          snippet: row.snippet,
          section: row.section,
          subsection: row.subsection,
        });
      }
      if (results.length > 0) return results;
    } catch {
      // FTS5 may error on malformed queries; try next strategy
    }
  }

  return results;
}

export interface OsrProcedureResult {
  topic: string;
  content: string;
  category: string;
}

export function searchOsrProcedures(
  db: Database.Database,
  searchTerm: string,
  category?: string
): OsrProcedureResult[] {
  if (category) {
    const stmt = db.prepare(`
      SELECT topic, content, category
      FROM osr_procedures
      WHERE category = ? AND (topic LIKE ? OR content LIKE ?)
      ORDER BY topic
      LIMIT 30
    `);
    return searchWithFuzzyFallback(
      searchTerm,
      (term) => stmt.all(category, `%${term}%`, `%${term}%`) as OsrProcedureResult[],
      (r) => `${r.category}:${r.topic}`,
    );
  }

  const stmt = db.prepare(`
    SELECT topic, content, category
    FROM osr_procedures
    WHERE topic LIKE ? OR content LIKE ? OR category LIKE ?
    ORDER BY category, topic
    LIMIT 30
  `);
  return searchWithFuzzyFallback(
    searchTerm,
    (term) => stmt.all(`%${term}%`, `%${term}%`, `%${term}%`) as OsrProcedureResult[],
    (r) => `${r.category}:${r.topic}`,
  );
}

export function searchOsrTables(
  db: Database.Database,
  tableName: string
): {
  name: string;
  description: string | null;
  diceType: string;
  entries: { min: number; max: number; result: string }[];
} | null {
  const metaStmt = db.prepare(`
    SELECT DISTINCT name, description, dice_type FROM osr_tables WHERE name = ? COLLATE NOCASE
  `);
  const meta = metaStmt.get(tableName) as { name: string; description: string | null; dice_type: string } | undefined;

  if (!meta) {
    const fuzzyStmt = db.prepare(`
      SELECT DISTINCT name, description, dice_type FROM osr_tables WHERE name LIKE ? ORDER BY name LIMIT 1
    `);
    const fuzzy = fuzzyStmt.get(`%${tableName}%`) as
      | { name: string; description: string | null; dice_type: string }
      | undefined;
    if (!fuzzy) return null;
    return loadOsrTableEntries(db, fuzzy);
  }

  return loadOsrTableEntries(db, meta);
}

function loadOsrTableEntries(
  db: Database.Database,
  meta: { name: string; description: string | null; dice_type: string }
): {
  name: string;
  description: string | null;
  diceType: string;
  entries: { min: number; max: number; result: string }[];
} {
  const entryStmt = db.prepare(`
    SELECT min_roll, max_roll, result FROM osr_tables WHERE name = ? ORDER BY min_roll
  `);
  const entries = entryStmt.all(meta.name) as { min_roll: number; max_roll: number; result: string }[];

  return {
    name: meta.name,
    description: meta.description,
    diceType: meta.dice_type,
    entries: entries.map((e) => ({ min: e.min_roll, max: e.max_roll, result: e.result })),
  };
}

export function listOsrCategories(db: Database.Database): { name: string; description: string }[] {
  return db.prepare("SELECT name, description FROM osr_categories ORDER BY name").all() as {
    name: string;
    description: string;
  }[];
}

export function listOsrTables(
  db: Database.Database
): { name: string; description: string | null; entryCount: number }[] {
  return db
    .prepare(
      "SELECT name, description, COUNT(*) as entryCount FROM osr_tables GROUP BY name ORDER BY name"
    )
    .all() as { name: string; description: string | null; entryCount: number }[];
}

export function listOsrProcedureCategories(db: Database.Database): string[] {
  const rows = db.prepare("SELECT DISTINCT category FROM osr_procedures ORDER BY category").all() as {
    category: string;
  }[];
  return rows.map((r) => r.category);
}
