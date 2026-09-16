// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// CONTENT NOTICE:
// String literals in this file are original mechanical summaries authored for
// 2d6mcp. They describe common B/X-style procedures in original wording so
// agents can resolve mid-session questions (saves, combat, reaction, morale,
// hirelings, encumbrance, exploration). They are not copied from any commercial
// old-school rulebook. Do not paste copyrighted book text into this file.
//
// Operators who own licensed books should index the operator's local OSR/B/X
// shelf PDFs with BYOD (AGREE_BYOD_USE + BYOD_PATH) or pass --source-dir to
// populate-osr for their own notes. Source PDFs must never be committed to git.

import Database from "better-sqlite3";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { ensureOsrSchema, closeOsrDatabase } from "./database.js";

const IMPORTABLE_EXTS = new Set([".md", ".markdown", ".txt"]);
const MAX_IMPORT_FILE_BYTES = 256 * 1024;
const MAX_IMPORT_FILES = 200;

export interface PopulateOsrOptions {
  sourceDir?: string;
}

export function populateOsrDatabase(
  dbPath: string,
  options: PopulateOsrOptions = {}
): { success: boolean; message: string; importedFiles: number } {
  const db = ensureOsrSchema(dbPath);
  const seeded = db.prepare("SELECT COUNT(*) AS c FROM osr_categories").get() as { c: number };
  if (seeded.c === 0) {
    const tx = db.transaction(() => {
      seedOsrCategories(db);
      seedOsrCoreRules(db);
      seedOsrProcedures(db);
      seedOsrTables(db);
    });
    tx();
  }

  let importedFiles = 0;
  if (options.sourceDir) {
    importedFiles = importOperatorNotes(db, options.sourceDir);
  }

  rebuildFts(db);
  closeOsrDatabase();

  const importNote =
    importedFiles > 0
      ? ` Imported ${importedFiles} operator note file(s) from ${options.sourceDir}.`
      : options.sourceDir
        ? ` No importable .md/.txt files found in ${options.sourceDir}.`
        : "";

  return {
    success: true,
    message: `OSR / B/X-compatible procedures database populated at ${dbPath}.${importNote}`,
    importedFiles,
  };
}

function rebuildFts(db: Database.Database): void {
  db.exec(`INSERT INTO osr_core_rules_fts(osr_core_rules_fts) VALUES ('rebuild');`);
}

function seedOsrCategories(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO osr_categories (name, description) VALUES (?, ?)");
  const cats = [
    ["Saves", "Rolling a saving throw to avoid or reduce a harmful effect"],
    ["Combat", "Initiative, attacking, armor class, damage, and morale in a fight"],
    ["Reaction", "First-contact attitude when meeting creatures whose intent is unknown"],
    ["Morale", "When opponents or retainers break, flee, or fight on"],
    ["Hirelings", "Hiring retainers and specialists, loyalty, and shares"],
    ["Encumbrance", "Carried weight, movement rates, and dropping gear"],
    ["Exploration", "Turns, light, searching, rest, and wandering encounters"],
    ["Tables", "Named 2d6 (and 1d6) packs for reaction, morale, and hirelings"],
    ["Notice", "What this database contains and how to index commercial books via BYOD"],
  ];
  for (const c of cats) stmt.run(...c);
}

