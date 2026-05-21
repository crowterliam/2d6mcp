#!/usr/bin/env -S npx tsx
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
// E2E pipeline test — exercises transcribe, synthesize, contextual ruling, and summarization
// against OGL-covered scenarios with real audio files.
// Usage: node --import tsx scripts/test-pipeline.ts

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { loadConfig, PROJECT_ROOT } from "../src/config.js";
import { transcribeAudioBuffer } from "../src/audio/mlx-transcribe.js";
import { synthesizeRuling as mlxSynthesizeRuling } from "../src/rulings/mlx-synthesize.js";
import {
  openSessionDb,
  closeSessionDb,
  createSession,
  endSession,
  setSessionSummary,
  logTranscript,
  getRecentContext,
  storeRuling,
  getTranscript,
} from "../src/session/database.js";
import {
  searchOglRules,
  searchCombat,
  searchShipOps,
  searchOglSkills,
  searchOglEquipment,
} from "../src/ogl/queries.js";
import { getDatabase } from "../src/ogl/database.js";

// ---- Scenario definitions ----
interface Scenario {
  id: number;
  audioFile: string;
  expectedQuestion: string;
  expectedKeywords: string[];
  oglCategory: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    audioFile: "tests/audio/fixtures/scenario_1.wav",
    expectedQuestion: "What are the modifiers for attacking from cover in combat?",
    expectedKeywords: ["cover", "modifier", "attack", "DM"],
    oglCategory: "combat",
  },
  {
    id: 2,
    audioFile: "tests/audio/fixtures/scenario_2.wav",
    expectedQuestion: "What is the range and damage of a laser rifle?",
    expectedKeywords: ["laser", "range", "damage", "rifle"],
    oglCategory: "equipment",
  },
  {
    id: 3,
    audioFile: "tests/audio/fixtures/scenario_3.wav",
    expectedQuestion: "How do I use the engineering skill to repair a starship drive?",
    expectedKeywords: ["engineering", "repair", "starship", "drive"],
    oglCategory: "skills",
  },
  {
    id: 4,
    audioFile: "tests/audio/fixtures/scenario_4.wav",
    expectedQuestion: "What happens when we misjump during a hyperspace jump?",
    expectedKeywords: ["misjump", "jump", "hyperspace", "starship"],
    oglCategory: "starships",
  },
  {
    id: 5,
    audioFile: "tests/audio/fixtures/scenario_5.wav",
    expectedQuestion: "Can I grapple someone who is prone in close combat?",
    expectedKeywords: ["grapple", "prone", "combat", "melee"],
    oglCategory: "combat",
  },
  {
    id: 6,
    audioFile: "tests/audio/fixtures/scenario_6.wav",
    expectedQuestion: "How do I determine the tech level of a star system?",
    expectedKeywords: ["tech", "level", "star", "system", "world"],
    oglCategory: "worlds",
  },
  {
    id: 7,
    audioFile: "tests/audio/fixtures/scenario_7.wav",
    expectedQuestion: "What is the difficulty for a routine task check?",
    expectedKeywords: ["routine", "task", "difficulty", "check", "DM"],
    oglCategory: "rules",
  },
  {
    id: 8,
    audioFile: "tests/audio/fixtures/scenario_8.wav",
    expectedQuestion: "How does armor protect against laser weapons in combat?",
    expectedKeywords: ["armor", "laser", "weapon", "protection", "combat"],
    oglCategory: "combat",
  },
];

// ---- Helper: normalise OGL search results ----
interface RulesChunk {
  label: string;
  text: string;
}

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "i", "you", "he",
  "she", "it", "we", "they", "me", "him", "her", "us", "them", "my",
  "your", "his", "its", "our", "their", "this", "that", "these", "those",
  "what", "which", "who", "whom", "when", "where", "why", "how", "all",
  "each", "every", "both", "few", "more", "most", "other", "some", "no",
  "not", "only", "own", "same", "so", "than", "too", "very", "just",
  "because", "but", "and", "or", "if", "while", "of", "at", "by", "for",
  "with", "about", "into", "through", "during", "before", "after", "and",
]);

