// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Shared prompt templates and ruling quality filter.
// Used by both the local MLX pipeline and the Cloudflare Worker.

export interface RulingResult {
  response: string;
  promptTokens: number;
  completionTokens: number;
  durationSeconds: number;
  qualityWarnings?: string[];
}

export const DEFAULT_SYSTEM_PROMPT = [
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
].join("\n");

export const SYSTEM_PROMPT_LARGE = [
  "You are a TTRPG rules assistant. Format: [source] ruling in 1-3 sentences.",
  "Cite the most relevant source tag from the reference text in [brackets].",
  "Prefer numbers from the reference text. If a number is not specified, note it as 'not specified' or provide the most likely value.",
  "If the reference text lacks relevant rules, suggest the closest applicable rule and cite it.",
  "If rules are ambiguous, present both interpretations.",
].join("\n");

export function getSystemPrompt(modelId: string, explicitPrompt?: string): string {
  if (explicitPrompt) return explicitPrompt;

  const lower = modelId.toLowerCase();
  if (lower.includes("7b") || lower.includes("8b") || lower.includes("9b") ||
      lower.includes("30b") || lower.includes("35b") || lower.includes("a3b")) {
    return SYSTEM_PROMPT_LARGE;
  }
  return DEFAULT_SYSTEM_PROMPT;
}

function truncateRepetition(text: string): string {
  const lines = text.split("\n");
  if (lines.length < 5) return text;

  const cleaned: string[] = [];
  let repeatCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (cleaned.length > 0 && line === cleaned[cleaned.length - 1]) {
      repeatCount++;
      if (repeatCount >= 2) {
        if (repeatCount === 2) cleaned.push("[…repeated output truncated…]");
        continue;
      }
    } else {
      repeatCount = 0;
    }
    cleaned.push(lines[i]);
  }

  return cleaned.join("\n").trim();
}

const NUMBER_PATTERN = /(\d+d\d+(?:[+-]\d+)?|\b\d+\.?\d*\s*(?:DM|hp|hit points?|ac|armor class|Cr\d*|credits?|meters?|tons?|points?|damage|XP|parsecs?)\b|\bCr\d+\b)/gi;

function extractNumericTerms(text: string): string[] {
  const matches = text.match(NUMBER_PATTERN) || [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

function validateNumberInSource(term: string, rulesText: string, rulingExcerpt: string): string | null {
  const normalized = term.toLowerCase();
  const numMatch = normalized.match(/\d+/);
  if (!numMatch) return null;

  const num = numMatch[0];
  const surrounding = normalized.replace(/\bimproved\b|\bincreased\b|\breduced\b|\bless than\b|\bmore than\b/gi, "");
  const sourceLower = rulesText.toLowerCase();

  if (sourceLower.includes(surrounding)) return null;

  const numPatterns = [
    new RegExp(`\\b${num}\\s*(?:dm|hp|ac|cr|credits?|meters?|tons?|parsecs?)`, "i"),
    new RegExp(`\\b${num}\\b`),
  ];

  for (const pattern of numPatterns) {
    if (pattern.test(sourceLower)) return null;
  }

  return `"${rulingExcerpt.substring(0, 40)}" — number '${num}' not found in source text`;
}

export function filterRulingQuality(ruling: string, rulesText: string): { filtered: string; warnings: string[] } {
  const warnings: string[] = [];
  const terms = extractNumericTerms(ruling);

  for (const term of terms) {
    const excerpt = ruling.split("\n").find((line) => line.toLowerCase().includes(term))?.trim() || term;
    const warning = validateNumberInSource(term, rulesText, excerpt);
    if (warning) warnings.push(warning);
  }

  if (warnings.length === 0) return { filtered: ruling, warnings };

  const warningBlock = warnings.map((w) => `[Verify: ${w}]`).join("\n");
  return { filtered: `${ruling}\n\n${warningBlock}`, warnings };
}

export function cleanRulingResponse(text: string, rulesContext?: string): { response: string; qualityWarnings?: string[] } {
  let response = truncateRepetition(text);

  if (rulesContext) {
    const { filtered, warnings } = filterRulingQuality(text, rulesContext);
    response = filtered;
    if (warnings.length > 0) return { response, qualityWarnings: warnings };
  }

  return { response };
}
