#!/usr/bin/env -S npx tsx
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
// Prompt engineering benchmark — tests prompt variants against the 12 complex scenarios.
// Usage: node --import tsx scripts/test-prompts.ts

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, PROJECT_ROOT } from "../src/config.js";
import { transcribeAudioBuffer } from "../src/audio/mlx-transcribe.js";
import { synthesizeRuling as mlxSynthesizeRuling } from "../src/rulings/mlx-synthesize.js";
import {
  searchOglRules, searchCombat, searchShipOps,
  searchOglSkills, searchOglEquipment,
} from "../src/ogl/queries.js";
import { getDatabase } from "../src/ogl/database.js";

// ---- Prompt Variants ----
interface PromptVariant {
  name: string;
  systemPrompt: string;
}

const PROMPTS: PromptVariant[] = [
  {
    name: "v0-current",
    systemPrompt: [
      "You are a TTRPG rules assistant for a GM mid-game.",
      "Answer in 1-3 sentences. Be direct. No small talk.",
      "Cite the rule source exactly as it appears in the reference text, e.g., [OGL Combat: Cover].",
      "Never invent or guess rules not explicitly stated in the provided reference text.",
      "If the reference text does not answer the question, respond: 'Insufficient reference text to provide a ruling.'",
      "If rules appear contradictory, state both interpretations with their sources.",
    ].join("\n"),
  },
  {
    name: "v1-citation-required",
    systemPrompt: [
      "You are a TTRPG rules assistant. Follow this EXACT format for every response:",
      "",
      "START with [rule source tag verbatim from reference text]",
      "THEN provide the ruling in 1-3 sentences.",
      "Example: '[OGL Combat: Defense > Cover] 1/4 cover gives -0 DM, 1/2 cover gives -1 DM, 3/4 cover gives -2 DM, full cover gives -4 DM.'",
      "",
      "RULES:",
      "- ALWAYS cite the exact source tag in [brackets] as the FIRST thing you write.",
      "- NEVER invent numbers. Only use numbers found verbatim in the reference text. If a number is not specified, write 'not specified'.",
      "- If the reference text has NO relevant rules: 'Insufficient reference text to provide a ruling.'",
      "- If rules are ambiguous: present both interpretations with their source tags.",
    ].join("\n"),
  },
  {
    name: "v2-table-ready",
    systemPrompt: [
      "TTRPG GM assistant. Response format: [source] ruling (1-3 sentences).",
      "Critical: always start with [source] in brackets from reference text. Never invent numbers — use only numbers verbatim from reference, or say 'not specified'. If no relevant rules: 'Insufficient reference text.'",
    ].join("\n"),
  },
];

