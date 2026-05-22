// Seed D1 FTS5 tables from OGL and DW SQLite databases.
// Usage: node seed-d1.mjs

import Database from "better-sqlite3";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..", "..", "..");

const oglSrc = new Database(resolve(projectRoot, "data", "ogl", "cepheus.db"), { readonly: true });
const dwSrc = new Database(resolve(projectRoot, "data", "dw", "dungeon-world.db"), { readonly: true });

const d1Path = resolve(__dirname, "..", ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject", "0ccd9c9e8a9cee9a17b3facd437ec3f2eb3902546ca4357abaff3523879391f7.sqlite");
if (!existsSync(d1Path)) {
  console.error("D1 database not found at:", d1Path);
  process.exit(1);
}
const d1 = new Database(d1Path);

const insertOgl = d1.prepare("INSERT INTO ogl_rules_fts (title, category, content, source_tag) VALUES (?, ?, ?, ?)");
const insertDw = d1.prepare("INSERT INTO dw_rules_fts (title, category, content, source_tag) VALUES (?, ?, ?, ?)");

// ── OGL Rules ──

const oglRules = oglSrc.prepare("SELECT title, content, source FROM rules_text").all();
if (oglRules.length > 0) {
  for (const r of oglRules) {
    insertOgl.run(r.title, "rules", r.content, `OGL: ${r.title}`);
  }
}
console.log(`OGL rules_text: ${oglRules.length}`);

const coreRules = oglSrc.prepare("SELECT section, subsection, content FROM core_rules").all();
for (const r of coreRules) {
  const cat = "core_rules";
  const title = r.subsection ? `${r.section} > ${r.subsection}` : r.section;
  insertOgl.run(title, cat, r.content, `OGL Core: ${title}`);
}
console.log(`OGL core_rules: ${coreRules.length}`);

const skills = oglSrc.prepare("SELECT name, description, characteristic, specializations FROM skills").all();
for (const r of skills) {
  const parts = [r.description || ""];
  if (r.characteristic) parts.push(`Characteristic: ${r.characteristic}`);
  if (r.specializations) parts.push(`Specializations: ${r.specializations}`);
  insertOgl.run(r.name, "skill", parts.join(". "), `OGL Skill: ${r.name}`);
}
console.log(`OGL skills: ${skills.length}`);

const careers = oglSrc.prepare("SELECT name, description, qualification, survival, advancement, ranks FROM careers").all();
for (const r of careers) {
  const parts = [r.description || ""];
  if (r.qualification) parts.push(`Qualification: ${r.qualification}`);
  if (r.survival) parts.push(`Survival: ${r.survival}`);
  if (r.advancement) parts.push(`Advancement: ${r.advancement}`);
  if (r.ranks) parts.push(`Ranks: ${r.ranks}`);
  insertOgl.run(r.name, "career", parts.join(". "), `OGL Career: ${r.name}`);
}
console.log(`OGL careers: ${careers.length}`);

const equipment = oglSrc.prepare("SELECT name, category, tech_level, cost, weight, description FROM equipment").all();
for (const r of equipment) {
  const parts = [r.description || ""];
  if (r.tech_level) parts.push(`TL: ${r.tech_level}`);
  if (r.cost) parts.push(`Cost: ${r.cost}`);
  if (r.weight) parts.push(`Weight: ${r.weight}`);
  insertOgl.run(r.name, `equipment/${r.category || "general"}`, parts.join(". "), `OGL Equipment: ${r.name}`);
}
console.log(`OGL equipment: ${equipment.length}`);

const combat = oglSrc.prepare("SELECT topic, content, category FROM combat").all();
for (const r of combat) {
  insertOgl.run(r.topic, `combat/${r.category || "general"}`, r.content, `OGL Combat: ${r.topic}`);
}
console.log(`OGL combat: ${combat.length}`);

const shipOps = oglSrc.prepare("SELECT topic, content, category FROM starship_operations").all();
for (const r of shipOps) {
  insertOgl.run(r.topic, `starship/${r.category || "general"}`, r.content, `OGL Starship Ops: ${r.topic}`);
}
console.log(`OGL starship_operations: ${shipOps.length}`);

const worlds = oglSrc.prepare("SELECT topic, content, category FROM world_building").all();
for (const r of worlds) {
  insertOgl.run(r.topic, `world/${r.category || "general"}`, r.content, `OGL World: ${r.topic}`);
}
console.log(`OGL world_building: ${worlds.length}`);

// ── DW Rules ──
// ── DW Sections ──
try {
  const dwSections = dwSrc.prepare("SELECT section_title, subsection_title, content, category, source_file FROM dw_sections").all();
  if (dwSections.length > 0) {
    for (const r of dwSections) {
      const title = r.subsection_title ? `${r.section_title} > ${r.subsection_title}` : r.section_title;
      insertDw.run(title, r.category || "rules", r.content, `DW: ${title}`);
    }
  }
  console.log(`DW sections: ${dwSections.length}`);
} catch (e) {
  console.log("DW sections error:", e.message);
}

const dwMoves = dwSrc.prepare("SELECT name, description, stat, category, on_success, on_partial FROM dw_moves").all();
for (const r of dwMoves) {
  const parts = [r.description || ""];
  if (r.stat) parts.push(`Stat: ${r.stat}`);
  if (r.on_success) parts.push(`10+: ${r.on_success}`);
  if (r.on_partial) parts.push(`7-9: ${r.on_partial}`);
  insertDw.run(r.name, `move/${r.category || "basic"}`, parts.join(". "), `DW Move: ${r.name}`);
}
console.log(`DW moves: ${dwMoves.length}`);

// ── DW Classes ──
let dwClassesLen = 0;
try {
  const cols = dwSrc.prepare("PRAGMA table_info(dw_classes)").all().map((c) => c.name);
  const hasName = cols.includes("name");
  const hasDesc = cols.includes("description");
  const hasHP = cols.includes("base_hp");
  const hasDmg = cols.includes("base_damage");
  const hasStats = cols.includes("stats");

  const dwClasses = dwSrc.prepare(`SELECT ${cols.join(", ")} FROM dw_classes`).all();
  for (const r of dwClasses) {
    const parts = [];
    if (hasDesc && r.description) parts.push(r.description);
    if (hasHP && r.base_hp) parts.push(`HP: ${r.base_hp}`);
    if (hasDmg && r.base_damage) parts.push(`Damage: ${r.base_damage}`);
    if (hasStats && r.stats) parts.push(`Stats: ${r.stats}`);
    insertDw.run(r.name || "unknown", "class", parts.join(". "), `DW Class: ${r.name}`);
  }
  dwClassesLen = dwClasses.length;
} catch (e) {
  console.log("DW classes error:", e.message);
}
console.log(`DW classes: ${dwClassesLen}`);

const dwSpells = dwSrc.prepare("SELECT name, level, spell_class, tags, description FROM dw_spells").all();
for (const r of dwSpells) {
  const parts = [r.description || ""];
  if (r.tags) parts.push(`Tags: ${r.tags}`);
  insertDw.run(r.name, `spell/${r.spell_class}/${r.level}`, parts.join(". "), `DW Spell: ${r.name}`);
}
console.log(`DW spells: ${dwSpells.length}`);

const dwEquipment = dwSrc.prepare("SELECT name, category, tags, cost, weight, damage, armor, description FROM dw_equipment").all();
for (const r of dwEquipment) {
  const parts = [r.description || ""];
  if (r.tags) parts.push(`Tags: ${r.tags}`);
  if (r.cost) parts.push(`Cost: ${r.cost}`);
  if (r.weight) parts.push(`Weight: ${r.weight}`);
  if (r.damage) parts.push(`Damage: ${r.damage}`);
  if (r.armor) parts.push(`Armor: ${r.armor}`);
  insertDw.run(r.name, `equipment/${r.category || "general"}`, parts.join(". "), `DW Equipment: ${r.name}`);
}
console.log(`DW equipment: ${dwEquipment.length}`);

const dwMonsters = dwSrc.prepare("SELECT name, tags, damage, hp, armor, special_qualities, description, instinct FROM dw_monsters").all();
for (const r of dwMonsters) {
  const parts = [r.description || ""];
  if (r.tags) parts.push(`Tags: ${r.tags}`);
  if (r.damage) parts.push(`Damage: ${r.damage}`);
  if (r.hp) parts.push(`HP: ${r.hp}`);
  if (r.armor) parts.push(`Armor: ${r.armor}`);
  if (r.special_qualities) parts.push(`Special: ${r.special_qualities}`);
  if (r.instinct) parts.push(`Instinct: ${r.instinct}`);
  insertDw.run(r.name, "monster", parts.join(". "), `DW Monster: ${r.name}`);
}
console.log(`DW monsters: ${dwMonsters.length}`);

const dwGm = dwSrc.prepare("SELECT topic, content, category FROM dw_gm_tools").all();
for (const r of dwGm) {
  insertDw.run(r.topic, `gm/${r.category || "general"}`, r.content, `DW GM: ${r.topic}`);
}
console.log(`DW gm_tools: ${dwGm.length}`);

console.log(`\nDone. Total OGL: ~${oglRules.length + coreRules.length + skills.length + careers.length + equipment.length + combat.length + shipOps.length + worlds.length} rows`);
console.log(`Total DW: ~${dwMoves.length + dwClassesLen + dwSpells.length + dwEquipment.length + dwMonsters.length + dwGm.length} rows`);

d1.close();
oglSrc.close();
dwSrc.close();
