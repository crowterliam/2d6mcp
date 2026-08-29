// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { spawn, execSync } from "node:child_process";
import { loadConfig } from "../config.js";
import { getSystemPrompt, cleanRulingResponse } from "@2d6mcp/shared";
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

function execMlxGenerate(
  args: string[],
  prompt: string,
  timeoutMs: number = 120000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("mlx_lm.generate", [...args, "--prompt", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.stdin.on("error", () => {
      // Process may exit before stdin finishes (EPIPE).
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`mlx_lm.generate timed out after ${timeoutMs / 1000}s (model may be downloading — retry)`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`mlx_lm.generate failed (exit code ${code ?? "?"}): ${stderr.slice(-200) || "unknown error"}`));
        return;
      }
      resolve({ stdout, stderr });
    });
    child.stdin.end(prompt);
  });
}

function applyQualityFilter(
  rawResponse: string,
  rulesContext: string | undefined,
  enableQualityFilter: boolean
): { response: string; qualityWarnings?: string[] } {
  if (!enableQualityFilter) {
    return { response: rawResponse };
  }
  return cleanRulingResponse(rawResponse, rulesContext);
}

export async function synthesizeRuling(
  question: string,
  rulesContext?: string,
  options: MLXSynthesizeOptions = {}
): Promise<MLXSynthesizeResult> {
  const config = loadConfig();
  const enableQualityFilter = options.qualityFilter !== false;

  if (config.llmBackend === "llamacpp") {
    const model = options.model || config.llamaCppModel;
    const systemPrompt = getSystemPrompt(model, options.systemPrompt);
    const family = detectModelFamily(model);
    const prompt = buildChatTemplate(family, systemPrompt, question, rulesContext);
    const result = await synthesizeWithLlamaCpp(prompt, {
      model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      topP: options.topP,
      topK: options.topK,
    });
    const cleaned = applyQualityFilter(result.response, rulesContext, enableQualityFilter);
    return {
      ...result,
      response: cleaned.response,
      qualityWarnings: cleaned.qualityWarnings,
    };
  }

  const model = options.model || process.env.MLX_LLM_MODEL || "mlx-community/Llama-3.2-3B-Instruct-4bit";
  const maxTokens = options.maxTokens || 512;
  const temperature = options.temperature ?? 0.3;
  const topP = options.topP ?? 0.9;
  const topK = options.topK ?? 40;
  const systemPrompt = getSystemPrompt(model, options.systemPrompt);

  const family = detectModelFamily(model);
  const prompt = buildChatTemplate(family, systemPrompt, question, rulesContext);

  const args = [
    "--model", model,
    "--max-tokens", String(maxTokens),
    "--temp", String(temperature),
    "--top-p", String(topP),
    "--top-k", String(topK),
  ];

  const startTime = Date.now();
  const { stdout } = await execMlxGenerate(args, prompt);
  const duration = (Date.now() - startTime) / 1000;

  const rawResponse = stdout
    .replace(/^=+\n?/gm, "")
    .replace(/\n?=+$/gm, "")
    .replace(/\n?^Prompt:.*$/gm, "")
    .replace(/\n?^Generation:.*$/gm, "")
    .replace(/\n?^Peak memory:.*$/gm, "")
    .trim();

  const cleaned = applyQualityFilter(rawResponse, rulesContext, enableQualityFilter);

  return {
    response: cleaned.response,
    model,
    promptTokens: Math.ceil(prompt.length / 4),
    completionTokens: Math.ceil(rawResponse.length / 4),
    durationSeconds: Math.round(duration * 100) / 100,
    qualityWarnings: cleaned.qualityWarnings,
  };
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
