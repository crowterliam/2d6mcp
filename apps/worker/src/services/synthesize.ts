// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { getSystemPrompt, cleanRulingResponse } from "@2d6mcp/shared";
import type { Env } from "../env.js";
import type { RulingSource } from "../types.js";
import { searchOglRulesFts, searchDwRulesFts } from "../db/queries.js";
import { generateChat, getActiveModel } from "./llm.js";

export interface RulingResult {
  ruling: string;
  sources: RulingSource[];
  model: string;
  latencyMs: number;
  qualityWarnings?: string[];
}

function buildRulesContext(oglResults: Array<{ title: string; category: string; content: string; source_tag: string }>, dwResults: Array<{ title: string; category: string; content: string; source_tag: string }>, preferOgl: boolean): { context: string; sources: RulingSource[] } {
  // Deduplicate by source tag, keeping first occurrence
  const seen = new Set<string>();
  const dedupOgl: typeof oglResults = [];
  const dedupDw: typeof dwResults = [];

  for (const r of oglResults) {
    if (!seen.has(r.source_tag)) { seen.add(r.source_tag); dedupOgl.push(r); }
  }
  for (const r of dwResults) {
    if (!seen.has(r.source_tag)) { seen.add(r.source_tag); dedupDw.push(r); }
  }

  // For OGL-preferring questions, limit DW results
  const maxDw = preferOgl ? 2 : 5;
  const maxOgl = 5;
  const sources: RulingSource[] = [];

  const parts: string[] = [];
  for (const r of dedupOgl.slice(0, maxOgl)) {
    parts.push(`[${r.source_tag}] ${r.title}\n${r.content}`);
    sources.push({ system: "ogl" as const, tag: r.source_tag, content: r.content });
  }
  for (const r of dedupDw.slice(0, maxDw)) {
    parts.push(`[${r.source_tag}] ${r.title}\n${r.content}`);
    sources.push({ system: "dw" as const, tag: r.source_tag, content: r.content });
  }

  return { context: parts.join("\n\n"), sources };
}

function buildFtsQuery(question: string): { query: string; preferOgl: boolean } {
  const cleaned = question.toLowerCase().replace(/[?.,!;:'"()]/g, " ");
  const words = cleaned.split(/\s+/).filter((w) => w.length > 2);

  // OGL-indicating terms
  const oglTerms = new Set(["combat", "modifier", "dm", "skill", "characteristic", "starship", "world", "career", "equipment", "cover", "armour", "armor", "damage", "upp"]);
  const preferOgl = words.some((w) => oglTerms.has(w));

  // For multi-word questions, search with adjacent pairs as phrases
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(`"${words[i]} ${words[i + 1]}"`);
  }

  // Also search individual significant words
  const significant = words.filter((w) => w.length > 3).slice(0, 6);

  // Combine: phrases get higher weight by being listed first in OR
  const terms = [...phrases, ...significant.map((w) => `"${w}"`)];
  const unique = [...new Set(terms)];
  return { query: unique.join(" OR "), preferOgl };
}

export async function synthesizeRuling(env: Env, question: string, rulesSystem: "ogl" | "dw" | "auto" = "auto"): Promise<RulingResult> {
  const { query: ftsQuery, preferOgl } = buildFtsQuery(question);

  let oglResults: Array<{ title: string; category: string; content: string; source_tag: string }> = [];
  let dwResults: Array<{ title: string; category: string; content: string; source_tag: string }> = [];

  try {
    if (rulesSystem === "auto" || rulesSystem === "ogl") {
      const result = await searchOglRulesFts(env.DB, ftsQuery);
      oglResults = result.results || [];
    }
    if (rulesSystem === "auto" || rulesSystem === "dw") {
      const result = await searchDwRulesFts(env.DB, ftsQuery);
      dwResults = result.results || [];
    }
  } catch {
    // FTS query may fail on complex terms; proceed without context
  }

  const { context, sources } = buildRulesContext(oglResults, dwResults, preferOgl);
  const model = getActiveModel();
  const systemPrompt = getSystemPrompt(model);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  if (context) {
    messages.push({ role: "user", content: `Reference rules:\n${context}\n\nQuestion: ${question}` });
  } else {
    messages.push({ role: "user", content: question });
  }

  const startTime = Date.now();
  const { response, model: usedModel } = await generateChat(env.AI, { messages, maxTokens: 1024 });
  const latencyMs = Date.now() - startTime;

  const { response: cleaned, qualityWarnings } = cleanRulingResponse(response, context);

  return {
    ruling: cleaned,
    sources,
    model: usedModel,
    latencyMs,
    qualityWarnings: qualityWarnings && qualityWarnings.length > 0 ? qualityWarnings : undefined,
  };
}