function seedOsrCoreRules(db: Database.Database): void {
  const s = db.prepare(
    "INSERT OR IGNORE INTO osr_core_rules (section, subsection, content, page_hint) VALUES (?, ?, ?, ?)"
  );
  const rules: [string, string, string, string][] = [
    [
      "Notice",
      "What this database is",
      "This database ships original short procedure summaries for B/X-style play (saves, combat, reaction, morale, hirelings, encumbrance, exploration). It is not a reprint of any commercial old-school rulebook. query_rules(system=osr) is for mid-session mechanics. Full book text belongs in BYOD: set AGREE_BYOD_USE=true, point BYOD_PATH at the operator's local OSR/B/X shelf PDFs, and pass byod_system=osr (or a folder name) on the session.",
      "Notice",
    ],
    [
      "Notice",
      "BYOD for commercial books",
      "Example Windows shelf (docs only, never committed): /path/to/rpg-shelf\\local OSR/B/X shelf. After consent, sync_byod(query=\"old-school\") or query_local_byod with system/byod_system osr. populate-osr --source-dir may import the operator's own .md/.txt notes into this DB; it never vendors PDFs into git.",
      "Notice",
    ],
    [
      "Saves",
      "Saving throws",
      "When an effect might be avoided or halved, the player rolls 1d20. Success is rolling equal to or higher than the number listed for that class, level, and save category. Five common categories: Death or poison; Wands; Paralysis or petrification; Breath weapons; Spells or magical devices. A high Constitution or a protective item may grant a bonus. Failure means the effect applies in full (or the worse listed result). Breath weapons often deal half damage on a success. Do not invent class-by-level matrices from this summary — look them up in the table's licensed book via BYOD when exact numbers matter.",
      "Saves",
    ],
    [
      "Saves",
      "When to call a save",
      "Call a save when the fiction puts a character in the path of a sudden hazard: poison, a wand beam, petrification, a dragon's breath, a spell. Ordinary attacks use the attack roll against Armor Class, not a save. Ability checks (forcing a door, listening) use their own dice — typically 1d6, success on 1–2 for an unexceptional adventurer — not the saving throw table.",
      "Saves",
    ],
    [
      "Combat",
      "Sequence of a fight",
      "A combat round is a few seconds of action. Each side rolls 1d6 for initiative; the higher result acts first. On a tie, either re-roll or resolve simultaneously. A character may move and attack, or take another declared action (flee, drink, bind a wound) instead of attacking. Unaware targets may be surprised — typically 1–2 on 1d6 — and lose their first action.",
      "Combat",
    ],
    [
      "Combat",
      "Attack rolls and Armor Class",
      "Roll 1d20, add attack bonus (from class, level, magic, and situational modifiers), and compare to Armor Class. This package assumes ascending Armor Class: a hit occurs when 1d20 + attack bonus >= AC. If the table uses descending (or 'old') Armor Class, convert: ascending AC = 19 − descending AC (so descending AC 0 is 19 ascending). Situational modifiers: rear or unseen attacker typically +2; cover or higher ground may apply a penalty to the attacker. Natural 20 always hits if the table uses that house rule; this summary does not require it.",
      "Combat",
    ],
    [
      "Combat",
      "Damage, hit points, and death",
      "A hit deals the weapon's damage (commonly 1d4 dagger or thrown knife, 1d6 short blade or spear, 1d8 standard sword, 1d10 two-handed). Add Strength bonus to melee if the table uses ability modifiers. Subtract the result from current hit points. At 0 hit points the character is out of the fight — dead, dying, or unconscious per the table's house rule. Healing during a fight is rare; binding wounds after combat restores a small amount if the referee allows it. Monster hit dice indicate both toughness and attack bonus.",
      "Combat",
    ],
    [
      "Combat",
      "Two-handed, missile, and reach",
      "Two-handed weapons usually strike last in the round but deal larger dice. Missile weapons need a free line of fire; firing into a melee risks hitting an ally if the referee calls for it. Spears and other reach weapons may attack from a second rank. Shields improve Armor Class against front-facing attacks; they do not help against rear attacks.",
      "Combat",
    ],
    [
      "Reaction",
      "Monster reaction",
      "When the party meets creatures whose attitude is not already fixed by the adventure, roll 2d6 and apply the speaker's Charisma reaction adjustment. Use roll_table(source=osr, table_name=\"Monster Reaction\"). Low totals mean hostility; high totals mean a chance to talk or even help. The referee may skip the roll when the creatures have an obvious motive (guards on duty, hungry predators that have already committed to a hunt).",
      "Reaction",
    ],
    [
      "Morale",
      "When to check morale",
      "Opponents and retainers have a morale score, usually from 2 (cowardly) to 12 (fanatical). Check morale when the side takes its first casualty, when it is reduced to half strength, when their leader falls, or when the referee judges the situation desperate. Roll 2d6: if the result is greater than the morale score, the side attempts to flee, surrender, or withdraw. A score of 12 means they never check. Player characters do not make morale checks.",
      "Morale",
    ],
    [
      "Morale",
      "Reading the morale roll",
      "Use roll_table(source=osr, table_name=\"Morale Check\") for a colour result, but the mechanical test is 2d6 versus the score: roll > morale means they break. Two successive failures usually mean a full rout. A side that has already broken and is pursued may check again to rally if the referee allows it. Mercenaries and retainers use the same procedure, often with a lower score than elite troops.",
      "Morale",
    ],
    [
      "Hirelings",
      "Hiring retainers",
      "Retainers are NPCs who adventure with the party for a share of treasure (commonly a half-share) plus daily upkeep. Specialists (porters, sages, animal trainers) hire for a listed wage and usually stay out of melee. Availability depends on settlement size. Roll 2d6 modified by the hirer's Charisma using roll_table(source=osr, table_name=\"Hireling Reaction\") to see whether the candidate accepts, haggles, or refuses.",
      "Hirelings",
    ],
    [
      "Hirelings",
      "Loyalty and shares",
      "A retainer's loyalty starts from the hirer's Charisma and shifts with pay, danger, and treatment. Generous shares and fair warning raise loyalty; stinginess, betrayal, or suicidal orders lower it. Loyalty is tested with a morale check in extreme danger or when the hirer is struck down. A retainer reduced to 0 hit points is dead or dying like any other character. Do not treat retainers as disposable extra attack bonuses without consequences at the table.",
      "Hirelings",
    ],
    [
      "Encumbrance",
      "Carried weight and movement",
      "Track significant carried weight (coins, treasure, armor, bulky gear). Four common bands: unencumbered (normal exploration pace, typically 120 feet per dungeon turn); light (90'); heavy (60'); severe (30', cannot run). Worn metal armor usually places a character in light or heavy regardless of coins. Dropping a backpack or treasure sack immediately improves the band. In the wilderness, the same bands scale to miles per day rather than feet per turn.",
      "Encumbrance",
    ],
    [
      "Encumbrance",
      "Treasure and coins",
      "Coins are heavy in bulk. A thousand coins is a meaningful load. Gems and jewellery are compact wealth. If the party is overloaded after a haul, they must cache, hire porters, or make multiple trips. Movement slower than expected is the main cost — wandering encounter checks continue while they stagger.",
      "Encumbrance",
    ],
    [
      "Exploration",
      "Dungeon turns",
      "Indoor exploration uses 10-minute turns. In a turn the party can move at exploration speed while mapping, search a defined area (about a 10-foot section of wall or a room feature), listen at a door, or force a stuck portal. Combat rounds interrupt the turn clock. Rest one turn in six of marching or become fatigued (penalties to attack and movement until they rest).",
      "Exploration",
    ],
    [
      "Exploration",
      "Light, doors, and wandering encounters",
      "Torches and lanterns have a limited duration (a torch is good for a handful of turns; a flask of lantern oil lasts much longer). Darkness means the party cannot map or fight effectively unless someone can see without a lamp. Stuck doors typically open on 1–2 on 1d6 for an unexceptional character; a failed force attempt may trigger a wandering check. Check for wandering encounters on a 1 on 1d6 every other turn (or every turn in a busy area). Use roll_table(source=osr, table_name=\"Wandering Encounter Tick\") for the 1d6 tick itself; the actual monster is on the adventure's own table.",
      "Exploration",
    ],
    [
      "Exploration",
      "Searching and listening",
      "A search takes a turn and covers a limited area. Success is not automatic: secret doors and hidden catches are typically noticed on 1–2 on 1d6 (better odds for characters the referee rules are trained searchers). Listening at a door uses the same 1d6 style. Time spent searching is time on the wandering clock.",
      "Exploration",
    ],
  ];
  for (const r of rules) s.run(...r);
}

