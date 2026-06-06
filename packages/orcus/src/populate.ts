// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// OGL SCOPE NOTICE:
// The code in this file (functions, control flow, parsing logic) is AGPL-3.0-only.
// The string literals and parsed content inserted into the database are Open Game
// Content from the Orcus retro-clone rules by Chris Sakkas (Sanglorian), governed
// by the Open Game License v1.0a.
//
// See data/orcus/ATTRIBUTION for full details.
//
// The resulting database output in data/orcus/ is designated as Open Game Content
// under OGL v1.0a.

import Database from "better-sqlite3";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { ensureOrcusSchema } from "./database.js";

const DEFAULT_ORCUS_PATH = resolve(process.cwd(), ".reference", "orcus");

export function populateOrcusDatabase(
  dbPath: string,
  orcusPath?: string
): { success: boolean; message: string } {
  const sourcePath = orcusPath || DEFAULT_ORCUS_PATH;

  if (existsSync(dbPath)) {
    return {
      success: true,
      message: `Orcus database already exists at ${dbPath}. Use --force to repopulate.`,
    };
  }

  if (!existsSync(sourcePath)) {
    return {
      success: false,
      message: `Orcus source directory not found: ${sourcePath}. Clone the Orcus retro-clone (https://github.com/Sanglorian/orcus) into .reference/orcus/ first.`,
    };
  }

  const db = ensureOrcusSchema(dbPath);
  const tx = db.transaction(() => {
    seedSections(db, sourcePath);
    seedClasses(db, sourcePath);
    seedMonsters(db, sourcePath);
    seedFeats(db, sourcePath);
  });
  tx();
  rebuildFts(db);
  db.close();
  return { success: true, message: `Orcus database populated at ${dbPath}` };
}

function rebuildFts(db: Database.Database): void {
  db.exec(`INSERT INTO orcus_sections_fts(orcus_sections_fts) VALUES ('rebuild');`);
}

// ─── SECTIONS (FTS content from rulebook markdown) ──────────────────────

