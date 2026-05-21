#!/usr/bin/env -S npx tsx
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
// BYOD E2E pipeline test — transcribes audio → searches OGL+BYOD → synthesizes ruling
// Tests scenarios where the answer depends on BYOD content not found in OGL/DW.
// Usage: BYOD_PATH=.reference node --import tsx scripts/test-byod-pipeline.ts

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, PROJECT_ROOT } from "../src/config.js";
import { transcribeAudioBuffer } from "../src/audio/mlx-transcribe.js";
import { synthesizeRuling as mlxSynthesizeRuling } from "../src/rulings/mlx-synthesize.js";
import {
  openSessionDb, closeSessionDb, createSession,
  logTranscript, storeRuling,
} from "../src/session/database.js";
import {
  searchOglRules, searchCombat, searchShipOps,
  searchOglSkills, searchOglEquipment,
} from "../src/ogl/queries.js";
import { getDatabase } from "../src/ogl/database.js";
import { checkByodConsent, getByodPath } from "../src/byod/gate.js";
import { getByodDatabase, searchByodIndex } from "../src/byod/search.js";

// ---- Scenario definitions ----
interface ByodScenario {
  id: string;
  audioFile: string;
  expectedQuestion: string;
  expectedByodFile: string;       // filename should appear in BYOD search results
  expectedKeywords: string[];      // keywords that should appear in the ruling
  requiresByodOnly: boolean;       // true if OGL/DW cannot answer this
}

const SCENARIOS: ByodScenario[] = [
  {
    id: "sanity loss",
    audioFile: "tests/audio/fixtures/byod/scenario_b1.wav",
    expectedQuestion: "How much Sanity do I lose when encountering a Mythos creature? Can I recover Sanity between investigations?",
    expectedByodFile: "Trail of Cthulhu",
    expectedKeywords: ["sanity", "loss", "mythos", "stability"],
    requiresByodOnly: true,
  },
  {
    id: "connections rule",
    audioFile: "tests/audio/fixtures/byod/scenario_b2.wav",
    expectedQuestion: "How does the Connections Rule work in Traveller character creation? Can I get extra skills?",
    expectedByodFile: "Character_Creation_Master",
    expectedKeywords: ["connections", "rule", "character", "creation", "skill"],
    requiresByodOnly: true,
  },
  {
    id: "mandriano stats",
    audioFile: "tests/audio/fixtures/byod/scenario_b3.wav",
    expectedQuestion: "What are the stats for a Mandriano? Armor class, hit points, Consume the Spark ability?",
    expectedByodFile: "Creature_Codex",
    expectedKeywords: ["mandriano", "armor", "class", "hit", "points", "consume"],
    requiresByodOnly: true,
  },
  {
    id: "memory palace spell",
    audioFile: "tests/audio/fixtures/byod/scenario_b4.wav",
    expectedQuestion: "What does the Memory Palace spell do in Against the Darkmaster? Range, duration, Weave modifiers?",
    expectedByodFile: "Against_the_Darkmaster",
    expectedKeywords: ["memory", "palace", "spell", "range", "duration", "weave"],
    requiresByodOnly: true,
  },
  {
    id: "speculative trade",
    audioFile: "tests/audio/fixtures/byod/scenario_b5.wav",
    expectedQuestion: "What's the checklist for speculative trade? What skill determines purchase price?",
    expectedByodFile: "Cepheus_Engine",
    expectedKeywords: ["speculative", "trade", "purchase", "price", "broker"],
    requiresByodOnly: false,
  },
  {
    id: "starship drive design",
    audioFile: "tests/audio/fixtures/byod/scenario_b6.wav",
    expectedQuestion: "How do maneuver drive ratings work with hull tonnage in Classic Traveller starship design?",
    expectedByodFile: "Starships",
    expectedKeywords: ["maneuver", "drive", "hull", "tonnage"],
    requiresByodOnly: true,
  },
  {
    id: "stability refresh",
    audioFile: "tests/audio/fixtures/byod/scenario_b7.wav",
    expectedQuestion: "How do I refresh my Stability pool between Trail of Cthulhu adventures? Do I need Sources of Stability?",
    expectedByodFile: "Trail of Cthulhu",
    expectedKeywords: ["stability", "refresh", "sources", "investigator"],
    requiresByodOnly: true,
  },
  {
    id: "life events",
    audioFile: "tests/audio/fixtures/byod/scenario_b8.wav",
    expectedQuestion: "If I roll a life event during Traveller career creation, what table do I use? What are examples?",
    expectedByodFile: "Character_Creation_Master",
    expectedKeywords: ["life", "event", "career", "table"],
    requiresByodOnly: true,
  },
  {
    id: "pact lich",
    audioFile: "tests/audio/fixtures/byod/scenario_b9.wav",
    expectedQuestion: "What's the armor class and challenge rating of a Pact Lich from the Creature Codex? Legendary actions?",
    expectedByodFile: "Creature_Codex",
    expectedKeywords: ["pact", "lich", "armor", "class", "undead"],
    requiresByodOnly: true,
  },
  {
    id: "darkmaster difficulty",
    audioFile: "tests/audio/fixtures/byod/scenario_b10.wav",
    expectedQuestion: "What is the standard difficulty for skill checks in Against the Darkmaster? How does roll-over work for crits?",
    expectedByodFile: "Against_the_Darkmaster",
    expectedKeywords: ["difficulty", "skill", "check", "roll"],
    requiresByodOnly: true,
  },
  {
    id: "unrefined fuel",
    audioFile: "tests/audio/fixtures/byod/scenario_b11.wav",
    expectedQuestion: "What are the rules for unrefined fuel in Traveller? Misjump chance? Cost per ton for refined fuel?",
    expectedByodFile: "Traveller",
    expectedKeywords: ["unrefined", "fuel", "misjump", "cost"],
    requiresByodOnly: false,
  },
  {
    id: "swamp song piano",
    audioFile: "tests/audio/fixtures/byod/scenario_b12.wav",
    expectedQuestion: "In Swamp Song, what happens when investigators examine the creepy piano in the speakeasy? Sanity loss?",
    expectedByodFile: "Swamp_Song",
    expectedKeywords: ["piano", "sanity", "loss", "speakeasy"],
    requiresByodOnly: true,
  },
];

