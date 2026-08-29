// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// llama.cpp backend — cross-platform, C++, CPU/CUDA/Vulkan/Metal
// CLI: llama-cli -m model.gguf -f prompt.txt -n 512

import { execFile, execSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  fchmodSync,
  mkdtempSync,
  openSync,
  rmSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

/** 0700 directory + exclusive 0600 file so ruling prompts are not world-readable in /tmp. */
export function createPrivatePromptFile(contents: string): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "2d6mcp-llama-"));
  try {
    try {
      chmodSync(dir, 0o700);
    } catch {
      // Windows ignores POSIX modes.
    }
    const path = join(dir, "prompt.txt");
    const fd = openSync(path, "wx", 0o600);
    try {
      writeSync(fd, contents, null, "utf-8");
      try {
        fchmodSync(fd, 0o600);
      } catch {
        // Windows ignores POSIX modes.
      }
    } finally {
      closeSync(fd);
    }
    return {
      path,
      cleanup: () => {
        rmSync(dir, { recursive: true, force: true });
      },
    };
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
}

export async function synthesizeWithLlamaCpp(
  prompt: string,
  options: SynthesizeOptions = {}
): Promise<SynthesizeResult> {
  const model = options.model || DEFAULT_MODEL_PATH;
  const maxTokens = options.maxTokens || 512;
  const temperature = options.temperature ?? 0.3;
  const topP = options.topP ?? 0.9;
  const topK = options.topK ?? 40;

  const promptFile = createPrivatePromptFile(prompt);

  try {
    const args = [
      "-m", model,
      "-f", promptFile.path,
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
  } finally {
    promptFile.cleanup();
  }
}

export function isLlamaCppAvailable(): boolean {
  try {
    execSync("which llama-cli", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
