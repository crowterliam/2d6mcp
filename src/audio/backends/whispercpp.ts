// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// whisper.cpp backend — cross-platform, C++, CPU/CUDA/Vulkan/Metal
// CLI: whisper-cli -m model.bin -f audio.wav -oj

import { execFile, execSync } from "node:child_process";
import { readFileSync } from "node:fs";

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscribeResult {
  text: string;
  model: string;
  language?: string;
  durationSeconds: number;
  words?: WhisperWord[];
  segments?: Array<{ start: number; end: number; text: string }>;
}

export interface TranscribeOptions {
  model?: string;
  language?: string;
  prompt?: string;
  wordTimestamps?: boolean;
}

function execFileAsync(
  file: string, args: string[], timeoutMs: number = 120000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const msg = (error as NodeJS.ErrnoException & { killed?: boolean }).killed
          ? `whisper-cli timed out after ${timeoutMs / 1000}s`
          : `whisper-cli failed (exit code ${(error as NodeJS.ErrnoException).code ?? "?"}): ${stderr.slice(-200) || error.message}`;
        reject(new Error(msg));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

const DEFAULT_MODEL = "ggml-large-v3-turbo.bin";
const DEFAULT_MODEL_PATH = process.env.WHISPERCPP_MODEL || DEFAULT_MODEL;
const DEFAULT_PROMPT = "TTRPG tabletop roleplaying game rules question starship character combat skill check";

export async function transcribeWithWhisperCpp(
  audioPath: string,
  options: TranscribeOptions = {}
): Promise<TranscribeResult> {
  const model = options.model || DEFAULT_MODEL_PATH;
  const startTime = Date.now();

  const args = [
    "-m", model,
    "-f", audioPath,
    "-oj",          // JSON output
    "--print-progress", "false",
    "--no-timestamps", "false",
  ];

  if (options.language) args.push("-l", options.language);
  args.push("--prompt", options.prompt || DEFAULT_PROMPT);

  if (options.wordTimestamps) args.push("-ml", "1");

  const { stdout } = await execFileAsync("whisper-cli", args);
  const duration = (Date.now() - startTime) / 1000;

  const sanitized = stdout.replace(/: NaN/g, ": 0").replace(/: -nan/g, ": 0");
  const raw = JSON.parse(sanitized);

  return {
    text: (raw.text ?? "").trim(),
    model,
    language: raw.language ?? undefined,
    durationSeconds: Math.round(duration * 100) / 100,
    segments: raw.segments?.map((s: { start: number; end: number; text: string }) => ({
      start: s.start, end: s.end, text: s.text,
    })),
  };
}

export function isWhisperCppAvailable(): boolean {
  try {
    execSync("which whisper-cli", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