function seedSections(db: Database.Database, sourcePath: string): void {
  const rulebookPath = join(sourcePath, "Orcus Rulebook - current.md");
  if (!existsSync(rulebookPath)) {
    // Try alternate filenames
    const files = existsSync(sourcePath) ? readdirSync(sourcePath).filter(f => f.toLowerCase().includes("rulebook")) : [];
    if (files.length === 0) return;
  }

  const fileToRead = existsSync(rulebookPath) ? rulebookPath : join(sourcePath, readdirSync(sourcePath).find(f => f.toLowerCase().includes("rulebook"))!);
  const content = readFileSync(fileToRead, "utf-8");
  const stmt = db.prepare("INSERT INTO orcus_sections (section, topic, content) VALUES (?, ?, ?)");

  // Strip YAML frontmatter and HTML/markdown meta
  let clean = content
    .replace(/^---[\s\S]*?---\n/m, "")
    .replace(/<div[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<figure>[\s\S]*?<\/figure>/gi, "")
    .replace(/&[a-z]+;/gi, "");
  // Iterative tag stripping to prevent nested-tag bypass (CodeQL
  // js/incomplete-multi-character-sanitization)
  let prev = "";
  while (prev !== clean) {
    prev = clean;
    clean = clean.replace(/<[^>]*>/g, "");
  }

  // Split on h2 (##) or h1 (#) headings
  const blocks = clean.split(/\n(?=#{1,2}\s)/);
  let currentSection = "Introduction";

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.length < 20) continue;

    const lines = trimmed.split("\n");
    const headingLine = lines[0].replace(/^#+\s*/, "").trim();
    if (!headingLine) continue;

    const h1Match = trimmed.match(/^#\s+(.+)$/m);
    if (h1Match) {
      currentSection = h1Match[1].trim();
    }

    let topic = headingLine;
    let body = trimmed;

    if (body.length > 3000) {
      body = body.substring(0, 3000);
    }

    stmt.run(currentSection, topic || null, body);
  }
}

// ─── CLASSES ─────────────────────────────────────────────────────────────

function seedClasses(db: Database.Database, sourcePath: string): void {
  const classesPath = join(sourcePath, "Orcus Classes and Powers - current.md");
  if (!existsSync(classesPath)) {
    const files = existsSync(sourcePath) ? readdirSync(sourcePath).filter(f => f.toLowerCase().includes("class")) : [];
    if (files.length === 0) return;
  }

  const fileToRead = existsSync(classesPath) ? classesPath : join(sourcePath, readdirSync(sourcePath).find(f => f.toLowerCase().includes("class"))!);
  const content = readFileSync(fileToRead, "utf-8");
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO orcus_classes (name, tradition, role, key_ability, hit_points, recoveries, defenses, armor_proficiencies, weapon_proficiencies, trained_skills, talents, features, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  // Known Orcus classes from the rulebook
  const classNames = ["Commander", "Exemplar", "Guardian", "Harlequin", "Mageblade", "Magician", "Priest", "Reaper", "Sylvan"];

  for (const className of classNames) {
    const classBlock = extractClassBlock(content, className);
    if (!classBlock) continue;

    const parsed = parseClassBlock(classBlock, className);
    if (parsed) {
      stmt.run(
        parsed.name, parsed.tradition, parsed.role, parsed.keyAbility,
        parsed.hitPoints, parsed.recoveries, parsed.defenses,
        parsed.armorProficiencies, parsed.weaponProficiencies,
        parsed.trainedSkills, parsed.talents, parsed.features,
        parsed.description
      );
    }
  }
}

function extractClassBlock(content: string, className: string): string | null {
  // Find the class section — starts with "# ClassName" (h1 or h2)
  const pattern = new RegExp(`(?:(?:^|\\n)#\\s+${className}\\s*\\n|^##\\s+${className}\\s*\\n)`);
  const match = content.match(pattern);
  if (!match) return null;

  const startIdx = match.index!;
  // Find the next class heading or end of content
  const rest = content.substring(startIdx + match[0].length);
  const nextClassMatch = rest.match(/\n(?:#\s+[A-Z][a-z]+|##\s+[A-Z][a-z]+)\s*\n/);
  const endIdx = nextClassMatch ? startIdx + match[0].length + nextClassMatch.index! : content.length;

  return content.substring(startIdx, endIdx);
}

interface ParsedClass {
  name: string; tradition: string; role: string; keyAbility: string;
  hitPoints: string; recoveries: string; defenses: string;
  armorProficiencies: string; weaponProficiencies: string;
  trainedSkills: string; talents: string; features: string; description: string;
}

function parseClassBlock(block: string, name: string): ParsedClass | null {
  const lines = block.split("\n");

  const getLine = (label: string): string => {
    const idx = lines.findIndex((l) => l.toLowerCase().includes(label.toLowerCase()));
    if (idx === -1) return "";
    return lines[idx].replace(/^\*?\*?\*?\s*/, "").trim();
  };

  const tradition = getLine("**")?.match(/\*\*(.+)\*\*/)?.[1] || "";
  const roleMatch = lines.find((l) => l.match(/^\*\*[A-Z][a-z]+\s+[A-Z][a-z]+\*\*/));
  const role = roleMatch ? roleMatch.replace(/\*\*/g, "").trim() : "";

  const keyAbilityLine = lines.find((l) => l.includes("Key Ability"));
  const keyAbility = keyAbilityLine ? keyAbilityLine.replace(/\*\*/g, "").replace("Key Ability:", "").replace("Key Ability**", "").split(".")[0].trim() : "";

  const hpLine = lines.find((l) => l.toLowerCase().includes("hit points at 1st level"));
  const hpAdditionLine = lines.find((l) => l.toLowerCase().includes("additional hit points"));
  const hitPoints = hpLine ? `${hpLine.replace(/\*\*/g, "").trim()} / ${(hpAdditionLine || "").replace(/\*\*/g, "").trim()}` : "";

  const recoveryLine = lines.find((l) => l.toLowerCase().includes("recoveries per long rest"));
  const recoveries = recoveryLine ? recoveryLine.replace(/\*\*/g, "").trim() : "";

  const defenseLine = lines.find((l) => l.toLowerCase().includes("defenses:"));
  const defenses = defenseLine ? defenseLine.replace(/\*\*/g, "").replace("Defenses:", "").trim() : "";

  const armorLine = lines.find((l) => l.toLowerCase().includes("armor proficien"));
  const armorProficiencies = armorLine ? armorLine.replace(/\*\*/g, "").replace(/Armor Proficienc\w+:/, "").trim() : "";

  const weaponLine = lines.find((l) => l.toLowerCase().includes("weapon proficien"));
  const weaponProficiencies = weaponLine ? weaponLine.replace(/\*\*/g, "").replace(/Weapon Proficienc\w+:/, "").trim() : "";

  const skillsLine = lines.find((l) => l.toLowerCase().includes("trained skills:"));
  const trainedSkills = skillsLine ? skillsLine.replace(/\*\*/g, "").replace("Trained Skills:", "").trim() : "";

  // Extract talents
  const talentSectionStart = lines.findIndex((l) => l.trim().startsWith("### Talents") || l.trim().startsWith("### Talent"));
  let talents = "";
  if (talentSectionStart >= 0) {
    const talentLines: string[] = [];
    for (let i = talentSectionStart + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith("### ") || lines[i].trim().startsWith("## ")) break;
      if (lines[i].trim() && !lines[i].trim().startsWith("<") && !lines[i].trim().startsWith("</")) {
        talentLines.push(lines[i].trim());
      }
    }
    talents = talentLines.join(" ").substring(0, 1000);
  }

  // Extract features (everything between talents and dualclass)
  const featuresIdx = lines.findIndex((l) => l.trim().startsWith("### "));
  const dualclassIdx = lines.findIndex((l) => l.trim().toLowerCase().includes("dualclass"));
  let featureText = "";
  if (featuresIdx >= 0 && dualclassIdx > featuresIdx) {
    featureText = lines.slice(featuresIdx + 1, dualclassIdx)
      .filter((l) => l.trim() && !l.trim().startsWith("<"))
      .join(" ").substring(0, 1500);
  }

  const desc = lines.slice(0, Math.min(5, lines.length > 20 ? 20 : lines.length))
    .filter((l) => l.trim() && !l.trim().startsWith("<"))
    .join(" ").substring(0, 2000);

  return {
    name,
    tradition,
    role,
    keyAbility,
    hitPoints,
    recoveries,
    defenses,
    armorProficiencies,
    weaponProficiencies,
    trainedSkills,
    talents,
    features: featureText,
    description: desc,
  };
}

// ─── MONSTERS ────────────────────────────────────────────────────────────

function seedMonsters(db: Database.Database, sourcePath: string): void {
  const monstersPath = join(sourcePath, "Orcus Monsters - current.md");
  if (!existsSync(monstersPath)) {
    const files = existsSync(sourcePath) ? readdirSync(sourcePath).filter(f => f.toLowerCase().includes("monster")) : [];
    if (files.length === 0) return;
  }

  const fileToRead = existsSync(monstersPath) ? monstersPath : join(sourcePath, readdirSync(sourcePath).find(f => f.toLowerCase().includes("monster"))!);
  const content = readFileSync(fileToRead, "utf-8");
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO orcus_monsters
     (name, level_info, size, origin_type, alignment, senses, speed,
      ac, fort, ref, will, hp, staggered,
      resistances, vulnerabilities, immunities, traits, actions, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Split on h4 monster headings
  const monsterBlocks = content.split(/\n(?=<h4 class="Heading-4---Monster">)/);
  // Also try splitting on h4 markdown: #### MonsterName
  const altBlocks = content.split(/\n(?=####\s)/);

  const blocks = monsterBlocks.length > altBlocks.length ? monsterBlocks : altBlocks;
  let count = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.length < 100) continue;

    const monster = parseMonsterBlock(trimmed);
    if (monster && monster.name) {
      count++;
      stmt.run(
        monster.name, monster.levelInfo, monster.size, monster.originType,
        monster.alignment, monster.senses, monster.speed,
        monster.ac, monster.fort, monster.ref, monster.will,
        monster.hp, monster.staggered,
        monster.resistances, monster.vulnerabilities, monster.immunities,
        monster.traits, monster.actions, monster.description
      );
    }
  }
}

interface ParsedMonster {
  name: string; levelInfo: string; size: string; originType: string;
  alignment: string; senses: string; speed: string;
  ac: number; fort: number; ref: number; will: number;
  hp: string; staggered: string;
  resistances: string | null; vulnerabilities: string | null; immunities: string | null;
  traits: string | null; actions: string | null; description: string;
}

function parseMonsterBlock(block: string): ParsedMonster | null {
  // Extract name from h4
  const nameMatch = block.match(/(?:<h4[^>]*>|####\s+)(.+?)(?:<\/h4>|$)/);
  if (!nameMatch) return null;
  let name = nameMatch[1];
  let prevName = "";
  while (prevName !== name) {
    prevName = name;
    name = name.replace(/<[^>]*>/g, "");
  }
  name = name.trim();
  if (!name || name.startsWith("<")) return null;

  // Strip HTML tags for text parsing
  let text = block.replace(/&[a-z]+;/gi, "").replace(/\*\*/g, "");
  let prevText = "";
  while (prevText !== text) {
    prevText = text;
    text = text.replace(/<[^>]*>/g, " ");
  }

  // Level info
  const levelMatch = text.match(/Level\s+(\d+)\s*(?:Elite\s+)?(\w+)/i);
  const levelInfo = levelMatch ? `Level ${levelMatch[1]}${levelMatch[2] ? ` ${levelMatch[2]}` : ""}` : "";

  // Size
  const sizeMatch = text.match(/(?:^|\n)\s*(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+/i);
  const size = sizeMatch ? sizeMatch[1] : "";

  // Origin/Type
  const typeMatch = text.match(/(?:^|\n)\s*(?:\w+\s+)?(?:Natural|Cosmic|Abyssal|Elemental|Shadow|Fey)\s+(\w+)/i);
  const originType = typeMatch ? typeMatch[0].trim() : "";

  // Alignment
  const alignMatch = text.match(/(?:Unaligned|Good|Evil|Lawful Good|Chaotic Evil|Chaotic Good|Lawful Evil)/i);
  const alignment = alignMatch ? alignMatch[0] : "";

  // Senses
  const sensesMatch = text.match(/Senses:?\s*(.+?)(?:\n|$)/i);
  const senses = sensesMatch ? sensesMatch[1].trim() : "";

  // Speed
  const speedMatch = text.match(/Speed:?\s*(.+?)(?:\n|$)/i);
  const speed = speedMatch ? speedMatch[1].trim() : "";

  // Defenses
  const acMatch = text.match(/AC:?\s*(\d+)/i);
  const ac = acMatch ? parseInt(acMatch[1], 10) : 0;
  const fortMatch = text.match(/Fort:?\s*(\d+)/i);
  const fort = fortMatch ? parseInt(fortMatch[1], 10) : 0;
  const refMatch = text.match(/Ref:?\s*(\d+)/i);
  const ref = refMatch ? parseInt(refMatch[1], 10) : 0;
  const willMatch = text.match(/Will:?\s*(\d+)/i);
  const will = willMatch ? parseInt(willMatch[1], 10) : 0;

  // HP
  const hpMatch = text.match(/HP:?\s*(\d+)/i);
  const hp = hpMatch ? hpMatch[1] : "";
  const stagMatch = text.match(/Staggered:?\s*(\d+)/i);
  const staggered = stagMatch ? stagMatch[1] : "";

  // Resistances
  const resistMatch = text.match(/Resist:?\s*(.+?)(?:\n|(?:\s{2,})|Vulnerable|Immune)/i);
  const resistances = resistMatch ? resistMatch[1].trim().substring(0, 500) : null;

  // Vulnerabilities
  const vulnMatch = text.match(/Vulnerable:?\s*(.+?)(?:\n|(?:\s{2,})|Immune|Resist|\+)/i);
  const vulnerabilities = vulnMatch ? vulnMatch[1].trim().substring(0, 500) : null;

  // Immunities
  const immuneMatch = text.match(/Immune:?\s*(.+?)(?:\n|(?:\s{2,})|Resist|Vulnerable|\+|\*)/i);
  const immunities = immuneMatch ? immuneMatch[1].trim().substring(0, 500) : null;

  // Description
  const descLines: string[] = [];
  const textLines = text.split("\n");
  let inDesc = false;
  for (const line of textLines) {
    if (inDesc) {
      if (line.match(/^(?:####|<h4|# )/) || line.trim().startsWith("#####")) break;
      if (line.trim()) descLines.push(line.trim());
    }
    if (line.match(/^(?:‡|†|↗|⤢|∢|⋇)/)) {
      inDesc = false;
    }
    if (line.match(/^\w/)) {
      const prevLine = textLines[textLines.indexOf(line) - 1] || "";
      if (prevLine.trim() === "" || prevLine.match(/^(?:‡|†|↗|⤢|∢|⋇)/)) {
        inDesc = true;
        descLines.push(line.trim());
      }
    }
  }
  const description = descLines.join(" ").substring(0, 2000) || levelInfo;

  // Traits and actions — concatenate non-attack entries
  const traitLines: string[] = [];
  const actionLines: string[] = [];
  for (const line of textLines) {
    const trimmed = line.trim();
    if (trimmed.match(/^‡|^↗|^⤢|^∢|^⋇/)) {
      actionLines.push(trimmed.substring(1).trim());
    } else if (trimmed.match(/^\*\*/) && !trimmed.match(/^(?:Level|AC|HP|Fort|Ref|Will|Speed|Str|Con|Dex|Int|Wis|Cha|Init|Initiative|Action|Saving)/)) {
      traitLines.push(trimmed.replace(/\*\*/g, ""));
    }
  }

  return {
    name,
    levelInfo,
    size,
    originType,
    alignment,
    senses,
    speed,
    ac, fort, ref, will,
    hp, staggered,
    resistances, vulnerabilities, immunities,
    traits: traitLines.length > 0 ? traitLines.join(" | ").substring(0, 2000) : null,
    actions: actionLines.length > 0 ? actionLines.join(" | ").substring(0, 2000) : null,
    description,
  };
}

// ─── FEATS ───────────────────────────────────────────────────────────────

function seedFeats(db: Database.Database, sourcePath: string): void {
  const playerOptsPath = join(sourcePath, "Orcus Player Options - current.md");
  if (!existsSync(playerOptsPath)) {
    const files = existsSync(sourcePath) ? readdirSync(sourcePath).filter(f => f.toLowerCase().includes("player")) : [];
    if (files.length === 0) return;
  }

  const fileToRead = existsSync(playerOptsPath) ? playerOptsPath : join(sourcePath, readdirSync(sourcePath).find(f => f.toLowerCase().includes("player"))!);
  const content = readFileSync(fileToRead, "utf-8");
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO orcus_feats (name, prerequisite, category, description) VALUES (?, ?, ?, ?)"
  );

  // Known feat categories in Orcus
  const categories: Record<string, string> = {
    "General Feats": "general",
    "Martial Training Feats": "martial",
    "Art Feats": "art",
    "Channel Divinity Feats": "channel_divinity",
    "Psi Focus Feats": "psi",
    "Shard Feats": "shard",
    "Aura Shard Feats": "shard_aura",
    "Blast Shard Feats": "shard_blast",
    "Shield Shard Feats": "shard_shield",
    "Weapon Shard Feats": "shard_weapon",
  };

  // Parse feat blocks — feats start with ### FeatName
  let currentCategory = "general";

  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Track category
    for (const [catName, catKey] of Object.entries(categories)) {
      if (line.startsWith("## ") && line.toLowerCase().includes(catName.toLowerCase())) {
        currentCategory = catKey;
      }
    }

    // Parse feat heading
    if (line.startsWith("### ") && !line.includes("Feats") && !line.toLowerCase().includes("variants")) {
      const featName = line.replace("### ", "").trim();
      // Skip non-feat headings
      if (featName.length < 2 || featName.length > 60) { i++; continue; }

      let prerequisite: string | null = null;
      const descLines: string[] = [];

      // Look for prerequisite in next line
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.toLowerCase().includes("prerequisite")) {
          prerequisite = nextLine.replace(/\*\*/g, "").trim();
          i++; // consume prerequisite line
        }
      }

      // Collect description
      let j = i + 1;
      while (j < lines.length) {
        const descLine = lines[j].trim();
        if (descLine.startsWith("### ") || descLine.startsWith("## ") || descLine.startsWith("# ")) break;
        if (descLine && !descLine.startsWith("<")) {
          descLines.push(descLine);
        }
        j++;
      }

      const desc = descLines.join(" ").replace(/\*\*/g, "").substring(0, 2000);
      if (desc) {
        try {
          stmt.run(featName, prerequisite, currentCategory, desc);
        } catch {
          // skip duplicates
        }
      }
    }

    i++;
  }
}
