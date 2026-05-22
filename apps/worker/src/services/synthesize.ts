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

function buildRulesContext(oglResults: Array<{ title: string; category: string; content: string; source_tag: string }>, dwResults: Array<{ title: string; category: string; content: string; source_tag: string }>): { context: string; sources: RulingSource[] } {
  const sources: RulingSource[] = [];
  const parts: string[] = [];

  for (const r of oglResults) {
    parts.push(`[${r.source_tag}] ${r.title} (${r.category})\n${r.content}`);
    sources.push({ system: "ogl" as const, tag: r.source_tag, content: r.content });
  }
  for (const r of dwResults) {
    parts.push(`[${r.source_tag}] ${r.title} (${r.category})\n${r.content}`);
    sources.push({ system: "dw" as const, tag: r.source_tag, content: r.content });
  }

  return { context: parts.join("\n\n"), sources };
}

function buildFtsQuery(question: string): string {
  const words = question.toLowerCase()
    .replace(/[?.,!;:'"()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 10);

  return words.map((w) => `"${w}"`).join(" OR ");
}

export async function synthesizeRuling(env: Env, question: string, rulesSystem: "ogl" | "dw" | "auto" = "auto"): Promise<RulingResult> {
  const ftsQuery = buildFtsQuery(question);

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

  const { context, sources } = buildRulesContext(oglResults, dwResults);
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
  const { response, model: usedModel } = await generateChat(env.AI, { messages });
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
