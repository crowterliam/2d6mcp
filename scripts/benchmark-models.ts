#!/usr/bin/env -S npx tsx
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
// Model benchmark — tests multiple MLX LLM models against all scenarios.
// Usage: node --import tsx scripts/benchmark-models.ts [--models m1,m2,...] [--skip-stt]

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, PROJECT_ROOT } from "../src/config.js";
import { transcribeAudioBuffer } from "../src/audio/mlx-transcribe.js";
import { synthesizeRuling as mlxSynthesizeRuling } from "../src/rulings/mlx-synthesize.js";
import {
  openSessionDb, closeSessionDb, createSession, endSession,
  logTranscript, getTranscript, storeRuling,
} from "../src/session/database.js";
import {
  searchOglRules, searchCombat, searchShipOps,
  searchOglSkills, searchOglEquipment,
} from "../src/ogl/queries.js";
import { getDatabase } from "../src/ogl/database.js";

// ---- Configuration ----
interface ModelConfig {
  id: string;
  name: string;
  size: string;
  description: string;
}

const MODELS: ModelConfig[] = [
  { id: "mlx-community/Llama-3.2-3B-Instruct-4bit", name: "Llama-3.2-3B", size: "3B", description: "Current baseline — fast, 2GB RAM" },
  { id: "mlx-community/Llama-3.2-1B-Instruct", name: "Llama-3.2-1B", size: "1B", description: "Ultra-fast — for classification only" },
  { id: "mlx-community/Llama-3.1-8B-Instruct-4bit", name: "Llama-3.1-8B", size: "8B", description: "Larger model — more honest but slower" },
  { id: "mlx-community/Qwen2.5-7B-Instruct-4bit", name: "Qwen2.5-7B", size: "7B", description: "Mid-range model — tests structured data accuracy" },
];

const DEFAULT_MODELS = process.env.BENCHMARK_MODELS?.split(",") || ["3B"];
const SKIP_STT = process.argv.includes("--skip-stt");

// ---- Scenario definitions ----
interface Scenario {
  id: string;
  audioFile: string;
  expectedQuestion: string;
  expectedKeywords: string[];
  mustCiteSource: boolean;
  mustNotHallucinate: string[];  // phrases that should NOT appear
}

