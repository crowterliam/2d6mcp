// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// BRP SCOPE NOTICE:
// This file contains code that queries Open Game Content from the BRP database.
// The code itself is AGPL-3.0-only. The data it retrieves is governed by the
// BRP Open Game License v1.0.
//
// This work created using the BRP Open Game License.
// BRP Open Game License v 1.0 (c) copyright 2020 Chaosium Inc.
// Basic Roleplaying (c) copyright 1980-2020 Chaosium Inc.
// Basic Roleplaying and the BRP logo are trademarks of Chaosium Inc.
// Used with permission.

import Database from "better-sqlite3";
import { fts5QueryStrategy, searchWithFuzzyFallback } from "@2d6mcp/shared";

export interface BrpSearchResult {
  title: string;
  snippet: string;
  section: string;
  subsection: string | null;
}

export function searchBrpRules(db: Database.Database, searchTerm: string): BrpSearchResult[] {
  const results: BrpSearchResult[] = [];

  const ftsQuery = db.prepare(`
    SELECT section, subsection, snippet(brp_core_rules_fts, 1, '<mark>', '</mark>', '...', 40) AS snippet
    FROM brp_core_rules_fts
    WHERE brp_core_rules_fts MATCH ?
    ORDER BY rank
    LIMIT 20
  `);

  // Try exact → prefix-wildcard → fuzzy OR, stopping at the first match
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

export interface CharacteristicResult {
  name: string;
  abbreviation: string;
  dice: string;
  description: string;
  characteristicRoll: string;
}

export function searchBrpCharacteristics(
  db: Database.Database,
  searchTerm: string
): CharacteristicResult[] {
  const stmt = db.prepare(`
    SELECT name, abbreviation, dice, description, characteristic_roll
    FROM brp_characteristics
    WHERE name LIKE ? OR description LIKE ? OR abbreviation LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  return searchWithFuzzyFallback(
    searchTerm,
    (term) =>
      stmt.all(`%${term}%`, `%${term}%`, `%${term}%`) as {
        name: string; abbreviation: string; dice: string; description: string; characteristic_roll: string;
      }[],
    (r) => r.name,
  ).map((r) => ({
    name: r.name,
    abbreviation: r.abbreviation,
    dice: r.dice,
    description: r.description,
    characteristicRoll: r.characteristic_roll,
  }));
}

export interface DerivedCharacteristicResult {
  name: string;
  formula: string;
  description: string;
}

export function searchBrpDerivedCharacteristics(
  db: Database.Database,
  searchTerm: string
): DerivedCharacteristicResult[] {
  const stmt = db.prepare(`
    SELECT name, formula, description
    FROM brp_derived_characteristics
    WHERE name LIKE ? OR description LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  return searchWithFuzzyFallback(searchTerm, (term) =>
    stmt.all(`%${term}%`, `%${term}%`) as DerivedCharacteristicResult[],
    (r) => r.name,
  );
}

export interface SkillResult {
  name: string;
  baseChance: string;
  description: string;
  specialtyNote: string | null;
}

export function searchBrpSkills(
  db: Database.Database,
  searchTerm: string
): SkillResult[] {
  const stmt = db.prepare(`
    SELECT name, base_chance, description, specialty_note
    FROM brp_skills
    WHERE name LIKE ? OR description LIKE ?
    ORDER BY name
    LIMIT 30
  `);
  return searchWithFuzzyFallback(
    searchTerm,
    (term) =>
      stmt.all(`%${term}%`, `%${term}%`) as {
        name: string; base_chance: string; description: string; specialty_note: string | null;
      }[],
    (r) => r.name,
  ).map((r) => ({
    name: r.name,
    baseChance: r.base_chance,
    description: r.description,
    specialtyNote: r.specialty_note,
  }));
}

export interface ProfessionResult {
  name: string;
  description: string;
  professionalSkills: string;
}

export function searchBrpProfessions(
  db: Database.Database,
  searchTerm: string
): ProfessionResult[] {
  const stmt = db.prepare(`
    SELECT name, description, professional_skills
    FROM brp_professions
    WHERE name LIKE ? OR description LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  return searchWithFuzzyFallback(
    searchTerm,
    (term) =>
      stmt.all(`%${term}%`, `%${term}%`) as {
        name: string; description: string; professional_skills: string;
      }[],
    (r) => r.name,
  ).map((r) => ({
    name: r.name,
    description: r.description,
    professionalSkills: r.professional_skills,
  }));
}

export interface WeaponMeleeResult {
  name: string;
  skill: string;
  baseChance: number;
  damage: string;
  hands: string;
  hitPoints: number;
  range: string | null;
}

export function searchBrpWeaponsMelee(
  db: Database.Database,
  searchTerm: string
): WeaponMeleeResult[] {
  const stmt = db.prepare(`
    SELECT name, skill, base_chance, damage, hands, hit_points, range
    FROM brp_weapons_melee
    WHERE name LIKE ? OR skill LIKE ? OR damage LIKE ?
    ORDER BY name
    LIMIT 30
  `);
  return searchWithFuzzyFallback(
    searchTerm,
    (term) =>
      stmt.all(`%${term}%`, `%${term}%`, `%${term}%`) as {
        name: string; skill: string; base_chance: number; damage: string; hands: string; hit_points: number; range: string | null;
      }[],
    (r) => r.name,
  ).map((r) => ({
    name: r.name,
    skill: r.skill,
    baseChance: r.base_chance,
    damage: r.damage,
    hands: r.hands,
    hitPoints: r.hit_points,
    range: r.range,
  }));
}

export interface WeaponMissileResult {
  name: string;
  skill: string;
  baseChance: number;
  damage: string;
  hands: string;
  hitPoints: number;
  range: string;
  notes: string | null;
}

export function searchBrpWeaponsMissile(
  db: Database.Database,
  searchTerm: string
): WeaponMissileResult[] {
  const stmt = db.prepare(`
    SELECT name, skill, base_chance, damage, hands, hit_points, range, notes
    FROM brp_weapons_missile
    WHERE name LIKE ? OR skill LIKE ? OR damage LIKE ?
    ORDER BY name
    LIMIT 30
  `);
  return searchWithFuzzyFallback(
    searchTerm,
    (term) =>
      stmt.all(`%${term}%`, `%${term}%`, `%${term}%`) as {
        name: string; skill: string; base_chance: number; damage: string; hands: string; hit_points: number; range: string; notes: string | null;
      }[],
    (r) => r.name,
  ).map((r) => ({
    name: r.name,
    skill: r.skill,
    baseChance: r.base_chance,
    damage: r.damage,
    hands: r.hands,
    hitPoints: r.hit_points,
    range: r.range,
    notes: r.notes,
  }));
}

export interface ArmorResult {
  name: string;
  armorPoints: number;
  skillModifier: string;
}

export function searchBrpArmor(
  db: Database.Database,
  searchTerm: string
): ArmorResult[] {
  const stmt = db.prepare(`
    SELECT name, armor_points, skill_modifier
    FROM brp_armor
    WHERE name LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  return searchWithFuzzyFallback(
    searchTerm,
    (term) =>
      stmt.all(`%${term}%`) as {
        name: string; armor_points: number; skill_modifier: string;
      }[],
    (r) => r.name,
  ).map((r) => ({
    name: r.name,
    armorPoints: r.armor_points,
    skillModifier: r.skill_modifier,
  }));
}

export interface ShieldResult {
  name: string;
  baseChance: number;
  skill: string;
  hitPoints: number;
  damage: string;
}

export function searchBrpShields(
  db: Database.Database,
  searchTerm: string
): ShieldResult[] {
  const stmt = db.prepare(`
    SELECT name, base_chance, skill, hit_points, damage
    FROM brp_shields
    WHERE name LIKE ?
    ORDER BY name
    LIMIT 20
  `);
  return searchWithFuzzyFallback(
    searchTerm,
    (term) =>
      stmt.all(`%${term}%`) as {
        name: string; base_chance: number; skill: string; hit_points: number; damage: string;
      }[],
    (r) => r.name,
  ).map((r) => ({
    name: r.name,
    baseChance: r.base_chance,
    skill: r.skill,
    hitPoints: r.hit_points,
    damage: r.damage,
  }));
}

export interface SpotRuleResult {
  topic: string;
  content: string;
  category: string;
}

export function searchBrpSpotRules(
  db: Database.Database,
  searchTerm: string
): SpotRuleResult[] {
  const stmt = db.prepare(`
    SELECT topic, content, category
    FROM brp_spot_rules
    WHERE topic LIKE ? OR content LIKE ? OR category LIKE ?
    ORDER BY category, topic
    LIMIT 30
  `);
  return searchWithFuzzyFallback(searchTerm, (term) =>
    stmt.all(`%${term}%`, `%${term}%`, `%${term}%`) as SpotRuleResult[],
    (r) => `${r.category}:${r.topic}`,
  );
}

export interface SampleFoeResult {
  name: string;
  characteristics: string;
  move: number;
  hitPoints: number;
  damageBonus: string;
  armor: string;
  skills: string;
  attacks: string;
}

export function searchBrpSampleFoes(
  db: Database.Database,
  searchTerm: string
): SampleFoeResult[] {
  const stmt = db.prepare(`
    SELECT name, characteristics, move, hit_points, damage_bonus, armor, skills, attacks
    FROM brp_sample_foes
    WHERE name LIKE ? OR characteristics LIKE ? OR attacks LIKE ?
    ORDER BY name
    LIMIT 10
  `);
  return searchWithFuzzyFallback(
    searchTerm,
    (term) =>
      stmt.all(`%${term}%`, `%${term}%`, `%${term}%`) as {
        name: string; characteristics: string; move: number; hit_points: number; damage_bonus: string; armor: string; skills: string; attacks: string;
      }[],
    (r) => r.name,
  ).map((r) => ({
    name: r.name,
    characteristics: r.characteristics,
    move: r.move,
    hitPoints: r.hit_points,
    damageBonus: r.damage_bonus,
    armor: r.armor,
    skills: r.skills,
    attacks: r.attacks,
  }));
}

export function listBrpCategories(db: Database.Database): { name: string; description: string }[] {
  return db.prepare("SELECT name, description FROM brp_categories ORDER BY name").all() as {
    name: string;
    description: string;
  }[];
}

export function listBrpSkills(db: Database.Database): { name: string; baseChance: string; specialtyNote: string | null }[] {
  const rows = db.prepare("SELECT name, base_chance, specialty_note FROM brp_skills ORDER BY name").all() as {
    name: string; base_chance: string; specialty_note: string | null;
  }[];
  return rows.map((r) => ({
    name: r.name,
    baseChance: r.base_chance,
    specialtyNote: r.specialty_note,
  }));
}

export function listBrpProfessions(db: Database.Database): { name: string; description: string; skillCount: number }[] {
  const rows = db.prepare("SELECT name, description, professional_skills FROM brp_professions ORDER BY name").all() as {
    name: string; description: string; professional_skills: string;
  }[];
  return rows.map((r) => ({
    name: r.name,
    description: r.description,
    skillCount: r.professional_skills ? r.professional_skills.split(",").length : 0,
  }));
}

export function listBrpAllWeapons(db: Database.Database): { name: string; skill: string; damage: string; category: string }[] {
  const melee = db.prepare("SELECT name, skill, damage, 'melee' AS category FROM brp_weapons_melee ORDER BY name").all() as {
    name: string; skill: string; damage: string; category: string;
  }[];
  const missile = db.prepare("SELECT name, skill, damage, 'missile' AS category FROM brp_weapons_missile ORDER BY name").all() as {
    name: string; skill: string; damage: string; category: string;
  }[];
  return [...melee, ...missile].sort((a, b) => a.name.localeCompare(b.name));
}
