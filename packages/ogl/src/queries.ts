// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// OGL SCOPE NOTICE:
// This file contains code that queries Open Game Content from the OGL database.
// The code itself is AGPL-3.0-only. The data it retrieves is governed by the
// Open Game License v1.0a.

import Database from "better-sqlite3";
import { deduplicateBy, fts5QueryStrategy, searchWithFuzzyFallback } from "@2d6mcp/shared";

export const OGL_TRADE_SECTION = "Trade & Commerce";

export interface RuleSearchResult {
  title: string;
  snippet: string;
  section: string;
  subsection: string | null;
}

export interface SearchOglRulesOptions {
  /** Restrict FTS hits to this core_rules.section (for example "Trade & Commerce"). */
  section?: string;
}

function titleMatchScore(term: string, row: RuleSearchResult): number {
  const title = row.title.toLowerCase();
  const section = row.section.toLowerCase();
  const sub = (row.subsection ?? "").toLowerCase();
  if (title === term || sub === term) return 100;
  if (title.includes(term) || sub.includes(term)) return 50;
  if (section.includes(term)) return 25;
  return 0;
}

function rankRuleHits(searchTerm: string, rows: RuleSearchResult[]): RuleSearchResult[] {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return rows;
  return rows
    .map((row, index) => ({ row, index, score: titleMatchScore(term, row) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.row);
}

function rowsToResults(
  rows: { section: string; subsection: string | null; snippet: string }[]
): RuleSearchResult[] {
  return rows.map((row) => ({
    title: row.subsection || row.section,
    snippet: row.snippet,
    section: row.section,
    subsection: row.subsection,
  }));
}

export function searchOglRules(
  db: Database.Database,
  searchTerm: string,
  options?: SearchOglRulesOptions
): RuleSearchResult[] {
  const section = options?.section;
  const ftsQuery = section
    ? db.prepare(`
        SELECT section, subsection, snippet(core_rules_fts, 2, '<mark>', '</mark>', '...', 40) AS snippet
        FROM core_rules_fts
        WHERE core_rules_fts MATCH ?
          AND section = ?
        ORDER BY bm25(core_rules_fts, 5.0, 15.0, 1.0)
        LIMIT 20
      `)
    : db.prepare(`
        SELECT section, subsection, snippet(core_rules_fts, 2, '<mark>', '</mark>', '...', 40) AS snippet
        FROM core_rules_fts
        WHERE core_rules_fts MATCH ?
        ORDER BY bm25(core_rules_fts, 5.0, 15.0, 1.0)
        LIMIT 20
      `);

  // Try exact → prefix-wildcard → fuzzy OR, stopping at the first match
  for (const ftsMatch of fts5QueryStrategy(searchTerm)) {
    try {
      const rows = (
        section ? ftsQuery.all(ftsMatch, section) : ftsQuery.all(ftsMatch)
      ) as { section: string; subsection: string | null; snippet: string }[];
      const results = rankRuleHits(searchTerm, rowsToResults(rows));
      if (results.length > 0) return results;
    } catch {
      // FTS5 may error on malformed queries; try next strategy
    }
  }

  return [];
}

function listCoreSection(db: Database.Database, section: string): RuleSearchResult[] {
  const rows = db
    .prepare(
      "SELECT section, subsection, content AS snippet FROM core_rules WHERE section = ? ORDER BY subsection"
    )
    .all(section) as { section: string; subsection: string | null; snippet: string }[];
  return rowsToResults(rows);
}

function collectTradeExtras(db: Database.Database, like: string): RuleSearchResult[] {
  const shipRows = db
    .prepare(
      `SELECT topic, content, category
       FROM starship_operations
       WHERE (
         category IN ('Trade & Commerce', 'Passage', 'Economy')
         OR topic LIKE '%Trade%'
         OR topic LIKE '%Passenger%'
         OR topic LIKE '%Mail%'
       )
       AND (topic LIKE ? OR content LIKE ? OR category LIKE ?)
       ORDER BY category, topic
       LIMIT 20`
    )
    .all(like, like, like) as { topic: string; content: string; category: string }[];

  const worldRows = db
    .prepare(
      `SELECT topic, content, category
       FROM world_building
       WHERE (topic LIKE '%Trade%' OR topic LIKE '%Freight%' OR topic LIKE '%Cargo%' OR topic LIKE '%Route%')
         AND (topic LIKE ? OR content LIKE ? OR category LIKE ?)
       ORDER BY topic
       LIMIT 20`
    )
    .all(like, like, like) as { topic: string; content: string; category: string }[];

  return [...shipRows, ...worldRows].map((row) => ({
    title: row.topic,
    snippet: row.content,
    section: row.category,
    subsection: row.topic,
  }));
}

/**
 * Trade & Commerce lookup: core trade sections plus related ship/world rows
 * (passage, freight revenue, trade codes/routes). Does not invent commercial
 * freight-lot matrices that are absent from the Open SRD.
 */
export function searchOglTrade(db: Database.Database, searchTerm: string): RuleSearchResult[] {
  const term = searchTerm.trim();
  const core = term
    ? searchOglRules(db, term, { section: OGL_TRADE_SECTION })
    : listCoreSection(db, OGL_TRADE_SECTION);
  const like = term ? `%${term}%` : "%";
  const extras = collectTradeExtras(db, like);
  const merged = deduplicateBy([...core, ...extras], (row) => `${row.section}:${row.title}`);
  return rankRuleHits(term, merged).slice(0, 20);
}

export function searchOglTables(
  db: Database.Database,
  tableName: string
): {
  name: string;
  description: string | null;
  diceType: string;
  entries: { min: number; max: number; result: string }[];
} | null {
  const metaStmt = db.prepare(`
    SELECT DISTINCT name, description, dice_type FROM tables_2d6 WHERE name = ?
  `);
  const meta = metaStmt.get(tableName) as { name: string; description: string | null; dice_type: string } | undefined;

  if (!meta) return null;

  const entryStmt = db.prepare(`
    SELECT min_roll, max_roll, result FROM tables_2d6 WHERE name = ? ORDER BY min_roll
  `);
  const entries = entryStmt.all(tableName) as { min_roll: number; max_roll: number; result: string }[];

  return {
    name: meta.name,
    description: meta.description,
    diceType: meta.dice_type,
    entries: entries.map((e) => ({ min: e.min_roll, max: e.max_roll, result: e.result })),
  };
}

export function searchOglSkills(
  db: Database.Database,
  searchTerm: string
): { name: string; description: string; characteristic: string }[] {
  const stmt = db.prepare(`
    SELECT name, description, characteristic
    FROM skills
    WHERE name LIKE ? OR description LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  return searchWithFuzzyFallback(searchTerm, (term) =>
    stmt.all(`%${term}%`, `%${term}%`) as { name: string; description: string; characteristic: string }[]
  );
}

export function searchOglCareers(
  db: Database.Database,
  searchTerm: string
): { name: string; description: string; qualification: string }[] {
  const stmt = db.prepare(`
    SELECT name, description, qualification
    FROM careers
    WHERE name LIKE ? OR description LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  return searchWithFuzzyFallback(searchTerm, (term) =>
    stmt.all(`%${term}%`, `%${term}%`) as { name: string; description: string; qualification: string }[]
  );
}

export function searchOglEquipment(
  db: Database.Database,
  searchTerm: string
): { name: string; category: string; techLevel: number; cost: string; description: string }[] {
  const stmt = db.prepare(`
    SELECT name, category, tech_level, cost, description
    FROM equipment
    WHERE name LIKE ? OR category LIKE ? OR description LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  return searchWithFuzzyFallback(
    searchTerm,
    (term) =>
      stmt.all(`%${term}%`, `%${term}%`, `%${term}%`) as {
        name: string; category: string; tech_level: number; cost: string; description: string;
      }[],
    (r) => r.name,
  ).map((r) => ({
    name: r.name,
    category: r.category,
    techLevel: r.tech_level,
    cost: r.cost,
    description: r.description,
  }));
}

export function listOglCategories(db: Database.Database): { name: string; description: string }[] {
  return db.prepare("SELECT name, description FROM rules_categories ORDER BY name").all() as {
    name: string;
    description: string;
  }[];
}

export function listOglTables(db: Database.Database): { name: string; description: string | null; entryCount: number }[] {
  return db
    .prepare(
      "SELECT name, description, COUNT(*) as entryCount FROM tables_2d6 GROUP BY name ORDER BY name"
    )
    .all() as { name: string; description: string | null; entryCount: number }[];
}

export function searchCombat(db: Database.Database, searchTerm: string): { topic: string; content: string; category: string }[] {
  const stmt = db.prepare(
    "SELECT topic, content, category FROM combat WHERE topic LIKE ? OR content LIKE ? OR category LIKE ? ORDER BY category, topic LIMIT 20"
  );
  return searchWithFuzzyFallback(searchTerm, (term) =>
    stmt.all(`%${term}%`, `%${term}%`, `%${term}%`) as { topic: string; content: string; category: string }[],
    (r) => `${r.category}:${r.topic}`,
  );
}

export function searchShipOps(db: Database.Database, searchTerm: string): { topic: string; content: string; category: string }[] {
  const stmt = db.prepare(
    "SELECT topic, content, category FROM starship_operations WHERE topic LIKE ? OR content LIKE ? OR category LIKE ? ORDER BY category, topic LIMIT 20"
  );
  return searchWithFuzzyFallback(searchTerm, (term) =>
    stmt.all(`%${term}%`, `%${term}%`, `%${term}%`) as { topic: string; content: string; category: string }[],
    (r) => `${r.category}:${r.topic}`,
  );
}

export function searchWorldBuilding(db: Database.Database, searchTerm: string): { topic: string; content: string; category: string }[] {
  const stmt = db.prepare(
    "SELECT topic, content, category FROM world_building WHERE topic LIKE ? OR content LIKE ? OR category LIKE ? ORDER BY category, topic LIMIT 20"
  );
  return searchWithFuzzyFallback(searchTerm, (term) =>
    stmt.all(`%${term}%`, `%${term}%`, `%${term}%`) as { topic: string; content: string; category: string }[],
    (r) => `${r.category}:${r.topic}`,
  );
}
