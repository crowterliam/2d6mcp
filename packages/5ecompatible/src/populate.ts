// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// 5E-COMPATIBLE SCOPE NOTICE:
// The code in this file (functions, control flow, parsing logic) is AGPL-3.0-only.
// The string literals and parsed content inserted into the database are Open Game
// Content from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the
// Coast LLC, available at https://www.dndbeyond.com/srd, governed by the Creative
// Commons Attribution 4.0 International License (CC-BY-4.0).
//
// This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1")
// by Wizards of the Coast LLC. Licensed under CC-BY-4.0.
// See data/5ecompatible/SRD-NOTICE.txt for full attribution.
//
// The resulting database output in data/5ecompatible/ is designated as Open Game Content
// under CC-BY-4.0.

import Database from "better-sqlite3";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { ensure5ecompatibleSchema } from "./database.js";

const DEFAULT_SRD_PATH = resolve(process.cwd(), ".reference", "SRD");

export function populate5ecompatibleDatabase(
  dbPath: string,
  srdPath?: string
): { success: boolean; message: string } {
  const sourcePath = srdPath || DEFAULT_SRD_PATH;

  if (existsSync(dbPath)) {
    return {
      success: true,
      message: `5E-compatible database already exists at ${dbPath}. Use --force to repopulate.`,
    };
  }

  if (!existsSync(sourcePath)) {
    return {
      success: false,
      message: `SRD source directory not found: ${sourcePath}. Clone the 5.2.1 SRD into .reference/SRD/ first.`,
    };
  }

  const db = ensure5ecompatibleSchema(dbPath);
  const tx = db.transaction(() => {
    seedSections(db, sourcePath);
    seedSpells(db, sourcePath);
    seedMonsters(db, sourcePath);
    seedClasses(db, sourcePath);
    seedFeats(db, sourcePath);
  });
  tx();
  rebuildFts(db);
  db.close();
  return { success: true, message: `5E-compatible database populated at ${dbPath}` };
}

function rebuildFts(db: Database.Database): void {
  db.exec(`INSERT INTO sr5e_sections_fts(sr5e_sections_fts) VALUES ('rebuild');`);
}

// ─── SECTIONS (FTS content from compiled file) ────────────────────────────

