// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { getDatabase } from "@2d6mcp/ogl/database";
import { ensureDwSchema } from "@2d6mcp/dw/database";
import { ensureBrpSchema } from "@2d6mcp/brp/database";
import { ensure5ecompatibleSchema } from "@2d6mcp/5ecompatible/database";
import { ensureOrcusSchema } from "@2d6mcp/orcus/database";
import { ensureOsrSchema } from "@2d6mcp/osr/database";
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
import {
  searchOsrRules,
  searchOsrProcedures,
} from "@2d6mcp/osr";
import { extractKeywordList, fuzzyKeywordList } from "@2d6mcp/shared";
import { loadConfig } from "../config.js";
import { sessionStore, getSession } from "../session/database.js";
import { checkByodConsent, getByodPath } from "../byod/gate.js";
import { getByodDatabase, searchByodIndex } from "../byod/search.js";
import {
  ensureOglDb,
  ensureDwDb,
  ensureBrpDb,
  ensure5ecompatibleDb,
  ensureOrcusDb,
  ensureOsrDb,
  ensureByodForQuery,
} from "../tools/helpers.js";

export const RULES_SYSTEMS = ["ogl", "dw", "brp", "5ecompatible", "orcus", "osr"] as const;
export type NamedRulesSystem = (typeof RULES_SYSTEMS)[number];
export type RulesSystem = NamedRulesSystem | "auto" | "byod";

export const BYOD_PREFERRED_WARNING =
  "byod_system is set, so retrieval prefers indexed personal files. Pass rules_context from get_byod_chunk when you already have chunks. Licensed databases are skipped unless rules_system is set explicitly.";

export interface RetrieveOptions {
  question: string;
  rulesSystem?: string;
  sessionId?: string;
  maxChunks?: number;
  byodSystem?: string;
  byodRoot?: string;
}

export interface RetrieveResult {
  context: string;
  resolvedSystem: RulesSystem;
  systemsSearched: NamedRulesSystem[];
  searchCalls: number;
  byodSearched: boolean;
  byodHits: number;
  warnings: string[];
  byodSystem: string;
}

function isNamedSystem(value: string): value is NamedRulesSystem {
  return (RULES_SYSTEMS as readonly string[]).includes(value);
}

function isRulesSystem(value: string): value is RulesSystem {
  return value === "auto" || value === "byod" || isNamedSystem(value);
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

export function resolveRulesSystem(
  rulesSystem: string | undefined,
  sessionId: string | undefined,
  byodSystemHint?: string
): RulesSystem {
  if (rulesSystem && isRulesSystem(rulesSystem)) return rulesSystem;

  let sessionByod = "";
  let sessionRules: RulesSystem | undefined;
  if (sessionId) {
    const db = sessionStore();
    const session = getSession(db, sessionId);
    sessionByod = session?.byod_system?.trim() || "";
    if (session?.rules_system === "byod") {
      sessionRules = "byod";
    } else if (session && isNamedSystem(session.rules_system)) {
      sessionRules = session.rules_system;
    }
  }

  if (byodSystemHint?.trim() || sessionByod) return "byod";
  return sessionRules ?? "auto";
}

const INTERROGATIVE_STARTS = new Set([
  "what",
  "how",
  "when",
  "where",
  "why",
  "which",
  "can",
  "does",
  "is",
  "target",
  "average",
  "check",
]);

const RULES_WORDS = ["broker", "check", "tn", "difficulty"];

interface TranscriptLine {
  speaker: string | null;
  text: string;
  raw: string;
}

function parseSpeakerLine(line: string): TranscriptLine {
  const match = line.match(/^([^:]{1,40}):\s*(.*)$/);
  if (!match) return { speaker: null, text: line, raw: line };
  const speaker = match[1].trim();
  if (!/^[A-Za-z][A-Za-z0-9 _-]{0,39}$/.test(speaker)) {
    return { speaker: null, text: line, raw: line };
  }
  const text = match[2].trim();
  return { speaker, text: text || line, raw: line };
}

function isSystemSpeaker(speaker: string | null): boolean {
  return speaker !== null && speaker.toLowerCase() === "system";
}

function isMeSpeaker(speaker: string | null): boolean {
  return speaker !== null && speaker.toLowerCase() === "me";
}

export function isRulesIshUtterance(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.includes("?")) return true;
  const lower = trimmed.toLowerCase();
  const firstWord = lower.match(/^[a-z]+/)?.[0] ?? "";
  if (INTERROGATIVE_STARTS.has(firstWord)) return true;
  return RULES_WORDS.some((word) => {
    if (word === "tn") {
      return /(^|[^a-z0-9])tn([^a-z0-9]|$)/i.test(lower);
    }
    return lower.includes(word);
  });
}