function seedOsrProcedures(db: Database.Database): void {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO osr_procedures (topic, content, category) VALUES (?, ?, ?)"
  );
  const rows: [string, string, string][] = [
    [
      "Saving throw",
      "Roll 1d20; succeed by matching or exceeding the target for that class, level, and category (Death/poison, Wands, Paralysis/petrify, Breath, Spells). Look up exact numbers in the licensed book via BYOD. Breath often deals half on a success.",
      "saves",
    ],
    [
      "Initiative",
      "Each side rolls 1d6. Higher acts first. Tie: re-roll or act together. Surprise is commonly 1–2 on 1d6 for an unaware side.",
      "combat",
    ],
    [
      "Attack roll",
      "1d20 + attack bonus vs ascending Armor Class (hit on >= AC). Descending AC converts as 19 minus the old AC. Cover, rear attacks, and magic weapons modify the roll or AC.",
      "combat",
    ],
    [
      "Weapon damage",
      "Typical dice: 1d4 small, 1d6 one-handed, 1d8 standard sword, 1d10 two-handed. Strength often modifies melee. At 0 HP the character is out — dead or dying per table ruling.",
      "combat",
    ],
    [
      "Monster reaction",
      "2d6 plus Charisma adjustment. 2: attack. 3–5: hostile. 6–8: uncertain. 9–11: friendly. 12: helpful. Skip the roll when motive is already obvious. Table name: Monster Reaction.",
      "reaction",
    ],
    [
      "Morale check",
      "Roll 2d6 vs morale score when the side takes its first loss, drops to half, or loses a leader. Roll greater than morale: they break. Score 12 never checks. PCs do not check morale.",
      "morale",
    ],
    [
      "Hireling reaction",
      "2d6 plus Charisma. 2: refuse and badmouth. 3–5: decline. 6–8: haggle. 9–11: accept standard terms. 12: eager. Table name: Hireling Reaction. Retainers usually take a half treasure share.",
      "hirelings",
    ],
    [
      "Retainer loyalty",
      "Starts from the hirer's Charisma. Shifts with pay and treatment. Test with a morale check in extreme danger or if the hirer falls. Poor treatment lowers future hiring rolls in that settlement.",
      "hirelings",
    ],
    [
      "Encumbrance bands",
      "Unencumbered 120'/turn, light 90', heavy 60', severe 30' and cannot run. Armor and coin-hauls are the usual causes. Dropping gear improves the band immediately.",
      "encumbrance",
    ],
    [
      "Exploration turn",
      "10 minutes: move and map, search a small area, listen, or force a door. Rest 1 turn in 6. Wandering tick typically 1 in 6 every two turns. Light sources expire.",
      "exploration",
    ],
    [
      "Stuck doors and searches",
      "Force a stuck door on 1–2 on 1d6 (unexceptional). Failed attempts can make noise. Secret doors and hidden catches: usually 1–2 on 1d6 per turn spent searching a defined area.",
      "exploration",
    ],
  ];
  for (const r of rows) stmt.run(...r);
}