// ---- Helpers ----
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "can",
  "could", "i", "you", "he", "she", "it", "we", "they", "this", "that",
  "what", "which", "who", "how", "all", "not", "only", "very",
]);

function extractKeywords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[?.,!;:'"()]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

interface RulesChunk {
  label: string;
  text: string;
}

function lookupRules(question: string): RulesChunk[] {
  const config = loadConfig();
  const oglDb = getDatabase(config.oglDbPath);
  const chunks: RulesChunk[] = [];
  const kwList = extractKeywords(question);

  // OGL search
  for (const r of searchOglRules(oglDb, question)) {
    chunks.push({ label: `OGL: ${r.section} > ${r.title}`, text: r.snippet.replace(/<mark>/g, "**").replace(/<\/mark>/g, "**") });
  }
  for (const kw of kwList) {
    for (const c of searchCombat(oglDb, kw)) chunks.push({ label: `OGL Combat: ${c.category} > ${c.topic}`, text: c.content });
    for (const s of searchShipOps(oglDb, kw)) chunks.push({ label: `OGL Starships: ${s.category} > ${s.topic}`, text: s.content });
    for (const sk of searchOglSkills(oglDb, kw)) chunks.push({ label: `OGL Skill: ${sk.name} (${sk.characteristic})`, text: sk.description });
    for (const eq of searchOglEquipment(oglDb, kw)) chunks.push({ label: `OGL Equipment: ${eq.name} (TL${eq.techLevel})`, text: eq.description });
  }

  // BYOD search (if enabled)
  const byodConsent = checkByodConsent();
  if (byodConsent.allowed) {
    try {
      const byodPath = getByodPath();
      const byodDb = getByodDatabase(byodPath);
      for (const kw of kwList) {
        const byodResults = searchByodIndex(byodDb, kw, 5);
        for (const b of byodResults) {
          chunks.push({ label: `BYOD: ${b.fileName} > ${b.title}`, text: b.snippet.replace(/<mark>/g, "**").replace(/<\/mark>/g, "**") });
        }
      }
    } catch { /* BYOD DB may not exist */ }
  }

  // Score and deduplicate
  const scored = chunks.map((c) => {
    const combined = (c.label + " " + c.text).toLowerCase();
    const hits = kwList.filter((kw) => combined.includes(kw.toLowerCase())).length;
    return { ...c, score: hits + (hits === kwList.length ? 10 : 0) };
  });
  const seen = new Set<string>();
  const deduped = scored.filter((c) => { const k = c.text.substring(0, 100); if (seen.has(k)) return false; seen.add(k); return true; });
  deduped.sort((a, b) => b.score - a.score);
  return deduped.slice(0, 3);
}

function scoreRuling(ruling: string, scenario: ByodScenario, topChunks: RulesChunk[]): {
  kwScore: number;
  byodCited: boolean;
  anySourceCited: boolean;
  total: number;
  notes: string[];
} {
  const lower = ruling.toLowerCase();
  const notes: string[] = [];

  const matched = scenario.expectedKeywords.filter((kw) => lower.includes(kw.toLowerCase()));
  const kwScore = matched.length / Math.max(1, scenario.expectedKeywords.length);

  const byodCited = lower.includes("[byod:") || lower.includes("[BYOD:");
  const anySourceCited = lower.includes("[ogl") || lower.includes("[dw") || byodCited;

  if (!anySourceCited) notes.push("No source citation");
  if (scenario.requiresByodOnly && !byodCited && anySourceCited) notes.push("Cited OGL/DW source for BYOD-only question");

  // Check if ruling references the expected BYOD file
  const hasExpectedFile = topChunks.some((c) => c.label.toLowerCase().includes(scenario.expectedByodFile.toLowerCase()));
  if (!hasExpectedFile && scenario.requiresByodOnly) notes.push(`Expected BYOD file ${scenario.expectedByodFile} not in top chunks`);

  // Bonus for BYOD citation on BYOD-only questions
  const byodBonus = (scenario.requiresByodOnly && byodCited) ? 0.15 : 0;

  const total = Math.min(1, kwScore * 0.4 + (anySourceCited ? 0.35 : 0) + byodBonus + 0.25);

  return { kwScore, byodCited, anySourceCited, total, notes };
}

// ---- Main ----
async function main() {
  console.log("=".repeat(65));
  console.log("  2d6mcp BYOD Pipeline Test — 12 BYOD-dependent scenarios");
  console.log("=".repeat(65));

  const config = loadConfig();
  const sessionDb = openSessionDb(config.sessionDbPath);
  const session = createSession(sessionDb, "ogl", `BYOD Test ${new Date().toISOString()}`);
  console.log(`Session: ${session.id}\n`);

  let passed = 0;
  let failed = 0;
  const results: Record<string, unknown>[] = [];

  // ---- Step 1: Transcribe all audio ----
  const transcripts = new Map<string, string>();
  console.log("--- Transcribing (mlx-community/whisper-large-v3-turbo) ---");
  for (const scenario of SCENARIOS) {
    const fullPath = resolve(PROJECT_ROOT, scenario.audioFile);
    if (!existsSync(fullPath)) {
      console.log(`  [${scenario.id}] SKIP — file missing`);
      continue;
    }
    try {
      const buf = readFileSync(fullPath);
      const result = await transcribeAudioBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      transcripts.set(scenario.id, result.text);
      logTranscript(sessionDb, session.id, result.text, "Player", "voice", "question");
      console.log(`  [${scenario.id}] "${result.text.substring(0, 70)}..."`);
    } catch (err) {
      console.log(`  [${scenario.id}] STT FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log("");

  // ---- Step 2: Synthesize rulings ----
  const model = "mlx-community/Llama-3.2-3B-Instruct-4bit";
  console.log(`--- Ruling synthesis (${model}) ---`);

  for (const scenario of SCENARIOS) {
    const transcript = transcripts.get(scenario.id) || scenario.expectedQuestion;
    const topChunks = lookupRules(transcript);
    const rulesText = topChunks.map((c) => `[${c.label}]\n${c.text}`).join("\n\n");

    const ogCount = topChunks.filter((c) => c.label.startsWith("OGL")).length;
    const byodCount = topChunks.filter((c) => c.label.startsWith("BYOD")).length;

    if (!rulesText) {
      console.log(`  [${scenario.id}] SKIP — no rules found in OGL or BYOD`);
      failed++;
      continue;
    }

    try {
      const start = Date.now();
      const rulingResult = await mlxSynthesizeRuling(transcript, rulesText, { model, temperature: 0.2 });
      const latency = Date.now() - start;

      const score = scoreRuling(rulingResult.response, scenario, topChunks);

      storeRuling(sessionDb, session.id, transcript, rulingResult.response, undefined, rulingResult.model, latency);

      const icon = score.total >= 0.6 ? "✓" : score.total >= 0.4 ? "~" : "✗";
      const byodTag = score.byodCited ? " [BYOD cited]" : "";
      const ogTag = ogCount > 0 ? ` OGL:${ogCount}` : "";
      const byTag = byodCount > 0 ? ` BYOD:${byodCount}` : "";

      console.log(`  ${icon} [${scenario.id}] score=${score.total.toFixed(2)} kw=${score.kwScore.toFixed(2)}${byodTag} ${latency}ms${ogTag}${byTag}`);
      if (score.notes.length > 0) console.log(`           ${score.notes.join("; ")}`);
      console.log(`    Ruling:\n${rulingResult.response}`);
      console.log(`    ---`);

      results.push({
        scenario: scenario.id,
        transcript: transcript.substring(0, 80),
        ruling: rulingResult.response,
        keywords_matched: score.kwScore,
        byod_cited: score.byodCited,
        any_source_cited: score.anySourceCited,
        score: score.total,
        og_chunks: ogCount,
        byod_chunks: byodCount,
        latency_ms: latency,
      });

      if (score.total >= 0.5) passed++;
      else failed++;

    } catch (err) {
      console.log(`  [${scenario.id}] ERROR: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  // ---- Summary ----
  console.log(`\n${"=".repeat(65)}`);
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${SCENARIOS.length} total`);
  console.log("=".repeat(65));

  // Per-scenario detail
  for (const r of results) {
    const byod = r.byod_cited ? " BYOD-CITED" : "";
    const og = r.og_chunks ? ` OGL:${r.og_chunks}` : "";
    const by = r.byod_chunks ? ` BYOD:${r.byod_chunks}` : "";
    console.log(`  ${r.score >= 0.5 ? '✓' : '✗'} [${r.scenario}] score=${r.score.toFixed(2)}${byod}${og}${by} — ${(r.transcript as string).substring(0, 60)}...`);
  }

  closeSessionDb();
}

main().catch(console.error);