// ---- Helpers ----
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "i", "you", "he",
  "she", "it", "we", "they", "and", "but", "or", "if", "of", "at", "by",
  "for", "with", "about", "into", "through", "this", "that", "what",
  "which", "who", "how", "all", "not", "only", "very",
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

  for (const r of searchOglRules(db, searchTerm)) {
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

interface ScenarioDef {
  id: string; question: string; expectedKeywords: string[];
  mustNotHallucinate: string[];
}

const SCENARIOS: ScenarioDef[] = [
  { id: "cover", question: "What combat modifiers apply when shooting from behind a low wall? Does crouching vs standing matter?", expectedKeywords: ["cover", "DM", "-1", "-2"], mustNotHallucinate: ["bonus", "advantage", "+2"] },
  { id: "repair", question: "Our engineer wants to repair the jump drive mid-combat. What skill, difficulty, and time?", expectedKeywords: ["engineering", "repair", "drive", "engineer"], mustNotHallucinate: ["DC"] },
  { id: "grapple", question: "What are the modifiers for grappling a prone opponent in melee?", expectedKeywords: ["grapple", "prone", "personal"], mustNotHallucinate: ["bonus"] },
  { id: "tech", question: "How to determine the tech level of a star system? Is there a skill check?", expectedKeywords: ["tech", "level", "star", "system"], mustNotHallucinate: ["2d6"] },
  { id: "gunnery", question: "Walk through gunnery skill — characteristics, difficulty, modifiers?", expectedKeywords: ["gunnery", "skill", "starship"], mustNotHallucinate: ["dexterity", "wisdom"] },
  { id: "laser", question: "How much damage does a laser rifle do? What's its effective range? Does armor affect it?", expectedKeywords: ["laser", "range", "damage", "armor"], mustNotHallucinate: ["3d6", "1d8"] },
  { id: "search", question: "What skill check for searching a room for hidden clues? Typical difficulty?", expectedKeywords: ["investigation", "recon", "search"], mustNotHallucinate: ["perception"] },
  { id: "sell", question: "What determines price for salvaged equipment? Does tech level matter? Skill for negotiating?", expectedKeywords: ["tech", "level", "trade", "sell"], mustNotHallucinate: [] },
  { id: "combat", question: "At medium range with assault rifle, target has partial cover and is moving. Total modifier to hit?", expectedKeywords: ["range", "cover", "movement", "DM"], mustNotHallucinate: ["advantage", "+2"] },
  { id: "medic", question: "Treat multiple injured with Medic during combat. Process? How many people? Recovery time?", expectedKeywords: ["medic", "first", "aid", "treat"], mustNotHallucinate: [] },
  { id: "drives", question: "Designing a ship for jump-2. What jump drive needed? Hull size effect? Power plant?", expectedKeywords: ["jump", "drive", "hull", "power"], mustNotHallucinate: [] },
  { id: "sensor", question: "Effects of damaged sensors after critical hit? Affect shooting? Can we jump? Repair difficulty?", expectedKeywords: ["sensor", "critical", "repair", "engineering"], mustNotHallucinate: ["impossible"] },
];

// ---- Scoring ----
function scoreRuling(ruling: string, scenario: ScenarioDef): { kwScore: number; hasCite: boolean; hasHallucination: boolean; total: number; notes: string[] } {
  const lower = ruling.toLowerCase();
  const notes: string[] = [];

  const matched = scenario.expectedKeywords.filter((kw) => lower.includes(kw.toLowerCase()));
  const kwScore = matched.length / Math.max(1, scenario.expectedKeywords.length);

  const hasCite = lower.includes("[ogl") || lower.startsWith("[") || lower.includes("source");

  const hals = scenario.mustNotHallucinate.filter((h) => lower.includes(h.toLowerCase()));
  const hasHallucination = hals.length > 0;
  if (hasHallucination) notes.push(`HALLUCINATED: ${hals.join(", ")}`);

  const total = (kwScore * 0.4) + (hasCite ? 0.40 : 0) + (hasHallucination ? 0 : 0.20);

  return { kwScore, hasCite, hasHallucination, total, notes };
}

// ---- Main ----
async function main() {
  const model = "mlx-community/Llama-3.2-3B-Instruct-4bit";
  console.log("=".repeat(65));
  console.log("  Prompt Engineering Benchmark — 3 variants × 12 scenarios");
  console.log("=".repeat(65));
  console.log(`Model: ${model}\n`);

  const results: Record<string, { avgScore: number; citeRate: number; hallucRate: number; avgLatency: number }> = {};

  for (const prompt of PROMPTS) {
    console.log(`${"-".repeat(50)}`);
    console.log(`Prompt: ${prompt.name}`);
    console.log(prompt.systemPrompt.split("\n")[0].substring(0, 60) + "...");
    console.log("");

    let totalScore = 0;
    let totalCite = 0;
    let totalHalluc = 0;
    let totalLatency = 0;
    let scenarioResults = "";

    for (const scenario of SCENARIOS) {
      const rulesChunks = lookupOglRules(scenario.question);
      const rulesText = rulesChunks.map((c) => `[${c.label}]\n${c.text}`).join("\n\n");

      if (!rulesText) {
        console.log(`  [${scenario.id}] SKIP (no rules found)`);
        continue;
      }

      try {
        const start = Date.now();
        const result = await mlxSynthesizeRuling(
          scenario.question, rulesText,
          { model, systemPrompt: prompt.systemPrompt, temperature: 0.2 }
        );
        const latency = Date.now() - start;

        const score = scoreRuling(result.response, scenario);
        totalScore += score.total;
        if (score.hasCite) totalCite++;
        if (score.hasHallucination) totalHalluc++;
        totalLatency += latency;

        const icon = score.total >= 0.6 ? "✓" : score.total >= 0.4 ? "~" : "✗";
        scenarioResults += `  ${icon} [${scenario.id}] ${score.total.toFixed(2)} cite=${score.hasCite} ${latency}ms`;
        if (score.notes.length > 0) scenarioResults += ` ${score.notes.join("; ")}`;
        scenarioResults += "\n";

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        scenarioResults += `  ✗ [${scenario.id}] ERROR: ${msg}\n`;
      }
    }

    const n = SCENARIOS.length;
    const avgScore = totalScore / n;
    const citeRate = totalCite / n;
    const hallucRate = totalHalluc / n;
    const avgLatency = totalLatency / n;

    results[prompt.name] = { avgScore, citeRate, hallucRate, avgLatency };

    console.log(scenarioResults);
    console.log(`  AVG: score=${avgScore.toFixed(2)} cite=${Math.round(citeRate * 100)}% halluc=${Math.round(hallucRate * 100)}% ${Math.round(avgLatency)}ms`);
  }

  // ---- Comparison ----
  console.log(`\n${"=".repeat(65)}`);
  console.log("  COMPARISON");
  console.log("=".repeat(65));
  console.log(`  ${"Prompt".padEnd(20)} ${"Score".padEnd(8)} ${"Cite%".padEnd(8)} ${"Halluc%".padEnd(10)} ${"Latency".padEnd(10)}`);
  console.log("  " + "-".repeat(55));
  for (const [name, r] of Object.entries(results)) {
    console.log(`  ${name.padEnd(20)} ${r.avgScore.toFixed(2).padEnd(8)} ${Math.round(r.citeRate * 100).toString().padEnd(8)} ${Math.round(r.hallucRate * 100).toString().padEnd(10)} ${Math.round(r.avgLatency).toString().padEnd(10)}ms`);
  }

  // Winner
  let best = "";
  let bestScore = 0;
  for (const [name, r] of Object.entries(results)) {
    const composite = r.avgScore + r.citeRate * 0.5 - r.hallucRate;
    if (composite > bestScore) { bestScore = composite; best = name; }
  }
  console.log(`\n  Best: ${best} (composite: ${bestScore.toFixed(2)})`);
}

main().catch(console.error);