function seedOsrTables(db: Database.Database): void {
  const s = db.prepare(
    "INSERT OR IGNORE INTO osr_tables (name, description, dice_type, min_roll, max_roll, result) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const tables: [string, string, string, number, number, string][] = [
    [
      "Monster Reaction",
      "2d6 first-contact attitude. Apply Charisma reaction adjustment to the roll.",
      "2d6",
      2,
      2,
      "Immediate hostility — they attack or cut off escape",
    ],
    [
      "Monster Reaction",
      "2d6 first-contact attitude. Apply Charisma reaction adjustment to the roll.",
      "2d6",
      3,
      5,
      "Unfriendly — insults, high prices, blocked path; violence if pressed",
    ],
    [
      "Monster Reaction",
      "2d6 first-contact attitude. Apply Charisma reaction adjustment to the roll.",
      "2d6",
      6,
      8,
      "Uncertain — they wait, parley, or demand a reason not to fight",
    ],
    [
      "Monster Reaction",
      "2d6 first-contact attitude. Apply Charisma reaction adjustment to the roll.",
      "2d6",
      9,
      11,
      "Friendly — willing to talk, trade, or let the party pass",
    ],
    [
      "Monster Reaction",
      "2d6 first-contact attitude. Apply Charisma reaction adjustment to the roll.",
      "2d6",
      12,
      12,
      "Helpful — they offer aid, information, or become temporary allies",
    ],
    [
      "Morale Check",
      "Colour result for a 2d6 morale roll. Mechanically, the side breaks if this roll is greater than their morale score.",
      "2d6",
      2,
      2,
      "They grit their teeth and fight on (if the roll still exceeds morale, they break anyway)",
    ],
    [
      "Morale Check",
      "Colour result for a 2d6 morale roll. Mechanically, the side breaks if this roll is greater than their morale score.",
      "2d6",
      3,
      5,
      "Shaken — they look for an exit, fight defensively, or demand terms",
    ],
    [
      "Morale Check",
      "Colour result for a 2d6 morale roll. Mechanically, the side breaks if this roll is greater than their morale score.",
      "2d6",
      6,
      8,
      "Hold the line unless the roll is greater than morale; if it is, they withdraw in order",
    ],
    [
      "Morale Check",
      "Colour result for a 2d6 morale roll. Mechanically, the side breaks if this roll is greater than their morale score.",
      "2d6",
      9,
      11,
      "If this exceeds morale they flee; otherwise they press the attack",
    ],
    [
      "Morale Check",
      "Colour result for a 2d6 morale roll. Mechanically, the side breaks if this roll is greater than their morale score.",
      "2d6",
      12,
      12,
      "Rout or fight to the last — compare to morale score: 12 vs 12 holds, anything lower breaks in panic",
    ],
    [
      "Hireling Reaction",
      "2d6 reaction when offering a retainer or specialist a job. Apply Charisma adjustment.",
      "2d6",
      2,
      2,
      "Refuse and spread a poor reputation — further hiring in this settlement is harder",
    ],
    [
      "Hireling Reaction",
      "2d6 reaction when offering a retainer or specialist a job. Apply Charisma adjustment.",
      "2d6",
      3,
      5,
      "Decline the offer. Another candidate may still be approached.",
    ],
    [
      "Hireling Reaction",
      "2d6 reaction when offering a retainer or specialist a job. Apply Charisma adjustment.",
      "2d6",
      6,
      8,
      "Haggle — they want better pay, a larger share, or a written term of service",
    ],
    [
      "Hireling Reaction",
      "2d6 reaction when offering a retainer or specialist a job. Apply Charisma adjustment.",
      "2d6",
      9,
      11,
      "Accept standard terms (retainer: typically a half treasure share plus upkeep)",
    ],
    [
      "Hireling Reaction",
      "2d6 reaction when offering a retainer or specialist a job. Apply Charisma adjustment.",
      "2d6",
      12,
      12,
      "Eager — may accept a slightly worse deal or bring a friend at the same rate",
    ],
    [
      "Wandering Encounter Tick",
      "1d6 wandering-clock tick. A 1 means an encounter; the creature is on the adventure's own table, not this pack.",
      "1d6",
      1,
      1,
      "Encounter — roll or choose from the current area's encounter table",
    ],
    [
      "Wandering Encounter Tick",
      "1d6 wandering-clock tick. A 1 means an encounter; the creature is on the adventure's own table, not this pack.",
      "1d6",
      2,
      6,
      "No encounter this tick",
    ],
  ];
  for (const t of tables) s.run(...t);
}

