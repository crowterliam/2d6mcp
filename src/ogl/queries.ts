import Database from "better-sqlite3";

export interface RuleSearchResult {
  title: string;
  snippet: string;
  section: string;
  subsection: string | null;
}

export function searchOglRules(db: Database.Database, searchTerm: string): RuleSearchResult[] {
  const results: RuleSearchResult[] = [];

  const ftsQuery = db.prepare(`
    SELECT section, subsection, snippet(core_rules_fts, 1, '<mark>', '</mark>', '...', 40) AS snippet
    FROM core_rules_fts
    WHERE core_rules_fts MATCH ?
    ORDER BY rank
    LIMIT 20
  `);

  try {
    const rows = ftsQuery.all(searchTerm) as { section: string; subsection: string | null; snippet: string }[];
    for (const row of rows) {
      results.push({
        title: row.subsection || row.section,
        snippet: row.snippet,
        section: row.section,
        subsection: row.subsection,
      });
    }
  } catch {
    // FTS5 may error on malformed queries; fall through
  }

  return results;
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
  const like = `%${searchTerm}%`;
  return stmt.all(like, like) as { name: string; description: string; characteristic: string }[];
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
  const like = `%${searchTerm}%`;
  return stmt.all(like, like) as { name: string; description: string; qualification: string }[];
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
  const like = `%${searchTerm}%`;
  const rows = stmt.all(like, like, like) as { name: string; category: string; tech_level: number; cost: string; description: string }[];
  return rows.map((r) => ({
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
  const like = `%${searchTerm}%`;
  return db.prepare(
    "SELECT topic, content, category FROM combat WHERE topic LIKE ? OR content LIKE ? OR category LIKE ? ORDER BY category, topic LIMIT 20"
  ).all(like, like, like) as { topic: string; content: string; category: string }[];
}

export function searchShipOps(db: Database.Database, searchTerm: string): { topic: string; content: string; category: string }[] {
  const like = `%${searchTerm}%`;
  return db.prepare(
    "SELECT topic, content, category FROM starship_operations WHERE topic LIKE ? OR content LIKE ? OR category LIKE ? ORDER BY category, topic LIMIT 20"
  ).all(like, like, like) as { topic: string; content: string; category: string }[];
}

export function searchWorldBuilding(db: Database.Database, searchTerm: string): { topic: string; content: string; category: string }[] {
  const like = `%${searchTerm}%`;
  return db.prepare(
    "SELECT topic, content, category FROM world_building WHERE topic LIKE ? OR content LIKE ? OR category LIKE ? ORDER BY category, topic LIMIT 20"
  ).all(like, like, like) as { topic: string; content: string; category: string }[];
}
