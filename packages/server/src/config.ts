// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findProjectRoot(): string {
  let dir = resolve(__dirname);
  while (true) {
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    if (existsSync(resolve(dir, "data", "ogl"))) return dir;
    dir = parent;
  }
  return resolve(__dirname, "..", "..");
}

export const PROJECT_ROOT = findProjectRoot();

export const BYOD_CONSENT_FILE = resolve(PROJECT_ROOT, ".mcp-byod-consent-accepted");

export interface Config {
  byodConsented: boolean;
  byodPath: string | null;
  oglDbPath: string;
  dwDbPath: string;
  sessionDbPath: string;
  mlxWhisperModel: string;
  mlxLLMModel: string;
  whisperCppModel: string;
  llamaCppModel: string;
  sttBackend: "mlx" | "whispercpp";
  llmBackend: "mlx" | "llamacpp";
  byodChunkSize: number;
  byodChunkOverlap: number;
  byodMaxFiles: number;
  byodMaxChunksPerFile: number;
  byodSyncTimeoutMs: number;
  byodMaxFileSize: number;
}

const DEFAULT_CHUNK_SIZE = 8000;
const DEFAULT_CHUNK_OVERLAP = 400;
const DEFAULT_MAX_FILES = 2000;
const DEFAULT_MAX_CHUNKS_PER_FILE = 500;
const DEFAULT_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const DEFAULT_SYNC_TIMEOUT_MS = 15000;

function parseIntEnv(key: string, fallback: number, min: number, max: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function loadConfig(): Config {
  const envAgreed = process.env.AGREE_BYOD_USE === "true";
  const tokenExists = existsSync(BYOD_CONSENT_FILE);
  const byodConsented = envAgreed || tokenExists;

  const rawByodPath = process.env.BYOD_PATH || null;
  let byodPath: string | null = null;
  if (rawByodPath) {
    if (isAbsolute(rawByodPath)) {
      byodPath = rawByodPath;
      process.stderr.write(`2d6mcp: BYOD_PATH is absolute: ${byodPath}\n`);
    } else {
      const cwdResolved = resolve(process.cwd(), rawByodPath);
      process.stderr.write(`2d6mcp: BYOD_PATH is relative. cwd=${process.cwd()}, cwdResolved=${cwdResolved}, exists=${existsSync(cwdResolved)}\n`);
      if (existsSync(cwdResolved)) {
        byodPath = cwdResolved;
        process.stderr.write(`2d6mcp: Resolved BYOD_PATH via cwd: ${byodPath}\n`);
      } else {
        const rootResolved = resolve(PROJECT_ROOT, rawByodPath);
        process.stderr.write(`2d6mcp: cwdResolved not found. PROJECT_ROOT=${PROJECT_ROOT}, rootResolved=${rootResolved}, exists=${existsSync(rootResolved)}\n`);
        byodPath = existsSync(rootResolved) ? rootResolved : cwdResolved;
        process.stderr.write(`2d6mcp: Resolved BYOD_PATH via fallback: ${byodPath}\n`);
      }
    }
  } else {
    // Auto-discovery: check for .reference directory in project root (skip in test env)
    if (process.env.NODE_ENV !== "test" && process.env.VITEST === undefined) {
      const autoPath = resolve(PROJECT_ROOT, ".reference");
      if (existsSync(autoPath)) {
        byodPath = autoPath;
        process.stderr.write(`2d6mcp: BYOD_PATH not set — auto-discovered .reference in project root: ${autoPath}\n`);
      } else {
        process.stderr.write(`2d6mcp: BYOD_PATH not set\n`);
      }
    } else {
      process.stderr.write(`2d6mcp: BYOD_PATH not set\n`);
    }
  }

  const byodChunkSize = parseIntEnv("BYOD_CHUNK_SIZE", DEFAULT_CHUNK_SIZE, 500, 50000);
  const byodChunkOverlap = parseIntEnv("BYOD_CHUNK_OVERLAP", DEFAULT_CHUNK_OVERLAP, 0, byodChunkSize / 2);
  const byodMaxFiles = parseIntEnv("BYOD_MAX_FILES", DEFAULT_MAX_FILES, 1, 50000);
  const byodMaxChunksPerFile = parseIntEnv("BYOD_MAX_CHUNKS_PER_FILE", DEFAULT_MAX_CHUNKS_PER_FILE, 1, 2000);
  const byodSyncTimeoutMs = parseIntEnv("BYOD_SYNC_TIMEOUT_MS", DEFAULT_SYNC_TIMEOUT_MS, 1000, 300000);
  const byodMaxFileSize = parseIntEnv("BYOD_MAX_FILE_SIZE", DEFAULT_MAX_FILE_SIZE_BYTES, 1024 * 1024, 1024 * 1024 * 1024);

  const oglDbPath =
    process.env.OGL_DB_PATH ||
    resolve(PROJECT_ROOT, "data", "ogl", "cepheus.db");

  const dwDbPath =
    process.env.DW_DB_PATH ||
    resolve(PROJECT_ROOT, "data", "dw", "dungeon-world.db");

  const sessionDbPath =
    process.env.SESSION_DB_PATH ||
    resolve(homedir(), ".2d6mcp", "sessions.db");

  const mlxWhisperModel =
    process.env.MLX_WHISPER_MODEL ||
    "mlx-community/whisper-large-v3-turbo";

  const mlxLLMModel =
    process.env.MLX_LLM_MODEL ||
    "mlx-community/Llama-3.2-3B-Instruct-4bit";

  const whisperCppModel =
    process.env.WHISPERCPP_MODEL ||
    "ggml-large-v3-turbo.bin";

  const llamaCppModel =
    process.env.LLAMACPP_MODEL ||
    "Llama-3.2-3B-Instruct.Q4_K_M.gguf";

  const sttBackend = (process.env.STT_BACKEND === "whispercpp") ? "whispercpp" : "mlx";
  const llmBackend = (process.env.LLM_BACKEND === "llamacpp") ? "llamacpp" : "mlx";

  return { byodConsented, byodPath, oglDbPath, dwDbPath, sessionDbPath, mlxWhisperModel, mlxLLMModel, whisperCppModel, llamaCppModel, sttBackend, llmBackend, byodChunkSize, byodChunkOverlap, byodMaxFiles, byodMaxChunksPerFile, byodSyncTimeoutMs, byodMaxFileSize };
}

export function isByodEnabled(): boolean {
  const { byodConsented, byodPath } = loadConfig();
  return byodConsented && byodPath !== null && existsSync(byodPath);
}

export const BYOD_DISCLAIMER =
  "BYOD Mode is disabled. By enabling local file ingestion, you confirm that you are the legal owner of the imported files or hold a valid license to use them. The developers of this software do not condone piracy or the unauthorized distribution of copyrighted tabletop roleplaying materials. Set AGREE_BYOD_USE=\"true\" in your environment or run `2d6mcp setup` to enable this feature.";
