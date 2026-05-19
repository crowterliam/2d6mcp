// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findProjectRoot(): string {
  let dir = resolve(__dirname);
  while (true) {
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    if (existsSync(resolve(dir, "package.json"))) return dir;
    dir = parent;
  }
  return resolve(__dirname, "..");
}

export const PROJECT_ROOT = findProjectRoot();

export const BYOD_CONSENT_FILE = resolve(PROJECT_ROOT, ".mcp-byod-consent-accepted");

export interface Config {
  byodConsented: boolean;
  byodPath: string | null;
  oglDbPath: string;
  byodChunkSize: number;
  byodChunkOverlap: number;
  byodMaxFiles: number;
  byodMaxChunksPerFile: number;
  byodSyncTimeoutMs: number;
}

const DEFAULT_CHUNK_SIZE = 8000;
const DEFAULT_CHUNK_OVERLAP = 400;
const DEFAULT_MAX_FILES = 2000;
const DEFAULT_MAX_CHUNKS_PER_FILE = 500;
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

  const byodPath = process.env.BYOD_PATH || null;

  const byodChunkSize = parseIntEnv("BYOD_CHUNK_SIZE", DEFAULT_CHUNK_SIZE, 500, 50000);
  const byodChunkOverlap = parseIntEnv("BYOD_CHUNK_OVERLAP", DEFAULT_CHUNK_OVERLAP, 0, byodChunkSize / 2);
  const byodMaxFiles = parseIntEnv("BYOD_MAX_FILES", DEFAULT_MAX_FILES, 1, 50000);
  const byodMaxChunksPerFile = parseIntEnv("BYOD_MAX_CHUNKS_PER_FILE", DEFAULT_MAX_CHUNKS_PER_FILE, 1, 2000);
  const byodSyncTimeoutMs = parseIntEnv("BYOD_SYNC_TIMEOUT_MS", DEFAULT_SYNC_TIMEOUT_MS, 1000, 300000);

  const oglDbPath =
    process.env.OGL_DB_PATH ||
    resolve(PROJECT_ROOT, "data", "ogl", "cepheus.db");

  return { byodConsented, byodPath, oglDbPath, byodChunkSize, byodChunkOverlap, byodMaxFiles, byodMaxChunksPerFile, byodSyncTimeoutMs };
}

export function isByodEnabled(): boolean {
  const { byodConsented, byodPath } = loadConfig();
  return byodConsented && byodPath !== null && existsSync(byodPath);
}

export const BYOD_DISCLAIMER =
  "BYOD Mode is disabled. By enabling local file ingestion, you confirm that you are the legal owner of the imported files or hold a valid license to use them. The developers of this software do not condone piracy or the unauthorized distribution of copyrighted tabletop roleplaying materials. Set AGREE_BYOD_USE=\"true\" in your environment or run `2d6mcp setup` to enable this feature.";