function importOperatorNotes(db: Database.Database, sourceDir: string): number {
  if (!existsSync(sourceDir)) {
    return 0;
  }

  const insert = db.prepare(
    "INSERT OR IGNORE INTO osr_core_rules (section, subsection, content, page_hint) VALUES (?, ?, ?, ?)"
  );
  const files = listImportableFiles(sourceDir);
  let imported = 0;
  for (const filePath of files) {
    const rel = relative(sourceDir, filePath).replace(/\\/g, "/");
    let content: string;
    try {
      content = readFileSync(filePath, "utf8").trim();
    } catch {
      continue;
    }
    if (!content) continue;
    insert.run("Operator import", rel, content.slice(0, 50_000), optionsPageHint(sourceDir));
    imported += 1;
  }
  return imported;
}

function optionsPageHint(sourceDir: string): string {
  return `Operator notes from ${sourceDir} (not shipped in git)`;
}

function listImportableFiles(root: string): string[] {
  const out: string[] = [];

  const walk = (dir: string): void => {
    if (out.length >= MAX_IMPORT_FILES) return;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (out.length >= MAX_IMPORT_FILES) return;
      if (name.startsWith(".")) continue;
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      const ext = extname(name).toLowerCase();
      if (!IMPORTABLE_EXTS.has(ext)) continue;
      if (st.size <= 0 || st.size > MAX_IMPORT_FILE_BYTES) continue;
      out.push(full);
    }
  };

  walk(root);
  return out;
}
