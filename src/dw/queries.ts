// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// DW SCOPE NOTICE:
// This file contains code that queries game content derived from Dungeon World
// by Sage LaTorra and Adam Koebel (converted to Markdown by agude), licensed
// under CC-BY-3.0. The code itself is AGPL-3.0-only. The data it retrieves is
// governed by the Creative Commons Attribution 3.0 Unported License.

import Database from "better-sqlite3";

function sanitizeFts5Query(term: string): string {
  return term.replace(/[*"()^]/g, "").trim();
}

export interface DwMove {
  name: string;
  description: string;
  stat: string | null;
  category: string;
  on_success: string | null;
  on_partial: string | null;
  on_miss: string | null;
  source_class: string | null;
}

export interface DwClass {
  name: string;
  description: string | null;
  base_hp: number | null;
  base_damage: string | null;
  names: string | null;
  look: string | null;
  stats: string | null;
  alignment: string | null;
  bonds: string | null;
  starting_moves: string | null;
  advanced_moves: string | null;
}

export interface DwSpell {
  name: string;
  level: string;
  spell_class: string;
  tags: string | null;
  description: string;
}

export interface DwEquipment {
  name: string;
  category: string;
  tags: string | null;
  cost: string | null;
  weight: string | null;
  damage: string | null;
  armor: number | null;
  description: string | null;
}

export interface DwMonster {
  name: string;
  tags: string | null;
  damage: string | null;
  hp: number;
  armor: number;
  attack_tags: string | null;
  special_qualities: string | null;
  description: string | null;
  instinct: string | null;
  moves: string | null;
  source_setting: string;
}

export interface DwGmTool {
  topic: string;
  content: string;
  category: string | null;
}

export interface DwSearchResult {
  title: string;
  snippet: string;
  section: string;
  subsection: string | null;
}

export function searchDwRules(db: Database.Database, searchTerm: string): DwSearchResult[] {
  const safeTerm = sanitizeFts5Query(searchTerm);
  if (!safeTerm) return [];

  const stmt = db.prepare(`
    SELECT section_title, subsection_title, snippet(dw_sections_fts, 0, '<mark>', '</mark>', '...', 40) AS snippet
    FROM dw_sections_fts
    WHERE dw_sections_fts MATCH ?
    ORDER BY rank
    LIMIT 20
  `);

  try {
    const rows = stmt.all(safeTerm) as { section_title: string; subsection_title: string | null; snippet: string }[];
    return rows.map((r) => ({
      title: r.subsection_title || r.section_title,
      snippet: r.snippet,
      section: r.section_title,
      subsection: r.subsection_title,
    }));
  } catch {
    return [];
  }
}

export function searchDwMoves(db: Database.Database, searchTerm: string): DwMove[] {
  const like = `%${searchTerm}%`;
  return db.prepare(
    "SELECT name, description, stat, category, on_success, on_partial, on_miss, source_class FROM dw_moves WHERE name LIKE ? OR description LIKE ? OR category LIKE ? ORDER BY category, name LIMIT 20"
  ).all(like, like, like) as DwMove[];
}

export function searchDwClasses(db: Database.Database, searchTerm: string): DwClass[] {
  const like = `%${searchTerm}%`;
  return db.prepare(
    "SELECT name, description, base_hp, base_damage, names, look, stats, alignment, bonds, starting_moves, advanced_moves FROM dw_classes WHERE name LIKE ? OR description LIKE ? ORDER BY name LIMIT 20"
  ).all(like, like) as DwClass[];
}

export function searchDwSpells(db: Database.Database, searchTerm: string): DwSpell[] {
  const like = `%${searchTerm}%`;
  return db.prepare(
    "SELECT name, level, spell_class, tags, description FROM dw_spells WHERE name LIKE ? OR description LIKE ? OR spell_class LIKE ? ORDER BY level, name LIMIT 30"
  ).all(like, like, like) as DwSpell[];
}

export function searchDwEquipment(db: Database.Database, searchTerm: string): DwEquipment[] {
  const like = `%${searchTerm}%`;
  return db.prepare(
    "SELECT name, category, tags, cost, weight, damage, armor, description FROM dw_equipment WHERE name LIKE ? OR category LIKE ? OR tags LIKE ? OR description LIKE ? ORDER BY category, name LIMIT 30"
  ).all(like, like, like, like) as DwEquipment[];
}

export function searchDwMonsters(db: Database.Database, searchTerm: string): DwMonster[] {
  const like = `%${searchTerm}%`;
  return db.prepare(
    "SELECT name, tags, damage, hp, armor, attack_tags, special_qualities, description, instinct, moves, source_setting FROM dw_monsters WHERE name LIKE ? OR tags LIKE ? OR instinct LIKE ? OR source_setting LIKE ? ORDER BY source_setting, name LIMIT 30"
  ).all(like, like, like, like) as DwMonster[];
}

export function searchDwGmTools(db: Database.Database, searchTerm: string): DwGmTool[] {
  const like = `%${searchTerm}%`;
  return db.prepare(
    "SELECT topic, content, category FROM dw_gm_tools WHERE topic LIKE ? OR content LIKE ? OR category LIKE ? ORDER BY category, topic LIMIT 30"
  ).all(like, like, like) as DwGmTool[];
}

export function listDwMoveCategories(db: Database.Database): { category: string; count: number }[] {
  return db.prepare(
    "SELECT category, COUNT(*) as count FROM dw_moves GROUP BY category ORDER BY category"
  ).all() as { category: string; count: number }[];
}

export function listDwMonsterSettings(db: Database.Database): { source_setting: string; count: number }[] {
  return db.prepare(
    "SELECT source_setting, COUNT(*) as count FROM dw_monsters GROUP BY source_setting ORDER BY source_setting"
  ).all() as { source_setting: string; count: number }[];
}
