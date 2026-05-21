// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { execFile, execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { synthesizeWithLlamaCpp, isLlamaCppAvailable } from "./backends/llamacpp.js";

export interface MLXSynthesizeResult {
  response: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationSeconds: number;
  qualityWarnings?: string[];
}

export interface MLXSynthesizeOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  systemPrompt?: string;
  qualityFilter?: boolean;
}

const DEFAULT_SYSTEM_PROMPT = [
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

// Relaxed version for larger models that are over-conservative with the strict prompt
const SYSTEM_PROMPT_LARGE = [
  "You are a TTRPG rules assistant. Format: [source] ruling in 1-3 sentences.",
  "Cite the most relevant source tag from the reference text in [brackets].",
  "Prefer numbers from the reference text. If a number is not specified, note it as 'not specified' or provide the most likely value.",
  "If the reference text lacks relevant rules, suggest the closest applicable rule and cite it.",
  "If rules are ambiguous, present both interpretations.",
].join("\n");

function getSystemPrompt(modelId: string, explicitPrompt?: string): string {
  if (explicitPrompt) return explicitPrompt;

  const lower = modelId.toLowerCase();
  // Use relaxed prompt for models 7B+ that become over-conservative
  if (lower.includes("7b") || lower.includes("8b") || lower.includes("9b") ||
      lower.includes("30b") || lower.includes("35b") || lower.includes("a3b")) {
    return SYSTEM_PROMPT_LARGE;
  }
  return DEFAULT_SYSTEM_PROMPT;
}

// ---- Chat template detection ----

type ModelFamily = "llama" | "qwen" | "gemma" | "default";

function detectModelFamily(modelId: string): ModelFamily {
  const lower = modelId.toLowerCase();
  if (lower.includes("llama")) return "llama";
  if (lower.includes("qwen")) return "qwen";
  if (lower.includes("gemma")) return "gemma";
  return "default";
}

function buildChatTemplate(
  family: ModelFamily,
  systemPrompt: string,
  userMessage: string,
  rulesContext?: string
): string {
  const userContent = rulesContext
    ? `Reference rules:\n${rulesContext}\n\nQuestion: ${userMessage}`
    : userMessage;

  switch (family) {
    case "llama":
      return [
        "<|begin_of_text|>",
        `<|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|>`,
        `<|start_header_id|>user<|end_header_id|>\n\n${userContent}<|eot_id|>`,
        "<|start_header_id|>assistant<|end_header_id|>\n\n",
      ].join("");

    case "qwen":
      return [
        `<|im_start|>system\n${systemPrompt}<|im_end|>\n`,
        `<|im_start|>user\n${userContent}<|im_end|>\n`,
        "<|im_start|>assistant\n",
      ].join("");

    case "gemma":
      return [
        systemPrompt ? `${systemPrompt}\n\n` : "",
        `<start_of_turn>user\n${userContent}<end_of_turn>\n`,
        "<start_of_turn>model\n",
      ].join("");

    default:
      return buildChatTemplate("llama", systemPrompt, userMessage, rulesContext);
  }
}

// ---- Ruling quality filter ----

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

  // Check for the raw number
  const numMatch = normalized.match(/\d+/);
  if (!numMatch) return null;

  const num = numMatch[0];
  const surrounding = normalized.replace(/\bimproved\b|\bincreased\b|\breduced\b|\bless than\b|\bmore than\b/gi, "");

  // Does this number (or a close variant) appear in the source text?
  const sourceLower = rulesText.toLowerCase();

  // Try exact substring
  if (sourceLower.includes(surrounding)) return null;

  // Try just the number with common unit suffixes
  const numPatterns = [
    new RegExp(`\\b${num}\\s*(?:dm|hp|ac|cr|credits?|meters?|tons?|parsecs?)`, "i"),
    new RegExp(`\\b${num}\\b`),
  ];

  for (const pattern of numPatterns) {
    if (pattern.test(sourceLower)) return null;
  }

  return `"${rulingExcerpt.substring(0, 40)}" — number '${num}' not found in source text`;
}

