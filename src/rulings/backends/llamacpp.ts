// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// llama.cpp backend — cross-platform, C++, CPU/CUDA/Vulkan/Metal
// CLI: llama-cli -m model.gguf -p "prompt" -n 512

import { execFile, execSync } from "node:child_process";

export interface SynthesizeResult {
  response: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationSeconds: number;
  qualityWarnings?: string[];
}

export interface SynthesizeOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  systemPrompt?: string;
  qualityFilter?: boolean;
}

function execFileAsync(
  file: string, args: string[], timeoutMs: number = 120000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const msg = (error as NodeJS.ErrnoException & { killed?: boolean }).killed
          ? `llama-cli timed out after ${timeoutMs / 1000}s`
          : `llama-cli failed (exit code ${(error as NodeJS.ErrnoException).code ?? "?"}): ${stderr.slice(-200) || error.message}`;
        reject(new Error(msg));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

const DEFAULT_MODEL = "Llama-3.2-3B-Instruct.Q4_K_M.gguf";
const DEFAULT_MODEL_PATH = process.env.LLAMACPP_MODEL || DEFAULT_MODEL;

export async function synthesizeWithLlamaCpp(
  prompt: string,
  options: SynthesizeOptions = {}
): Promise<SynthesizeResult> {
  const model = options.model || DEFAULT_MODEL_PATH;
  const maxTokens = options.maxTokens || 512;
  const temperature = options.temperature ?? 0.3;
  const topP = options.topP ?? 0.9;
  const topK = options.topK ?? 40;

  const args = [
    "-m", model,
    "-p", prompt,
    "-n", String(maxTokens),
    "--temp", String(temperature),
    "--top-p", String(topP),
    "--top-k", String(topK),
    "--repeat-penalty", "1.1",
    "--no-display-prompt",
  ];

  const startTime = Date.now();
  const { stdout } = await execFileAsync("llama-cli", args);
  const duration = (Date.now() - startTime) / 1000;

  const response = stdout
    .replace(/^=+\n?/gm, "")
    .replace(/\n?=+$/gm, "")
    .replace(/\n?^llama_.*$/gm, "")
    .trim();

  return {
    response,
    model,
    promptTokens: Math.ceil(prompt.length / 4),
    completionTokens: Math.ceil(response.length / 4),
    durationSeconds: Math.round(duration * 100) / 100,
  };
}

export function isLlamaCppAvailable(): boolean {
  try {
    execSync("which llama-cli", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