function seedSections(db: Database.Database, srdPath: string): void {
  const compiledPath = resolve(srdPath, "docs_compiled", "dnd_srd_5.2.1_compiled");
  if (!existsSync(compiledPath)) return;

  const content = readFileSync(compiledPath, "utf-8");
  const stmt = db.prepare("INSERT INTO sr5e_sections (section, topic, content) VALUES (?, ?, ?)");

  const sections = content.split(/\n## /);
  let prevSection = "Introduction";

  for (const block of sections) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n");
    const firstLine = lines[0].replace(/^#+ /, "").trim();

    let section = prevSection;
    let topic = firstLine;
    let body = trimmed;

    const h1Match = trimmed.match(/^# (.*)/m);
    if (h1Match) {
      section = h1Match[1].trim();
      prevSection = section;
    }

    if (body.length > 2000) {
      body = body.substring(0, 2000);
    }

    stmt.run(section, topic || null, body);
  }
}

// ─── SPELLS ───────────────────────────────────────────────────────────────

function seedSpells(db: Database.Database, srdPath: string): void {
  const spellsDir = resolve(srdPath, "07_Spells", "Spells_Each");
  if (!existsSync(spellsDir)) return;

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO sr5e_spells (name, level, school, casting_time, range, components, duration, classes, description, higher_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const files = readdirSync(spellsDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const content = readFileSync(resolve(spellsDir, file), "utf-8");
    const spell = parseSpell(content);
    if (spell) {
      stmt.run(
        spell.name, spell.level, spell.school,
        spell.castingTime, spell.range, spell.components, spell.duration,
        spell.classes, spell.description, spell.higherLevel
      );
    }
  }
}

interface ParsedSpell {
  name: string; level: number; school: string;
  castingTime: string; range: string; components: string; duration: string;
  classes: string; description: string; higherLevel: string | null;
}

function parseSpell(content: string): ParsedSpell | null {
  const lines = content.split("\n");
  const nameLine = lines.find((l) => l.startsWith("# "));
  if (!nameLine) return null;
  const name = nameLine.replace("# ", "").trim();

  const metaLine = lines.find((l) => l.startsWith("*Level"));
  let level = 0;
  let school = "Unknown";
  let classes = "";

  if (metaLine) {
    const meta = metaLine.replace(/\*/g, "").trim();
    const levelMatch = meta.match(/Level\s+(\d+)/i);
    if (levelMatch) level = parseInt(levelMatch[1], 10);
    const schoolClassesMatch = meta.match(/Level\s+\d+\s+(\w+)\s*(?:\((.*)\))?/i);
    if (schoolClassesMatch) {
      school = schoolClassesMatch[1];
      classes = schoolClassesMatch[2] || "";
    }
  }

  const getField = (label: string): string => {
    const idx = lines.findIndex((l) => l.toLowerCase().startsWith(`**${label.toLowerCase()}:**`));
    if (idx === -1) return "";
    const val = lines[idx].replace(/^\*\*.*?\*\*\s*/i, "").trim();
    const continuation: string[] = [];
    for (let i = idx + 1; i < lines.length; i++) {
      const li = lines[i].trim();
      if (!li || li.startsWith("*") || li.startsWith("#") || li.startsWith("**")) break;
      continuation.push(li);
    }
    return val + (continuation.length ? " " + continuation.join(" ") : "");
  };

  const castingTime = getField("Casting Time");
  const range = getField("Range");
  const components = getField("Components");
  const duration = getField("Duration");

  const metaIdx = lines.findIndex((l) => l.startsWith("*Level"));
  const descStart = Math.max(
    lines.findIndex((l) => l.toLowerCase().startsWith("**duration:**")) + 1,
    metaIdx + 1
  );

  let descLines: string[] = [];
  let higherLevel: string | null = null;
  let higherLines: string[] = [];

  for (let i = descStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("***Using a Higher-Level")) {
      if (higherLines.length > 0) higherLines.push(line);
      else higherLines.push(line);
      continue;
    }
    if (higherLines.length > 0) {
      higherLines.push(line);
    } else {
      descLines.push(line);
    }
  }

  if (higherLines.length > 0) {
    higherLevel = higherLines.join(" ").replace(/\*\*\*/g, "");
  }

  const description = descLines.join(" ").trim();
  if (!description) return null;

  return { name, level, school, castingTime, range, components, duration, classes, description, higherLevel };
}

// ─── MONSTERS ─────────────────────────────────────────────────────────────

function seedMonsters(db: Database.Database, srdPath: string): void {
  const monstersDir = resolve(srdPath, "11_Monsters", "Monsters_Each");
  if (!existsSync(monstersDir)) return;

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO sr5e_monsters
     (name, size, type, alignment, ac, hp, speed,
      strength, dexterity, constitution, intelligence, wisdom, charisma,
      senses, languages, challenge_rating, traits, actions, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const files = readdirSync(monstersDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const content = readFileSync(resolve(monstersDir, file), "utf-8");
    const monster = parseMonster(content);
    if (monster) {
      stmt.run(
        monster.name, monster.size, monster.type, monster.alignment,
        monster.ac, monster.hp, monster.speed,
        monster.strength, monster.dexterity, monster.constitution,
        monster.intelligence, monster.wisdom, monster.charisma,
        monster.senses, monster.languages, monster.challengeRating,
        monster.traits, monster.actions, monster.description
      );
    }
  }
}

interface ParsedMonster {
  name: string; size: string; type: string; alignment: string;
  ac: number; hp: string; speed: string;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
  senses: string; languages: string; challengeRating: string;
  traits: string | null; actions: string | null; description: string;
}

function parseMonster(content: string): ParsedMonster | null {
  const lines = content.split("\n");
  const nameLine = lines.find((l) => l.startsWith("# "));
  if (!nameLine) return null;
  const name = nameLine.replace("# ", "").trim();

  const metaLine = lines.find((l) => l.startsWith("*") && !l.startsWith("**"));
  let size = "", mtype = "", alignment = "";
  if (metaLine) {
    const meta = metaLine.replace(/\*/g, "").trim();
    const parts = meta.split(/,\s*/);
    if (parts.length >= 2) {
      size = parts[0].trim();
      mtype = parts.slice(1, -1).join(", ").trim();
      alignment = parts[parts.length - 1].trim();
    }
  }

  const acMatch = content.match(/\*\*AC\*\*\s*(\d+)/);
  const ac = acMatch ? parseInt(acMatch[1], 10) : 0;

  const hpMatch = content.match(/\*\*HP\*\*\s*([^(]+(?:\([^)]+\))?)/);
  const hp = hpMatch ? hpMatch[1].trim() : "";

  const speedMatch = content.match(/\*\*Speed\*\*\s*(.+)/m);
  const speed = speedMatch ? speedMatch[1].trim() : "";

  const abilities: number[] = [10, 10, 10, 10, 10, 10];
  const abilRegex = /\*\*Str\s+(\d+)\*\*.*?\*\*Dex\s+(\d+)\*\*.*?\*\*Con\s+(\d+)\*\*.*?\*\*Int\s+(\d+)\*\*.*?\*\*Wis\s+(\d+)\*\*.*?\*\*Cha\s+(\d+)\*\*/s;
  const abilMatch = content.match(abilRegex);
  if (abilMatch) {
    abilities[0] = parseInt(abilMatch[1], 10);
    abilities[1] = parseInt(abilMatch[2], 10);
    abilities[2] = parseInt(abilMatch[3], 10);
    abilities[3] = parseInt(abilMatch[4], 10);
    abilities[4] = parseInt(abilMatch[5], 10);
    abilities[5] = parseInt(abilMatch[6], 10);
  }

  const skillsMatch = content.match(/\*\*Skills\*\*\s*(.+)/m);
  const senses = skillsMatch ? skillsMatch[1].trim() : "";

  const langsMatch = content.match(/\*\*Languages\*\*\s*(.+)/m);
  const languages = langsMatch ? langsMatch[1].trim() : "";

  const crMatch = content.match(/\*\*CR\*\*\s*(.+)/m);
  const challengeRating = crMatch ? crMatch[1].split("(")[0].trim() : "";

  let traits: string | null = null;
  let actions: string | null = null;

  const traitsIdx = lines.findIndex((l) => l.trim() === "## Traits");
  const actionsIdx = lines.findIndex((l) => l.trim() === "## Actions");

  if (traitsIdx >= 0) {
    const traitLines: string[] = [];
    for (let i = traitsIdx + 1; i < (actionsIdx > 0 ? actionsIdx : lines.length); i++) {
      const line = lines[i].trim();
      if (line.startsWith("## ") && i !== traitsIdx) break;
      if (line) traitLines.push(line);
    }
    traits = traitLines.join(" ").substring(0, 2000) || null;
  }

  if (actionsIdx >= 0) {
    const actionLines: string[] = [];
    for (let i = actionsIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("## ") && i !== actionsIdx) break;
      if (line) actionLines.push(line);
    }
    actions = actionLines.join(" ").substring(0, 2000) || null;
  }

  const description = [
    `Size: ${size}`, `Type: ${mtype}`, `Alignment: ${alignment}`,
    `AC: ${ac}`, `HP: ${hp}`, `Speed: ${speed}`,
    senses ? `Skills/Senses: ${senses}` : null,
    languages ? `Languages: ${languages}` : null,
    challengeRating ? `CR: ${challengeRating}` : null,
  ].filter(Boolean).join(" | ");

  return {
    name, size, type: mtype, alignment, ac, hp, speed,
    strength: abilities[0], dexterity: abilities[1], constitution: abilities[2],
    intelligence: abilities[3], wisdom: abilities[4], charisma: abilities[5],
    senses, languages, challengeRating, traits, actions, description,
  };
}

// ─── CLASSES ──────────────────────────────────────────────────────────────

function seedClasses(db: Database.Database, srdPath: string): void {
  const classesFile = resolve(srdPath, "03_Character_Classes", "Character_Classes_All+H1.md");
  if (!existsSync(classesFile)) return;

  const content = readFileSync(classesFile, "utf-8");
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO sr5e_classes (name, hit_die, primary_ability, saving_throws, skill_proficiencies, armor_training, weapon_proficiencies, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const classBlocks = content.split(/\n(?=## [A-Z])/);

  for (const block of classBlocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith("# ")) continue;

    const nameMatch = trimmed.match(/^## ([A-Z][\w\s]+)/m);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();

    if (["Classes", "Multiclassing", "Running"].includes(name)) continue;

    const hpMatch = trimmed.match(/\*\*Hit Point Die\*\*.*?(\w\d+)/i);
    const hitDie = hpMatch ? hpMatch[1] : "";

    const abilityMatch = trimmed.match(/\*\*Primary Ability\*\*\s*\|\s*(.+?)\s*\|/);
    const primaryAbility = abilityMatch ? abilityMatch[1].trim() : "";

    const savesMatch = trimmed.match(/\*\*Saving Throw Proficiencies\*\*\s*\|\s*(.+?)\s*\|/);
    const savingThrows = savesMatch ? savesMatch[1].trim() : "";

    const skillsMatch = trimmed.match(/\*\*Skill Proficiencies\*\*\s*\|\s*(.+?)\s*\|/);
    const skillProficiencies = skillsMatch ? skillsMatch[1].trim() : "";

    const armorMatch = trimmed.match(/\*\*Armor Training\*\*\s*\|\s*(.+?)\s*\|/);
    const armorTraining = armorMatch ? armorMatch[1].trim() : "";

    const weaponMatch = trimmed.match(/\*\*Weapon Proficiencies\*\*\s*\|\s*(.+?)\s*\|/);
    const weaponProficiencies = weaponMatch ? weaponMatch[1].trim() : "";

    const desc = trimmed.substring(0, 2000);
    stmt.run(name, hitDie, primaryAbility, savingThrows, skillProficiencies, armorTraining, weaponProficiencies, desc);
  }
}

// ─── FEATS ────────────────────────────────────────────────────────────────

function seedFeats(db: Database.Database, srdPath: string): void {
  const featsDir = resolve(srdPath, "05_Feats", "Feats_Each");
  if (!existsSync(featsDir)) return;

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO sr5e_feats (name, prerequisite, description) VALUES (?, ?, ?)"
  );

  const files = readdirSync(featsDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const content = readFileSync(resolve(featsDir, file), "utf-8");
    const feat = parseFeat(content);
    if (feat) {
      stmt.run(feat.name, feat.prerequisite, feat.description);
    }
  }
}

interface ParsedFeat { name: string; prerequisite: string | null; description: string; }

function parseFeat(content: string): ParsedFeat | null {
  const lines = content.split("\n");
  const nameLine = lines.find((l) => l.startsWith("# "));
  if (!nameLine) return null;
  const name = nameLine.replace("# ", "").trim();

  let prerequisite: string | null = null;
  const prereqIdx = lines.findIndex((l) =>
    l.toLowerCase().includes("prerequisite") && l.startsWith("*")
  );
  if (prereqIdx >= 0) {
    prerequisite = lines[prereqIdx].replace(/\*/g, "").trim();
  }

  const description = lines
    .filter((l, i) => i > 0 && !l.startsWith("# ") && !l.startsWith("*Prerequisite"))
    .join(" ")
    .trim()
    .substring(0, 2000);

  if (!description) return null;
  return { name, prerequisite, description };
}