const COMPLEX_SCENARIOS: Scenario[] = [
  {
    id: "cover complex",
    audioFile: "tests/audio/fixtures/complex/scenario_c1.wav",
    expectedQuestion: "What combat modifiers apply when leaning out from behind a low wall to shoot? Do I get benefit from cover? Does crouching vs standing matter?",
    expectedKeywords: ["cover", "modifier", "crouch", "DM", "-1", "-2"],
    mustCiteSource: true,
    mustNotHallucinate: ["+2", "bonus", "advantage"],
  },
  {
    id: "repair jump drive",
    audioFile: "tests/audio/fixtures/complex/scenario_c2.wav",
    expectedQuestion: "Our engineer wants to repair the jump drive mid-combat. What skill, what difficulty, how long?",
    expectedKeywords: ["engineering", "repair", "drive", "jump"],
    mustCiteSource: true,
    mustNotHallucinate: ["easy", "automatic", "minutes"],
  },
  {
    id: "grapple prone complex",
    audioFile: "tests/audio/fixtures/complex/scenario_c3.wav",
    expectedQuestion: "What are the actual modifiers for grappling a prone alien opponent in melee?",
    expectedKeywords: ["grapple", "prone", "melee", "personal"],
    mustCiteSource: true,
    mustNotHallucinate: ["bonus", "advantage", "automatic"],
  },
  {
    id: "tech level system",
    audioFile: "tests/audio/fixtures/complex/scenario_c4.wav",
    expectedQuestion: "How to figure out tech level of a star system? Is there a skill check? What does tech level mean for equipment availability?",
    expectedKeywords: ["tech", "level", "system", "star", "world"],
    mustCiteSource: false,
    mustNotHallucinate: ["you roll", "dice roll", "2d6"],
  },
  {
    id: "gunnery skill",
    audioFile: "tests/audio/fixtures/complex/scenario_c5.wav",
    expectedQuestion: "Walk through gunnery skill for starship combat — characteristics, difficulty, modifiers for weapon types.",
    expectedKeywords: ["gunnery", "skill", "starship", "weapon"],
    mustCiteSource: true,
    mustNotHallucinate: ["dexterity", "wisdom", "charisma"],
  },
  {
    id: "laser rifle damage",
    audioFile: "tests/audio/fixtures/complex/scenario_c6.wav",
    expectedQuestion: "How much damage does a standard laser rifle do, what's its effective range, does armor type affect the damage?",
    expectedKeywords: ["laser", "rifle", "range", "damage", "armor"],
    mustCiteSource: true,
    mustNotHallucinate: ["2d6", "1d8", "penetrate"],
  },
  {
    id: "investigation search",
    audioFile: "tests/audio/fixtures/complex/scenario_c7.wav",
    expectedQuestion: "What skill check for searching a room for hidden clues? Recon or something else? Typical difficulty for deliberately hidden items?",
    expectedKeywords: ["recon", "search", "hidden", "skill"],
    mustCiteSource: true,
    mustNotHallucinate: ["perception"],
  },
  {
    id: "sell equipment",
    audioFile: "tests/audio/fixtures/complex/scenario_c8.wav",
    expectedQuestion: "What determines the price for salvaged equipment on a frontier world? Does local tech level matter? Is there a skill for negotiating?",
    expectedKeywords: ["tech", "level", "trade", "equipment", "sell", "price"],
    mustCiteSource: false,
    mustNotHallucinate: ["charisma", "persuasion", "barter skill"],
  },
  {
    id: "total combat modifier",
    audioFile: "tests/audio/fixtures/complex/scenario_c9.wav",
    expectedQuestion: "At medium range with assault rifle, target has partial cover and is moving — what's my total modifier to hit?",
    expectedKeywords: ["range", "cover", "movement", "DM", "modifier"],
    mustCiteSource: true,
    mustNotHallucinate: ["bonus", "advantage", "+2"],
  },
  {
    id: "first aid multi",
    audioFile: "tests/audio/fixtures/complex/scenario_c10.wav",
    expectedQuestion: "Use Medic skill to treat multiple injured party members — process, during combat?, how many people, recovery time?",
    expectedKeywords: ["medic", "first", "aid", "treat", "heal"],
    mustCiteSource: true,
    mustNotHallucinate: ["cure", "spell"],
  },
  {
    id: "starship drive design",
    audioFile: "tests/audio/fixtures/complex/scenario_c11.wav",
    expectedQuestion: "Designing a ship that can do jump-2 — what jump drive needed? How does hull size affect drive requirements? Power plant requirements?",
    expectedKeywords: ["jump", "drive", "hull", "power", "ship"],
    mustCiteSource: true,
    mustNotHallucinate: ["warp", "hyperspace module"],
  },
  {
    id: "sensor critical hit",
    audioFile: "tests/audio/fixtures/complex/scenario_c12.wav",
    expectedQuestion: "Effects of damaged sensors after critical hit? Does it affect shooting? Can we still jump? How difficult to repair with Engineering?",
    expectedKeywords: ["sensor", "critical", "repair", "engineering", "damage"],
    mustCiteSource: true,
    mustNotHallucinate: ["impossible", "permanent"],
  },
];

// ---- Helpers ----
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
  "with", "about", "into", "through", "during", "before", "after",
]);

