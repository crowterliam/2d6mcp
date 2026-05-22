// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// 5E-COMPATIBLE SCOPE NOTICE:
// This file contains code that queries Open Game Content from the 5.2.1 SRD database.
// The code itself is AGPL-3.0-only. The data it retrieves is governed by CC-BY-4.0.
//
// This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1")
// by Wizards of the Coast LLC. Licensed under CC-BY-4.0.

import Database from "better-sqlite3";

function sanitizeFts5Query(term: string): string {
  return term.replace(/[*"()^]/g, "").trim();
}

export interface Sr5eSearchResult {
  title: string;
  snippet: string;
  section: string;
  topic: string | null;
}

export function search5ecompatibleRules(db: Database.Database, searchTerm: string): Sr5eSearchResult[] {
  const results: Sr5eSearchResult[] = [];

  const ftsQuery = db.prepare(`
    SELECT section, topic, snippet(sr5e_sections_fts, 1, '<mark>', '</mark>', '...', 40) AS snippet
    FROM sr5e_sections_fts
    WHERE sr5e_sections_fts MATCH ?
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
    // FTS5 may error on malformed queries; fall through
  }

  return results;
}

export interface Sr5eSpellResult {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  classes: string;
  description: string;
  higherLevel: string | null;
}

export function search5ecompatibleSpells(db: Database.Database, searchTerm: string): Sr5eSpellResult[] {
  const stmt = db.prepare(`
    SELECT name, level, school, casting_time, range, components, duration, classes, description, higher_level
    FROM sr5e_spells
    WHERE name LIKE ? OR school LIKE ? OR classes LIKE ? OR description LIKE ?
    ORDER BY level, name
    LIMIT 30
  `);
  const like = `%${searchTerm}%`;
  const rows = stmt.all(like, like, like, like) as {
    name: string; level: number; school: string; casting_time: string; range: string;
    components: string; duration: string; classes: string; description: string; higher_level: string | null;
  }[];
  return rows.map((r) => ({
    name: r.name,
    level: r.level,
    school: r.school,
    castingTime: r.casting_time,
    range: r.range,
    components: r.components,
    duration: r.duration,
    classes: r.classes,
    description: r.description,
    higherLevel: r.higher_level,
  }));
}

export interface Sr5eMonsterResult {
  name: string;
  size: string;
  type: string;
  alignment: string;
  ac: number;
  hp: string;
  speed: string;
  abilities: string;
  challengeRating: string;
  description: string;
}

export function search5ecompatibleMonsters(db: Database.Database, searchTerm: string): Sr5eMonsterResult[] {
  const stmt = db.prepare(`
    SELECT name, size, type, alignment, ac, hp, speed,
           strength, dexterity, constitution, intelligence, wisdom, charisma,
           challenge_rating, traits, actions, senses, languages
    FROM sr5e_monsters
    WHERE name LIKE ? OR type LIKE ? OR traits LIKE ? OR actions LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  const like = `%${searchTerm}%`;
  const rows = stmt.all(like, like, like, like) as {
    name: string; size: string; type: string; alignment: string; ac: number; hp: string; speed: string;
    strength: number; dexterity: number; constitution: number; intelligence: number; wisdom: number; charisma: number;
    challenge_rating: string; traits: string | null; actions: string | null; senses: string | null; languages: string | null;
  }[];
  return rows.map((r) => ({
    name: r.name,
    size: r.size,
    type: r.type,
    alignment: r.alignment,
    ac: r.ac,
    hp: r.hp,
    speed: r.speed,
    abilities: `STR ${r.strength} DEX ${r.dexterity} CON ${r.constitution} INT ${r.intelligence} WIS ${r.wisdom} CHA ${r.charisma}`,
    challengeRating: r.challenge_rating,
    description: [
      r.senses ? `Senses: ${r.senses}` : null,
      r.languages ? `Languages: ${r.languages}` : null,
      r.traits ? `Traits: ${r.traits}` : null,
      r.actions ? `Actions: ${r.actions}` : null,
    ].filter(Boolean).join("\n"),
  }));
}

export interface Sr5eClassResult {
  name: string;
  hitDie: string;
  primaryAbility: string;
  savingThrows: string;
  description: string;
}

export function search5ecompatibleClasses(db: Database.Database, searchTerm: string): Sr5eClassResult[] {
  const stmt = db.prepare(`
    SELECT name, hit_die, primary_ability, saving_throws, description
    FROM sr5e_classes
    WHERE name LIKE ? OR description LIKE ? OR primary_ability LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  const like = `%${searchTerm}%`;
  const rows = stmt.all(like, like, like) as {
    name: string; hit_die: string; primary_ability: string; saving_throws: string; description: string;
  }[];
  return rows.map((r) => ({
    name: r.name,
    hitDie: r.hit_die,
    primaryAbility: r.primary_ability,
    savingThrows: r.saving_throws,
    description: r.description,
  }));
}

export interface Sr5eFeatResult {
  name: string;
  prerequisite: string;
  description: string;
}

export function search5ecompatibleFeats(db: Database.Database, searchTerm: string): Sr5eFeatResult[] {
  const stmt = db.prepare(`
    SELECT name, prerequisite, description
    FROM sr5e_feats
    WHERE name LIKE ? OR description LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  const like = `%${searchTerm}%`;
  return stmt.all(like, like) as Sr5eFeatResult[];
}

export function list5ecompatibleSpells(db: Database.Database): { name: string; level: number; school: string }[] {
  return db.prepare("SELECT name, level, school FROM sr5e_spells ORDER BY level, name").all() as {
    name: string; level: number; school: string;
  }[];
}

export function list5ecompatibleMonsters(db: Database.Database): { name: string; type: string; challenge_rating: string }[] {
  return db.prepare("SELECT name, type, challenge_rating FROM sr5e_monsters ORDER BY name").all() as {
    name: string; type: string; challenge_rating: string;
  }[];
}

export function list5ecompatibleClasses(db: Database.Database): { name: string; hit_die: string; primary_ability: string }[] {
  return db.prepare("SELECT name, hit_die, primary_ability FROM sr5e_classes ORDER BY name").all() as {
    name: string; hit_die: string; primary_ability: string;
  }[];
}

export function list5ecompatibleFeats(db: Database.Database): { name: string; prerequisite: string | null }[] {
  return db.prepare("SELECT name, prerequisite FROM sr5e_feats ORDER BY name").all() as {
    name: string; prerequisite: string | null;
  }[];
}
