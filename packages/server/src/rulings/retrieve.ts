// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { getDatabase } from "@2d6mcp/ogl/database";
import { ensureDwSchema } from "@2d6mcp/dw/database";
import { ensureBrpSchema } from "@2d6mcp/brp/database";
import { ensure5ecompatibleSchema } from "@2d6mcp/5ecompatible/database";
import { ensureOrcusSchema } from "@2d6mcp/orcus/database";
import {
  searchOglRules,
  searchOglSkills,
  searchOglEquipment,
  searchCombat,
  searchShipOps,
} from "@2d6mcp/ogl";
import {
  searchDwRules,
  searchDwMoves,
  searchDwClasses,
  searchDwEquipment,
  searchDwGmTools,
} from "@2d6mcp/dw";
import {
  searchBrpRules,
  searchBrpCharacteristics,
  searchBrpSkills,
  searchBrpWeaponsMelee,
  searchBrpWeaponsMissile,
  searchBrpArmor,
  searchBrpSpotRules,
} from "@2d6mcp/brp";
import {
  search5ecompatibleRules,
  search5ecompatibleSpells,
  search5ecompatibleMonsters,
  search5ecompatibleClasses,
  search5ecompatibleFeats,
} from "@2d6mcp/5ecompatible";
import {
  searchOrcusRules,
  searchOrcusClasses,
  searchOrcusMonsters,
  searchOrcusFeats,
} from "@2d6mcp/orcus";
import { extractKeywordList, fuzzyKeywordList } from "@2d6mcp/shared";
import { loadConfig } from "../config.js";
import { openSessionDb, getSession } from "../session/database.js";
import { checkByodConsent, getByodPath } from "../byod/gate.js";
import { getByodDatabase, searchByodIndex } from "../byod/search.js";
import {
  ensureOglDb,
  ensureDwDb,
  ensureBrpDb,
  ensure5ecompatibleDb,
  ensureOrcusDb,
  ensureByodForQuery,
} from "../tools/helpers.js";

export const RULES_SYSTEMS = ["ogl", "dw", "brp", "5ecompatible", "orcus"] as const;
export type NamedRulesSystem = (typeof RULES_SYSTEMS)[number];
export type RulesSystem = NamedRulesSystem | "auto";

export interface RetrieveOptions {
  question: string;
  rulesSystem?: string;
  sessionId?: string;
  maxChunks?: number;
}

export interface RetrieveResult {
  context: string;
  resolvedSystem: RulesSystem;
  systemsSearched: NamedRulesSystem[];
  searchCalls: number;
  byodSearched: boolean;
}

function isNamedSystem(value: string): value is NamedRulesSystem {
  return (RULES_SYSTEMS as readonly string[]).includes(value);
}

function isRulesSystem(value: string): value is RulesSystem {
  return value === "auto" || isNamedSystem(value);
}

function stripMarks(snippet: string): string {
  return snippet.replace(/<mark>/g, "**").replace(/<\/mark>/g, "**");
}