function extractKeywords(text: string): string {
  return text.toLowerCase()
    .replace(/[?.,!;:'"()]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .join(" ");
}

function lookupOglRules(searchTerm: string): { label: string; text: string; score: number }[] {
  const config = loadConfig();
  const db = getDatabase(config.oglDbPath);
  const chunks: { label: string; text: string }[] = [];
  const kwList = extractKeywords(searchTerm).split(/\s+/).filter(Boolean);

  const ftsResults = searchOglRules(db, searchTerm);
  for (const r of ftsResults) {
    chunks.push({ label: `OGL: ${r.section} > ${r.title}`, text: r.snippet.replace(/<mark>/g, "**").replace(/<\/mark>/g, "**") });
  }
  for (const kw of kwList) {
    for (const c of searchCombat(db, kw)) chunks.push({ label: `OGL Combat: ${c.category} > ${c.topic}`, text: c.content });
    for (const s of searchShipOps(db, kw)) chunks.push({ label: `OGL Starships: ${s.category} > ${s.topic}`, text: s.content });
  }
  for (const kw of kwList) {
    for (const sk of searchOglSkills(db, kw)) chunks.push({ label: `OGL Skill: ${sk.name} (${sk.characteristic})`, text: sk.description });
    for (const eq of searchOglEquipment(db, kw)) chunks.push({ label: `OGL Equipment: ${eq.name} (TL${eq.techLevel})`, text: eq.description });
  }

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

interface RulingScore {
  keywordScore: number;
  citedSource: boolean;
  hallucinationScore: number;
  totalScore: number;
  notes: string[];
}

function scoreRuling(ruling: string, scenario: Scenario): RulingScore {
  const lower = ruling.toLowerCase();
  const notes: string[] = [];

  const matchedKeywords = scenario.expectedKeywords.filter((kw) => lower.includes(kw.toLowerCase()));
  const keywordScore = Math.min(1, matchedKeywords.length / Math.max(1, scenario.expectedKeywords.length));

  const citedSource = scenario.mustCiteSource
    ? lower.includes("[ogl") || lower.includes("[ogl") || lower.includes("source")
    : true;

  if (!citedSource) notes.push("No source citation");

  const hallucinations = scenario.mustNotHallucinate.filter((h) => lower.includes(h.toLowerCase()));
  const hallucinationScore = hallucinations.length === 0 ? 1 : Math.max(0, 1 - hallucinations.length * 0.3);

  if (hallucinations.length > 0) notes.push(`Hallucinated: ${hallucinations.join(", ")}`);

  const totalScore = (keywordScore * 0.5) + (citedSource ? 0.25 : 0) + (hallucinationScore * 0.25);

  return { keywordScore, citedSource, hallucinationScore, totalScore, notes };
}

interface RunResult {
  modelId: string;
  scenarioId: string;
  transcript: string;
  ruling: string;
  score: RulingScore;
  latencySttMs: number;
  latencyLlmMs: number;
  durationLlmS: number;
  modelUsed: string;
  error?: string;
}

// ---- Main ----
async function main() {
  const requestedModels = process.argv.includes("--models")
    ? process.argv[process.argv.indexOf("--models") + 1]?.split(",") || DEFAULT_MODELS
    : DEFAULT_MODELS;

  const modelsToTest = MODELS.filter((m) =>
    requestedModels.includes(m.name) || requestedModels.includes(m.id) || requestedModels.includes(m.size)
  );

  if (modelsToTest.length === 0) {
    console.error("No models matched. Available:", MODELS.map((m) => `${m.name} (${m.id})`).join(", "));
    process.exit(1);
  }

  console.log("=".repeat(70));
  console.log("  2d6mcp Model Benchmark");
  console.log("=".repeat(70));
  console.log(`Models: ${modelsToTest.map((m) => m.name).join(", ")}`);
  console.log(`Scenarios: ${COMPLEX_SCENARIOS.length}`);
  console.log(`Skip STT: ${SKIP_STT}\n`);

  const config = loadConfig();
  const sessionDb = openSessionDb(config.sessionDbPath);
  const session = createSession(sessionDb, "ogl", `Benchmark ${new Date().toISOString()}`);

  // ---- Step 1: Transcribe all audio (once, cached) ----
  const transcripts = new Map<string, string>();

  if (!SKIP_STT) {
    console.log("--- Transcribing all audio (mlx-community/whisper-large-v3-turbo) ---");
    for (const scenario of COMPLEX_SCENARIOS) {
      const fullPath = resolve(PROJECT_ROOT, scenario.audioFile);
      if (!existsSync(fullPath)) {
        console.log(`  [${scenario.id}] SKIP — file missing: ${fullPath}`);
        continue;
      }
      try {
        const buf = readFileSync(fullPath);
        const result = await transcribeAudioBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
        transcripts.set(scenario.id, result.text);
        logTranscript(sessionDb, session.id, result.text, "Player", "voice", "question");
        console.log(`  [${scenario.id}] "${result.text.substring(0, 80)}..."`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  [${scenario.id}] STT FAILED: ${msg}`);
      }
    }
    console.log("");
  }

  console.log("--- Running ruling synthesis for each model ---");

  const modelResults = new Map<string, RunResult[]>();

  for (const model of modelsToTest) {
    console.log(`\n${"-".repeat(60)}`);
    console.log(`Model: ${model.name} (${model.id})`);

    const results: RunResult[] = [];

    for (const scenario of COMPLEX_SCENARIOS) {
      const transcript = SKIP_STT ? scenario.expectedQuestion : (transcripts.get(scenario.id) || scenario.expectedQuestion);
      const rulesChunks = lookupOglRules(transcript);
      const rulesText = rulesChunks.map((c) => `[${c.label}]\n${c.text}`).join("\n\n");

      if (!rulesText) {
        results.push({
          modelId: model.id, scenarioId: scenario.id, transcript,
          ruling: "", score: { keywordScore: 0, citedSource: false, hallucinationScore: 0, totalScore: 0, notes: ["No OGL rules found"] },
          latencySttMs: 0, latencyLlmMs: 0, durationLlmS: 0, modelUsed: model.id, error: "No rules found",
        });
        continue;
      }

      try {
        const llmStart = Date.now();
        const rulingResult = await mlxSynthesizeRuling(transcript, rulesText, { model: model.id });
        const llmLatency = Date.now() - llmStart;

        const score = scoreRuling(rulingResult.response, scenario);
        storeRuling(sessionDb, session.id, transcript, rulingResult.response, undefined, rulingResult.model, llmLatency);

        results.push({
          modelId: model.id, scenarioId: scenario.id, transcript,
          ruling: rulingResult.response,
          score,
          latencySttMs: 0, latencyLlmMs: llmLatency,
          durationLlmS: rulingResult.durationSeconds, modelUsed: rulingResult.model,
        });

        const status = score.totalScore >= 0.5 ? "PASS" : score.totalScore >= 0.3 ? "WARN" : "FAIL";
        console.log(`  [${scenario.id}] ${status} score=${score.totalScore.toFixed(2)} kw=${score.keywordScore.toFixed(2)} cite=${score.citedSource} ${llmLatency}ms`);
        if (score.notes.length > 0) console.log(`           ${score.notes.join("; ")}`);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          modelId: model.id, scenarioId: scenario.id, transcript,
          ruling: "", score: { keywordScore: 0, citedSource: false, hallucinationScore: 0, totalScore: 0, notes: [msg] },
          latencySttMs: 0, latencyLlmMs: 0, durationLlmS: 0, modelUsed: model.id, error: msg,
        });
        console.log(`  [${scenario.id}] ERROR: ${msg}`);
      }
    }

    modelResults.set(model.id, results);

    const avg = results.reduce((s, r) => s + r.score.totalScore, 0) / results.length;
    const avgLat = results.reduce((s, r) => s + r.latencyLlmMs, 0) / results.length;
    console.log(`  Avg score: ${avg.toFixed(2)} | Avg latency: ${Math.round(avgLat)}ms`);
  }

  endSession(sessionDb, session.id);

  // ---- Comparison table ----
  console.log(`\n${"=".repeat(70)}`);
  console.log("  BENCHMARK RESULTS");
  console.log("=".repeat(70));

  // Per-scenario comparison
  for (const scenario of COMPLEX_SCENARIOS) {
    console.log(`\n[${scenario.id}]`);
    console.log(`  Transcript: ${(SKIP_STT ? scenario.expectedQuestion : transcripts.get(scenario.id) || "N/A").substring(0, 100)}...`);
    for (const model of modelsToTest) {
      const results = modelResults.get(model.id) || [];
      const result = results.find((r) => r.scenarioId === scenario.id);
      if (result) {
        const icon = result.score.totalScore >= 0.5 ? "✓" : result.score.totalScore >= 0.3 ? "~" : "✗";
        console.log(`  ${icon} ${model.name}: score=${result.score.totalScore.toFixed(2)} ${result.latencyLlmMs}ms`);
        if (result.ruling) console.log(`    Ruling: ${result.ruling.substring(0, 120)}...`);
      }
    }
  }

  // Aggregate comparison
  console.log(`\n${"=".repeat(70)}`);
  console.log("  AGGREGATE SCORES");
  console.log("=".repeat(70));

  let bestModel = "";
  let bestScore = 0;
  let bestLat = 0;
  for (const model of modelsToTest) {
    const results = modelResults.get(model.id) || [];
    const avgScore = results.reduce((s, r) => s + r.score.totalScore, 0) / Math.max(1, results.length);
    const avgLat = results.reduce((s, r) => s + r.latencyLlmMs, 0) / Math.max(1, results.length);
    const passRate = results.filter((r) => r.score.totalScore >= 0.5).length;
    const errorCount = results.filter((r) => r.error).length;
    console.log(`  ${model.name}: ${avgScore.toFixed(2)} avg | ${Math.round(avgLat)}ms avg | ${passRate}/${results.length} pass | ${errorCount} errors`);
    if (avgScore > bestScore) { bestScore = avgScore; bestModel = model.name; bestLat = avgLat; }
  }

  console.log(`\n  Winner: ${bestModel} (score=${bestScore.toFixed(2)}, ${Math.round(bestLat)}ms avg)`);

  closeSessionDb();

  // JSON output
  console.log("\n--- JSON ---");
  const exportData: Record<string, unknown> = {
    models_tested: modelsToTest.map((m) => m.name),
    results: Object.fromEntries(modelResults),
  };
  console.log(JSON.stringify(exportData, null, 2));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