function extractKeywords(text: string): string {
  return text.toLowerCase()
    .replace(/[?.,!;:'"()]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .join(" ");
}

function lookupOglRules(searchTerm: string): RulesChunk[] {
  const config = loadConfig();
  const db = getDatabase(config.oglDbPath);
  const chunks: RulesChunk[] = [];
  const kwList = extractKeywords(searchTerm).split(/\s+/).filter(Boolean);

  const ftsResults = searchOglRules(db, searchTerm);
  for (const r of ftsResults) {
    chunks.push({
      label: `OGL: ${r.section} > ${r.title}`,
      text: r.snippet.replace(/<mark>/g, "**").replace(/<\/mark>/g, "**"),
    });
  }

  // Per-keyword LIKE searches — combat/ships first (most relevant for rulings)
  for (const kw of kwList) {
    const combat = searchCombat(db, kw);
    for (const c of combat) {
      chunks.push({ label: `OGL Combat: ${c.category} > ${c.topic}`, text: c.content });
    }
    const ships = searchShipOps(db, kw);
    for (const s of ships) {
      chunks.push({ label: `OGL Starships: ${s.category} > ${s.topic}`, text: s.content });
    }
  }
  for (const kw of kwList) {
    const skills = searchOglSkills(db, kw);
    for (const sk of skills) {
      chunks.push({ label: `OGL Skill: ${sk.name} (${sk.characteristic})`, text: sk.description });
    }
    const equip = searchOglEquipment(db, kw);
    for (const eq of equip) {
      chunks.push({ label: `OGL Equipment: ${eq.name} (TL${eq.techLevel})`, text: eq.description });
    }
  }

  // Score chunks by keyword overlap and deduplicate
  const scored = chunks.map((c) => {
    const combined = c.label + " " + c.text;
    const hits = kwList.filter((kw) => combined.toLowerCase().includes(kw)).length;
    return { ...c, score: hits };
  });

  const seen = new Set<string>();
  const deduped = scored.filter((c) => {
    const key = c.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => b.score - a.score);

  return deduped;
}

// ---- Main ----
async function main() {
  console.log("=" .repeat(60));
  console.log("  2d6mcp E2E Pipeline Test");
  console.log("=" .repeat(60));

  const config = loadConfig();
  const sessionDb = openSessionDb(config.sessionDbPath);
  const session = createSession(sessionDb, "ogl", `E2E Test ${new Date().toISOString()}`);
  console.log(`\nSession: ${session.id}`);

  let passed = 0;
  let failed = 0;
  const results: Record<string, unknown>[] = [];

  for (const scenario of SCENARIOS) {
    const fullPath = resolve(PROJECT_ROOT, scenario.audioFile);
    if (!existsSync(fullPath)) {
      console.log(`\n[Scenario ${scenario.id}] SKIP — audio file not found: ${fullPath}`);
      failed++;
      continue;
    }

    console.log(`\n${"-".repeat(50)}`);
    console.log(`[Scenario ${scenario.id}] ${scenario.expectedQuestion}`);
    console.log(`  Audio: ${scenario.audioFile} (${(readFileSync(fullPath).length / 1024).toFixed(1)} KB)`);

    const startTotal = Date.now();

    // Step 1 — Transcribe
    let transcript = "";
    let tLatency = 0;
    try {
      const tStart = Date.now();
      const buf = readFileSync(fullPath);
      const tResult = await transcribeAudioBuffer(
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      );
      transcript = tResult.text;
      tLatency = Date.now() - tStart;
      console.log(`  STT: "${transcript}" (${tLatency}ms, model: ${tResult.model})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  STT: FAILED — ${msg}`);
      failed++;
      continue;
    }

    // Step 2 — Log transcript
    const seg = logTranscript(sessionDb, session.id, transcript, "Player", "voice", "question");
    console.log(`  Logged: segment #${seg.id}`);

    // Step 3 — Rules lookup
    const rulesChunks = lookupOglRules(transcript);
    console.log(`  Rules lookup: ${rulesChunks.length} chunks found`);
    if (rulesChunks.length === 0) {
      console.log(`  WARNING: No OGL rules matched for this query`);
    }

    // Step 4 — Synthesize ruling
    let ruling = "";
    try {
      const rStart = Date.now();
      const topChunks = rulesChunks.slice(0, 3);
      const rulesText = topChunks.map((c) => `[${c.label}]\n${c.text}`).join("\n\n") || "No matching rules in OGL database.";
      const rulingResult = await mlxSynthesizeRuling(transcript, rulesText);
      ruling = rulingResult.response;
      const rLatency = Date.now() - rStart;

      storeRuling(sessionDb, session.id, transcript, ruling, undefined, rulingResult.model, rLatency);

      console.log(`  Ruling: "${ruling}"`);
      console.log(`  LLM: ${rLatency}ms (model: ${rulingResult.model})`);

      // Step 5 — Check for expected keywords
      const matchCount = scenario.expectedKeywords.filter((kw) =>
        ruling.toLowerCase().includes(kw.toLowerCase())
      ).length;
      const matchRatio = matchCount / scenario.expectedKeywords.length;

      const totalLatency = Date.now() - startTotal;
      const status = matchRatio >= 0.3 ? "PASS" : "WARN";

      console.log(`  Keywords matched: ${matchCount}/${scenario.expectedKeywords.length} (${status})`);
      console.log(`  Total latency: ${totalLatency}ms`);

      results.push({
        scenario: scenario.id,
        transcript,
        ruling,
        keywords_matched: matchCount,
        keywords_total: scenario.expectedKeywords.length,
        match_ratio: matchRatio,
        latency_stt_ms: tLatency || 0,
        latency_llm_ms: rLatency,
        latency_total_ms: totalLatency,
        status,
      });

      if (status === "PASS") passed++;
      else failed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  Ruling: FAILED — ${msg}`);
      failed++;
    }
  }

  // Step 6 — Test resolve_from_context
  console.log(`\n${"-".repeat(50)}`);
  console.log("[resolve_from_context] Testing contextual pipeline...");

  const { transcripts, rulings } = getRecentContext(sessionDb, session.id, 60);
  console.log(`  Recent transcript segments: ${transcripts.length}`);
  console.log(`  Recent rulings: ${rulings.length}`);

  if (transcripts.length > 0) {
    const transcriptText = transcripts
      .map((t) => {
        const prefix = t.speaker ? `${t.speaker}: ` : "";
        return `${prefix}${t.text}`;
      })
      .join("\n");

    const rulesChunks = lookupOglRules(transcriptText);
    const rulesText = rulesChunks.slice(0, 5)
      .map((c) => `[${c.label}]\n${c.text}`)
      .join("\n\n");

    const history = rulings.length > 0
      ? `Previous rulings from this session:\n${rulings.map((r) => `Q: ${r.question}\nA: ${r.ruling_text}`).join("\n\n")}\n\n`
      : "";

    try {
      const ctxPrompt = `You are a TTRPG GM assistant. Based on the game transcript below, identify any rules questions being discussed and provide concise rulings using the reference text provided. Do not repeat old rulings. If the transcript does not contain a clear rules question, say so. If you cannot answer from the reference text, say: "Insufficient reference text."`;

      const result = await mlxSynthesizeRuling(
        ctxPrompt + `\n\nTranscript:\n${transcriptText.substring(0, 1500)}`,
        `${history}Rules:\n${rulesText}`,
        { temperature: 0.2 }
      );
      console.log(`  Contextual ruling: "${result.response}"`);
      console.log(`  Model: ${result.model}, ${result.durationSeconds}s`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  Contextual ruling FAILED: ${msg}`);
    }
  }

  // Step 7 — Session summary
  console.log(`\n${"-".repeat(50)}`);
  console.log("[Session Summary] Generating...");

  const allSegments = getTranscript(sessionDb, session.id, 500);
  if (allSegments.length > 0) {
    const fullTranscript = allSegments.map((s) => {
      const prefix = s.speaker ? `${s.speaker}: ` : "";
      return `${prefix}${s.text}`;
    }).join("\n");

    try {
      const summaryResult = await mlxSynthesizeRuling(
        fullTranscript,
        undefined,
        {
          maxTokens: 1024,
          temperature: 0.5,
          systemPrompt: [
            "You summarize TTRPG game sessions concisely.",
            "Include: key events, NPCs encountered, locations visited, combat outcomes, loot found, unresolved threads.",
            "Format as bullet points. Be specific. Do not invent events not in the transcript.",
          ].join("\n"),
        }
      );
      setSessionSummary(sessionDb, session.id, summaryResult.response);
      console.log(`  Summary:\n${summaryResult.response}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  Summary FAILED: ${msg}`);
    }
  }

  endSession(sessionDb, session.id);

  // ---- Report ----
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${SCENARIOS.length} total`);
  console.log(`  Session: ${session.id}`);
  console.log("=" .repeat(60));

  closeSessionDb();

  // Output JSON for machine reading
  console.log("\n--- JSON RESULTS ---");
  console.log(JSON.stringify({ session_id: session.id, passed, failed, results }, null, 2));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
