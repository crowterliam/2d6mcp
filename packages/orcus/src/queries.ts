// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// OGL SCOPE NOTICE:
// This file contains code that queries Open Game Content from the Orcus retro-clone
// database. The code itself is AGPL-3.0-only. The data it retrieves is governed by OGL v1.0a.

import Database from "better-sqlite3";

function sanitizeFts5Query(term: string): string {
  return term.replace(/[*"()^]/g, "").trim();
}

export interface OrcusSearchResult {
  title: string;
  snippet: string;
  section: string;
  topic: string | null;
}

export function searchOrcusRules(db: Database.Database, searchTerm: string): OrcusSearchResult[] {
  const results: OrcusSearchResult[] = [];

  const ftsQuery = db.prepare(`
    SELECT section, topic, snippet(orcus_sections_fts, 1, '<mark>', '</mark>', '...', 40) AS snippet
    FROM orcus_sections_fts
    WHERE orcus_sections_fts MATCH ?
    ORDER BY rank
    LIMIT 20
  `);

  const safeTerm = sanitizeFts5Query(searchTerm);
  if (!safeTerm) return [];

  try {
    const rows = ftsQuery.all(safeTerm) as { section: string; topic: string | null; snippet: string }[];
    for (const row of rows) {
      results.push({
        title: row.topic || row.section,
        snippet: row.snippet,
        section: row.section,
        topic: row.topic,
      });
    }
  } catch {
    // FTS5 may error on malformed queries
  }

  return results;
}

export interface OrcusClassResult {
  name: string;
  tradition: string;
  role: string;
  keyAbility: string;
  hitPoints: string;
  recoveries: string;
  defenses: string;
  armorProficiencies: string;
  weaponProficiencies: string;
  trainedSkills: string;
  talents: string;
  features: string;
  description: string;
}

export function searchOrcusClasses(db: Database.Database, searchTerm: string): OrcusClassResult[] {
  const stmt = db.prepare(`
    SELECT name, tradition, role, key_ability, hit_points, recoveries, defenses,
           armor_proficiencies, weapon_proficiencies, trained_skills, talents, features, description
    FROM orcus_classes
    WHERE name LIKE ? OR tradition LIKE ? OR role LIKE ? OR key_ability LIKE ? OR description LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  const like = `%${searchTerm}%`;
  const rows = stmt.all(like, like, like, like, like) as {
    name: string; tradition: string; role: string; key_ability: string;
    hit_points: string; recoveries: string; defenses: string;
    armor_proficiencies: string; weapon_proficiencies: string;
    trained_skills: string; talents: string; features: string; description: string;
  }[];
  return rows.map((r) => ({
    name: r.name,
    tradition: r.tradition,
    role: r.role,
    keyAbility: r.key_ability,
    hitPoints: r.hit_points,
    recoveries: r.recoveries,
    defenses: r.defenses,
    armorProficiencies: r.armor_proficiencies,
    weaponProficiencies: r.weapon_proficiencies,
    trainedSkills: r.trained_skills,
    talents: r.talents,
    features: r.features,
    description: r.description,
  }));
}

export interface OrcusMonsterResult {
  name: string;
  levelInfo: string;
  size: string;
  originType: string;
  alignment: string;
  hp: string;
  ac: number;
  defenses: string;
  speed: string;
  description: string;
}

export function searchOrcusMonsters(db: Database.Database, searchTerm: string): OrcusMonsterResult[] {
  const stmt = db.prepare(`
    SELECT name, level_info, size, origin_type, alignment, hp, ac,
           fort, ref, will, speed, resistances, vulnerabilities, immunities,
           traits, actions, senses, description
    FROM orcus_monsters
    WHERE name LIKE ? OR origin_type LIKE ? OR alignment LIKE ? OR traits LIKE ? OR actions LIKE ?
    ORDER BY name
    LIMIT 30
  `);
  const like = `%${searchTerm}%`;
  const rows = stmt.all(like, like, like, like, like) as {
    name: string; level_info: string; size: string; origin_type: string;
    alignment: string; hp: string; ac: number; fort: number; ref: number; will: number;
    speed: string; resistances: string | null; vulnerabilities: string | null;
    immunities: string | null; traits: string | null; actions: string | null;
    senses: string | null; description: string;
  }[];
  return rows.map((r) => ({
    name: r.name,
    levelInfo: r.level_info,
    size: r.size,
    originType: r.origin_type,
    alignment: r.alignment,
    hp: r.hp,
    ac: r.ac,
    defenses: `Fort ${r.fort}, Ref ${r.ref}, Will ${r.will}`,
    speed: r.speed,
    description: [
      r.senses ? `Senses: ${r.senses}` : null,
      r.resistances ? `Resist: ${r.resistances}` : null,
      r.vulnerabilities ? `Vulnerable: ${r.vulnerabilities}` : null,
      r.immunities ? `Immune: ${r.immunities}` : null,
      r.traits ? `Traits: ${r.traits}` : null,
      r.actions ? `Actions: ${r.actions}` : null,
    ].filter(Boolean).join("\n"),
  }));
}

export interface OrcusFeatResult {
  name: string;
  prerequisite: string;
  category: string;
  description: string;
}

export function searchOrcusFeats(db: Database.Database, searchTerm: string): OrcusFeatResult[] {
  const stmt = db.prepare(`
    SELECT name, prerequisite, category, description
    FROM orcus_feats
    WHERE name LIKE ? OR description LIKE ? OR category LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  const like = `%${searchTerm}%`;
  return stmt.all(like, like, like) as OrcusFeatResult[];
}

export function listOrcusClasses(db: Database.Database): { name: string; tradition: string; role: string }[] {
  return db.prepare("SELECT name, tradition, role FROM orcus_classes ORDER BY name").all() as {
    name: string; tradition: string; role: string;
  }[];
}

export function listOrcusMonsters(db: Database.Database): { name: string; level_info: string; origin_type: string }[] {
  return db.prepare("SELECT name, level_info, origin_type FROM orcus_monsters ORDER BY name").all() as {
    name: string; level_info: string; origin_type: string;
  }[];
}

export function listOrcusFeats(db: Database.Database): { name: string; category: string; prerequisite: string | null }[] {
  return db.prepare("SELECT name, category, prerequisite FROM orcus_feats ORDER BY name").all() as {
    name: string; category: string; prerequisite: string | null;
  }[];
}