function scoreAndTakeTop(
  chunks: string[],
  originalKeywords: string[],
  fuzzyKeywords: string[],
  maxChunks: number
): string[] {
  const scored = chunks.map((text) => {
    const lower = text.toLowerCase();
    const origHits = originalKeywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
    const fuzzyHits = fuzzyKeywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
    return { text, score: origHits * 3 + fuzzyHits + (origHits === originalKeywords.length ? 10 : 0) };
  });

  const seen = new Set<string>();
  const deduped = scored.filter((c) => {
    const key = c.text.substring(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => b.score - a.score);
  return deduped.slice(0, maxChunks).map((c) => c.text);
}

export function resolveRulesSystem(rulesSystem: string | undefined, sessionId: string | undefined): RulesSystem {
  if (rulesSystem && isRulesSystem(rulesSystem)) return rulesSystem;
  if (sessionId) {
    const config = loadConfig();
    const db = openSessionDb(config.sessionDbPath);
    const session = getSession(db, sessionId);
    if (session && isNamedSystem(session.rules_system)) return session.rules_system;
  }
  return "auto";
}

export function questionFromTranscript(transcriptText: string): string {
  const lines = transcriptText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const withQuestion = [...lines].reverse().find((line) => line.includes("?"));
  const picked = withQuestion ?? lines.slice(-4).join(" ");
  return picked.slice(0, 400);
}

export async function retrieveRulesContext(options: RetrieveOptions): Promise<RetrieveResult> {
  const question = options.question.trim();
  const resolvedSystem = resolveRulesSystem(options.rulesSystem, options.sessionId);
  const maxChunks = options.maxChunks ?? 3;
  const systemsSearched: NamedRulesSystem[] =
    resolvedSystem === "auto" ? [...RULES_SYSTEMS] : [resolvedSystem];

  const chunks: string[] = [];
  let searchCalls = 0;
  let byodSearched = false;

  const originalKeywords = extractKeywordList(question);
  const fuzzyKeywords = fuzzyKeywordList(originalKeywords);

  const searchTerm = question.slice(0, 400);

  if (systemsSearched.includes("ogl")) {
    const { dbPath } = ensureOglDb();
    const oglDb = getDatabase(dbPath);
    searchCalls += 1;
    for (const r of searchOglRules(oglDb, searchTerm)) {
      chunks.push(`[OGL: ${r.section} > ${r.title}]\n${stripMarks(r.snippet)}`);
    }
    searchCalls += 4;
    for (const c of searchCombat(oglDb, searchTerm)) {
      chunks.push(`[OGL Combat: ${c.category} > ${c.topic}]\n${c.content}`);
    }
    for (const s of searchShipOps(oglDb, searchTerm)) {
      chunks.push(`[OGL Starships: ${s.category} > ${s.topic}]\n${s.content}`);
    }
    for (const sk of searchOglSkills(oglDb, searchTerm)) {
      chunks.push(`[OGL Skill: ${sk.name} (${sk.characteristic})]\n${sk.description}`);
    }
    for (const eq of searchOglEquipment(oglDb, searchTerm)) {
      chunks.push(`[OGL Equipment: ${eq.name} (TL${eq.techLevel}, ${eq.cost})]\n${eq.description}`);
    }
  }

  if (systemsSearched.includes("dw")) {
    const dwDb = ensureDwSchema(ensureDwDb().dbPath);
    searchCalls += 1;
    for (const r of searchDwRules(dwDb, searchTerm)) {
      chunks.push(`[DW: ${r.section} > ${r.title}]\n${stripMarks(r.snippet)}`);
    }
    searchCalls += 4;
    for (const m of searchDwMoves(dwDb, searchTerm)) {
      chunks.push(`[DW Move: ${m.name} (${m.category})]\n${m.description}`);
    }
    for (const c of searchDwClasses(dwDb, searchTerm)) {
      chunks.push(`[DW Class: ${c.name}]\n${c.description ?? c.starting_moves ?? ""}`);
    }
    for (const e of searchDwEquipment(dwDb, searchTerm)) {
      chunks.push(`[DW Equipment: ${e.name} (${e.category})]\n${e.description ?? `${e.cost ?? "?"}, ${e.weight ?? "?"} wt`}`);
    }
    for (const g of searchDwGmTools(dwDb, searchTerm)) {
      chunks.push(`[DW GM: ${g.category ?? "rules"} > ${g.topic}]\n${g.content}`);
    }
  }

  if (systemsSearched.includes("brp")) {
    const brpDb = ensureBrpSchema(ensureBrpDb().dbPath);
    searchCalls += 1;
    for (const r of searchBrpRules(brpDb, searchTerm)) {
      chunks.push(`[BRP: ${r.section} > ${r.title}]\n${stripMarks(r.snippet)}`);
    }
    searchCalls += 6;
    for (const s of searchBrpSkills(brpDb, searchTerm)) {
      chunks.push(`[BRP Skill: ${s.name} (${s.baseChance})]\n${s.description}`);
    }
    for (const c of searchBrpCharacteristics(brpDb, searchTerm)) {
      chunks.push(`[BRP Characteristic: ${c.name} (${c.abbreviation}, ${c.dice})]\n${c.description}`);
    }
    for (const a of searchBrpArmor(brpDb, searchTerm)) {
      chunks.push(`[BRP Armor: ${a.name} (${a.armorPoints} points, ${a.skillModifier})]\n`);
    }
    for (const w of searchBrpWeaponsMelee(brpDb, searchTerm)) {
      chunks.push(`[BRP Weapon: ${w.name} (${w.skill}, ${w.damage})]\n`);
    }
    for (const w of searchBrpWeaponsMissile(brpDb, searchTerm)) {
      chunks.push(`[BRP Missile Weapon: ${w.name} (${w.skill}, ${w.damage}, ${w.range})]\n`);
    }
    for (const r of searchBrpSpotRules(brpDb, searchTerm)) {
      chunks.push(`[BRP Spot Rule: ${r.category} > ${r.topic}]\n${r.content}`);
    }
  }

  if (systemsSearched.includes("5ecompatible")) {
    const sr5eDb = ensure5ecompatibleSchema(ensure5ecompatibleDb().dbPath);
    searchCalls += 1;
    for (const r of search5ecompatibleRules(sr5eDb, searchTerm)) {
      chunks.push(`[5E: ${r.section} > ${r.title}]\n${stripMarks(r.snippet)}`);
    }
    searchCalls += 4;
    for (const s of search5ecompatibleSpells(sr5eDb, searchTerm)) {
      chunks.push(`[5E Spell: ${s.name} (Level ${s.level} ${s.school})]\n${s.description}`);
    }
    for (const m of search5ecompatibleMonsters(sr5eDb, searchTerm)) {
      chunks.push(`[5E Monster: ${m.name} (${m.type}, CR ${m.challengeRating})]\n${m.description}`);
    }
    for (const c of search5ecompatibleClasses(sr5eDb, searchTerm)) {
      chunks.push(`[5E Class: ${c.name} (${c.hitDie}, ${c.primaryAbility})]\n${c.description}`);
    }
    for (const f of search5ecompatibleFeats(sr5eDb, searchTerm)) {
      chunks.push(`[5E Feat: ${f.name} (${f.prerequisite})]\n${f.description}`);
    }
  }

  if (systemsSearched.includes("orcus")) {
    const orcusDb = ensureOrcusSchema(ensureOrcusDb().dbPath);
    searchCalls += 1;
    for (const r of searchOrcusRules(orcusDb, searchTerm)) {
      chunks.push(`[Orcus: ${r.section} > ${r.title}]\n${stripMarks(r.snippet)}`);
    }
    searchCalls += 3;
    for (const c of searchOrcusClasses(orcusDb, searchTerm)) {
      chunks.push(`[Orcus Class: ${c.name} (${c.tradition} ${c.role})]\n${c.description}`);
    }
    for (const m of searchOrcusMonsters(orcusDb, searchTerm)) {
      chunks.push(`[Orcus Monster: ${m.name} (${m.levelInfo})]\n${m.description}`);
    }
    for (const f of searchOrcusFeats(orcusDb, searchTerm)) {
      chunks.push(`[Orcus Feat: ${f.name} (${f.category})]\n${f.description}`);
    }
  }

  const byodConsent = checkByodConsent();
  if (byodConsent.allowed) {
    try {
      const byodPath = getByodPath();
      const config = loadConfig();
      let byodSystemFilter = "";
      if (options.sessionId) {
        const db = openSessionDb(config.sessionDbPath);
        const session = getSession(db, options.sessionId);
        byodSystemFilter = session?.byod_system || "";
      }
      const ensured = await ensureByodForQuery(config, question, byodSystemFilter || undefined);
      const byodDb = getByodDatabase(byodPath);
      searchCalls += 1;
      byodSearched = true;
      const prefixes = ensured.matchedRoots.length > 0 ? ensured.matchedRoots : [];
      const byodResults = searchByodIndex(byodDb, searchTerm, 8, prefixes);
      for (const b of byodResults) {
        chunks.push(`[BYOD: ${b.fileName} > ${b.title}]\n${stripMarks(b.snippet)}`);
      }
    } catch {
      // BYOD DB may not exist yet
    }
  }

  const context =
    scoreAndTakeTop(chunks, originalKeywords, fuzzyKeywords, maxChunks).join("\n\n") ||
    "No matching rules found in the selected rules databases or BYOD index.";

  return {
    context,
    resolvedSystem,
    systemsSearched,
    searchCalls,
    byodSearched,
  };
}