function filterRulingQuality(ruling: string, rulesText: string): { filtered: string; warnings: string[] } {
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

// ---- MLX execution ----

function execFileAsync(
  file: string,
  args: string[],
  timeoutMs: number = 120000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const msg = (error as NodeJS.ErrnoException & { killed?: boolean }).killed
          ? `mlx_lm.generate timed out after ${timeoutMs / 1000}s (model may be downloading — retry)`
          : `mlx_lm.generate failed (exit code ${(error as NodeJS.ErrnoException).code ?? "?"}): ${stderr.slice(-200) || error.message}`;
        reject(new Error(msg));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function synthesizeRuling(
  question: string,
  rulesContext?: string,
  options: MLXSynthesizeOptions = {}
): Promise<MLXSynthesizeResult> {
  const config = loadConfig();

  // Dispatch to llama.cpp backend if configured
  if (config.llmBackend === "llamacpp") {
    const systemPrompt = getSystemPrompt(options.model || config.llamaCppModel, options.systemPrompt);
    const family = detectModelFamily(options.model || config.llamaCppModel);
    const prompt = buildChatTemplate(family, systemPrompt, question, rulesContext);
    return synthesizeWithLlamaCpp(prompt, {
      model: options.model || config.llamaCppModel,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      topP: options.topP,
      topK: options.topK,
    });
  }

  const model = options.model || process.env.MLX_LLM_MODEL || "mlx-community/Llama-3.2-3B-Instruct-4bit";
  const maxTokens = options.maxTokens || 512;
  const temperature = options.temperature ?? 0.3;
  const topP = options.topP ?? 0.9;
  const topK = options.topK ?? 40;
  const systemPrompt = getSystemPrompt(model, options.systemPrompt);
  const enableQualityFilter = options.qualityFilter !== false;

  const family = detectModelFamily(model);
  const prompt = buildChatTemplate(family, systemPrompt, question, rulesContext);

  const tmpPath = join(tmpdir(), `2d6mcp-prompt-${Date.now()}.txt`);
  try {
    writeFileSync(tmpPath, prompt, "utf-8");

    const args = [
      "--model", model,
      "--prompt", prompt,
      "--max-tokens", String(maxTokens),
      "--temp", String(temperature),
      "--top-p", String(topP),
      "--top-k", String(topK),
    ];

    const startTime = Date.now();
    const { stdout } = await execFileAsync("mlx_lm.generate", args);
    const duration = (Date.now() - startTime) / 1000;

    const rawResponse = stdout
      .replace(/^=+\n?/gm, "")
      .replace(/\n?=+$/gm, "")
      .replace(/\n?^Prompt:.*$/gm, "")
      .replace(/\n?^Generation:.*$/gm, "")
      .replace(/\n?^Peak memory:.*$/gm, "")
      .trim();

    // Detect and truncate repetitive line loops (known 3B model issue)
    let response = truncateRepetition(rawResponse);
    let qualityWarnings: string[] | undefined;

    if (enableQualityFilter && rulesContext) {
      const { filtered, warnings } = filterRulingQuality(rawResponse, rulesContext);
      response = filtered;
      if (warnings.length > 0) qualityWarnings = warnings;
    }

    return {
      response,
      model,
      promptTokens: Math.ceil(prompt.length / 4),
      completionTokens: Math.ceil(rawResponse.length / 4),
      durationSeconds: Math.round(duration * 100) / 100,
      qualityWarnings,
    };
  } finally {
    if (existsSync(tmpPath)) {
      unlinkSync(tmpPath);
    }
  }
}

export function isMLXLLMAvailable(): boolean {
  const config = loadConfig();
  if (config.llmBackend === "llamacpp") return isLlamaCppAvailable();
  try {
    execSync("which mlx_lm.generate", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
