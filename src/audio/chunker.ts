// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { execFile, execSync } from "node:child_process";
import { mkdirSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { detectSpeakers, type DiarizedResult } from "./speakers.js";

export interface ChunkManifest {
  filePath: string;
  tempDir: string;
  chunkSizeSeconds: number;
  totalChunks: number;
  chunkFiles: string[];
  sourceDurationSeconds: number;
}

export function isAudioLong(filePath: string, thresholdSeconds: number = 300): boolean {
  try {
    const out = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { timeout: 10000, encoding: "utf-8" }
    );
    const duration = parseFloat(out.trim());
    return duration > thresholdSeconds;
  } catch {
    const stat = statSync(filePath);
    const estimatedSecs = stat.size / 32000;
    return estimatedSecs > thresholdSeconds;
  }
}

export async function chunkAudio(
  filePath: string,
  chunkSizeSeconds: number = 120
): Promise<ChunkManifest> {
  const audioBase = basename(filePath).replace(/\.[^.]+$/, "");
  const tempDir = join(tmpdir(), `2d6mcp-chunks-${audioBase}-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  // Get total duration
  const totalDuration = await getDuration(filePath);

  const totalChunks = Math.ceil(totalDuration / chunkSizeSeconds);
  const chunkFiles: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const startSec = i * chunkSizeSeconds;
    const outputFile = join(tempDir, `chunk_${String(i).padStart(4, "0")}.wav`);

    if (!existsSync(outputFile)) {
      await extractSegment(filePath, outputFile, startSec, chunkSizeSeconds);
    }
    chunkFiles.push(outputFile);
  }

  return {
    filePath,
    tempDir,
    chunkSizeSeconds,
    totalChunks,
    chunkFiles,
    sourceDurationSeconds: totalDuration,
  };
}

function getDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    execFile("ffprobe", [
      "-v", "quiet",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      filePath,
    ], { timeout: 15000, encoding: "utf-8" }, (error, stdout) => {
      if (error) {
        const stat = statSync(filePath);
        resolve(stat.size / 32000);
        return;
      }
      resolve(parseFloat(stdout.trim()) || 0);
    });
  });
}

function extractSegment(
  inputFile: string,
  outputFile: string,
  startSec: number,
  durationSec: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", [
      "-y",
      "-ss", String(startSec),
      "-i", inputFile,
      "-t", String(durationSec),
      "-ar", "16000",
      "-ac", "1",
      "-sample_fmt", "s16",
      outputFile,
    ], { timeout: 30000 }, (error) => {
      if (error) {
        reject(new Error(`ffmpeg segment extraction failed: ${error.message}`));
        return;
      }
      resolve();
    });
  });
}

export async function transcribeChunk(
  chunkFile: string,
  model: string,
  language?: string,
  initialPrompt?: string
): Promise<DiarizedResult> {
  const { transcribeAudio } = await import("./mlx-transcribe.js");
  const result = await transcribeAudio(chunkFile, {
    model,
    language,
    prompt: initialPrompt,
    wordTimestamps: true,
  });

  const cleaned = collapseRepetition(result.text);

  // Diarize using Whisper segment-level timestamps
  if (result.segments && result.segments.length > 1) {
    const diarized = detectSpeakers(result.segments as Array<{ start: number; end: number; text: string }>);
    if (diarized.segments.length > 1) {
      return diarized;
    }
  }

  return {
    text: cleaned,
    segments: [{ speaker: "Speaker", start: 0, end: result.durationSeconds, text: cleaned }],
    speakerCount: 1,
  };
}

export function collapseRepetition(text: string): string {
  const lines = text.split(/\s+/);
  if (lines.length < 10) return text;

  const cleaned: string[] = [];
  let repeatCount = 0;
  let lastWord = "";

  for (const word of lines) {
    if (word === lastWord) {
      repeatCount++;
      if (repeatCount >= 5) continue;
    } else {
      repeatCount = 0;
    }
    lastWord = word;
    cleaned.push(word);
  }

  // Also collapse repeated 2-3 word phrases
  return collapsePhraseRepetition(cleaned.join(" "));
}

function collapsePhraseRepetition(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 30) return text;

  // Only scan the TAIL (last 40%) where Whisper repetitions always occur
  const tailStart = Math.floor(words.length * 0.6);
  const tail = words.slice(tailStart);

  for (let phraseLen = 4; phraseLen <= 10; phraseLen++) {
    if (tail.length < phraseLen * 4) continue;

    for (let i = 0; i < tail.length - phraseLen * 3; i++) {
      const phrase = tail.slice(i, i + phraseLen).join(" ").toLowerCase();
      let count = 1;
      let j = i + phraseLen;

      while (j + phraseLen <= tail.length) {
        const next = tail.slice(j, j + phraseLen).join(" ").toLowerCase();
        if (next === phrase) {
          count++;
          j += phraseLen;
        } else {
          break;
        }
      }

      if (count >= 5) {
        const before = words.slice(0, tailStart + i).join(" ");
        const after = words.slice(tailStart + i + phraseLen * count).join(" ");
        return collapsePhraseRepetition(
          `${before} ${phrase} […repeated ${count - 1} times…] ${after}`.trim().replace(/\s+\[/g, " [")
        );
      }
    }
  }

  return text;
}

export function cleanupChunks(tempDir: string): void {
  try {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  } catch {
    // Best effort cleanup
  }
}

export function getChunkFiles(tempDir: string): string[] {
  if (!existsSync(tempDir)) return [];
  return readdirSync(tempDir)
    .filter((f) => f.startsWith("chunk_") && f.endsWith(".wav"))
    .sort()
    .map((f) => join(tempDir, f));
}
