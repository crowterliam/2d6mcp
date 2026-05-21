// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { execFile, execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { loadConfig } from "../config.js";
import { transcribeWithWhisperCpp, isWhisperCppAvailable } from "./backends/whispercpp.js";

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface MLXTranscribeResult {
  text: string;
  model: string;
  language?: string;
  durationSeconds: number;
  words?: WhisperWord[];
  segments?: Array<{ start: number; end: number; text: string }>;
}

export interface MLXTranscribeOptions {
  model?: string;
  language?: string;
  prompt?: string;
  wordTimestamps?: boolean;
}

function execFileAsync(
  file: string,
  args: string[],
  timeoutMs: number = 120000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const msg = (error as NodeJS.ErrnoException & { killed?: boolean }).killed
          ? `mlx_whisper timed out after ${timeoutMs / 1000}s (model may be downloading — retry)`
          : `mlx_whisper failed (exit code ${(error as NodeJS.ErrnoException).code ?? "?"}): ${stderr.slice(-200) || error.message}`;
        reject(new Error(msg));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function transcribeWithMLX(
  audioPath: string,
  options: MLXTranscribeOptions = {}
): Promise<MLXTranscribeResult> {
  const model = options.model || process.env.MLX_WHISPER_MODEL || "mlx-community/whisper-large-v3-turbo";
  const audioBase = basename(audioPath).replace(/\.[^.]+$/, "");
  const outDir = join(tmpdir(), `mlx-whisper-${Date.now()}`);
  const jsonPath = join(outDir, `${audioBase}.json`);

  const args = [
    audioPath,
    "--model", model,
    "--output-dir", outDir,
    "--output-format", "json",
  ];

  if (options.language) {
    args.push("--language", options.language);
  }
  const prompt = options.prompt || "TTRPG tabletop roleplaying game rules question starship character combat skill check";
  args.push("--initial-prompt", prompt);

  if (options.wordTimestamps) {
    args.push("--word-timestamps", "True");
  }

  const startTime = Date.now();
  await execFileAsync("mlx_whisper", args);

  const duration = (Date.now() - startTime) / 1000;

  if (!existsSync(jsonPath)) {
    throw new Error(`mlx_whisper did not produce output at ${jsonPath}`);
  }

  const rawText = readFileSync(jsonPath, "utf-8");
  // mlx_whisper sometimes outputs NaN in logprobs — sanitize before parsing
  const sanitized = rawText.replace(/: NaN/g, ": 0").replace(/: -nan/g, ": 0");
  const raw = JSON.parse(sanitized);

  // Clean up output directory
  try { unlinkSync(jsonPath); } catch { /* ignore */ }

  return {
    text: (raw.text ?? "").trim(),
    model,
    language: raw.language ?? undefined,
    durationSeconds: Math.round(duration * 100) / 100,
    words: options.wordTimestamps ? flattenWords(raw.segments) : undefined,
    segments: raw.segments?.map((s: { start: number; end: number; text: string }) => ({
      start: s.start, end: s.end, text: s.text,
    })),
  };
}

function flattenWords(segments: Array<{ words?: Array<{ word: string; start: number; end: number }> }>): MLXTranscribeResult["words"] {
  if (!segments) return undefined;
  const words: MLXTranscribeResult["words"] = [];
  for (const seg of segments) {
    if (seg.words) {
      for (const w of seg.words) {
        words.push({ word: w.word, start: w.start, end: w.end });
      }
    }
  }
  return words.length > 0 ? words : undefined;
}

export function isMLXWhisperAvailable(): boolean {
  const config = loadConfig();
  if (config.sttBackend === "whispercpp") return isWhisperCppAvailable();
  try {
    execSync("which mlx_whisper", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function transcribeAudio(
  audioPath: string,
  options: MLXTranscribeOptions = {}
): Promise<MLXTranscribeResult> {
  const config = loadConfig();
  if (config.sttBackend === "whispercpp") {
    return transcribeWithWhisperCpp(audioPath, options);
  }
  return transcribeWithMLX(audioPath, options);
}

export async function transcribeAudioBuffer(
  audioBuffer: ArrayBuffer,
  options: MLXTranscribeOptions = {}
): Promise<MLXTranscribeResult> {
  const tmpPath = join(tmpdir(), `2d6mcp-audio-${Date.now()}.wav`);
  try {
    writeFileSync(tmpPath, new Uint8Array(audioBuffer));
    return await transcribeAudio(tmpPath, options);
  } finally {
    if (existsSync(tmpPath)) {
      unlinkSync(tmpPath);
    }
  }
}