export interface TranscriptSegmentLike {
  timestamp?: number;
  id?: number;
  speaker?: string | null;
  text: string;
}

/** Oldest-first blob so questionFromTranscript can pick the most recent line from the end. */
export function formatTranscriptForQuestion(segments: TranscriptSegmentLike[]): string {
  return [...segments]
    .sort((a, b) => {
      const time = (a.timestamp ?? 0) - (b.timestamp ?? 0);
      if (time !== 0) return time;
      return (a.id ?? 0) - (b.id ?? 0);
    })
    .map((segment) => {
      const speakerPrefix = segment.speaker ? `${segment.speaker}: ` : "";
      return `${speakerPrefix}${segment.text}`;
    })
    .join("\n");
}

export function questionFromTranscript(transcriptText: string): string {
  const lines = transcriptText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";

  const parsed = lines.map(parseSpeakerLine);
  const useful = parsed.filter((line) => !isSystemSpeaker(line.speaker));
  if (useful.length === 0) return "";

  const meLines = useful.filter((line) => isMeSpeaker(line.speaker));
  for (let i = meLines.length - 1; i >= 0; i--) {
    if (isRulesIshUtterance(meLines[i].text)) {
      return meLines[i].text.slice(0, 400);
    }
  }

  const withQuestion = [...useful].reverse().find((line) => line.text.includes("?") || line.raw.includes("?"));
  if (withQuestion) {
    return (withQuestion.text || withQuestion.raw).slice(0, 400);
  }

  const picked = useful.slice(-4).map((line) => line.raw).join(" ");
  return picked.slice(0, 400);
}

export async function retrieveRulesContext(options: RetrieveOptions): Promise<RetrieveResult> {
  const question = options.question.trim();
  const maxChunks = options.maxChunks ?? 3;
  const warnings: string[] = [];

  let sessionByod = "";
  if (options.sessionId) {
    const db = sessionStore();
    const session = getSession(db, options.sessionId);
    sessionByod = session?.byod_system?.trim() || "";
  }
  const byodSystem = options.byodSystem?.trim() || sessionByod;
  const resolvedSystem = resolveRulesSystem(options.rulesSystem, options.sessionId, byodSystem);
  const systemsSearched: NamedRulesSystem[] =
    resolvedSystem === "auto" ? [...RULES_SYSTEMS] : resolvedSystem === "byod" ? [] : [resolvedSystem];

  if (byodSystem) {
    warnings.push(BYOD_PREFERRED_WARNING);
  }

  const chunks: string[] = [];
  let searchCalls = 0;
  let byodSearched = false;
  let byodHits = 0;

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

  if (systemsSearched.includes("osr")) {
    const osrDb = ensureOsrSchema(ensureOsrDb().dbPath);
    searchCalls += 1;
    for (const r of searchOsrRules(osrDb, searchTerm)) {
      chunks.push(`[OSR: ${r.section} > ${r.title}]\n${stripMarks(r.snippet)}`);
    }
    searchCalls += 1;
    for (const p of searchOsrProcedures(osrDb, searchTerm)) {
      chunks.push(`[OSR Procedure: ${p.category} > ${p.topic}]\n${p.content}`);
    }
  }

  const byodConsent = checkByodConsent();
  if (byodConsent.allowed) {
    try {
      const byodPath = getByodPath();
      const config = loadConfig();
      const ensured = await ensureByodForQuery(config, question, byodSystem || undefined, {
        root: options.byodRoot,
      });
      const byodDb = getByodDatabase(byodPath);
      searchCalls += 1;
      byodSearched = true;
      const prefixes = ensured.matchedRoots.length > 0 ? ensured.matchedRoots : [];
      const byodResults = searchByodIndex(byodDb, searchTerm, 8, prefixes);
      byodHits = byodResults.length;
      for (const b of byodResults) {
        chunks.push(`[BYOD: ${b.fileName} > ${b.title}]\n${stripMarks(b.snippet)}`);
      }
    } catch {
      // BYOD DB may not exist yet
    }
  } else if (byodSystem) {
    warnings.push(
      "BYOD consent is off, so personal files were not searched. Enable AGREE_BYOD_USE or pass rules_context."
    );
  }

  const context =
    scoreAndTakeTop(chunks, originalKeywords, fuzzyKeywords, maxChunks).join("\n\n") ||
    (resolvedSystem === "byod"
      ? "No matching BYOD chunks. Pin query_local_byod with root/relative_path, then pass rules_context from get_byod_chunk. Licensed databases were not searched."
      : "No matching rules found in the selected rules databases or BYOD index.");

  return {
    context,
    resolvedSystem,
    systemsSearched,
    searchCalls,
    byodSearched,
    byodHits,
    warnings,
    byodSystem,
  };
}
