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

export function loadConfig(): {
  byodConsented: boolean;
  byodPath: string | null;
  oglDbPath: string;
} {
  const envAgreed = process.env.AGREE_BYOD_USE === "true";
  const tokenExists = existsSync(BYOD_CONSENT_FILE);
  const byodConsented = envAgreed || tokenExists;

  const byodPath = process.env.BYOD_PATH || null;
  const oglDbPath =
    process.env.OGL_DB_PATH ||
    resolve(PROJECT_ROOT, "data", "ogl", "cepheus.db");

  return { byodConsented, byodPath, oglDbPath };
}

export function isByodEnabled(): boolean {
  const { byodConsented, byodPath } = loadConfig();
  return byodConsented && byodPath !== null && existsSync(byodPath);
}

export const BYOD_DISCLAIMER =
  "BYOD Mode is disabled. By enabling local file ingestion, you confirm that you are the legal owner of the imported files or hold a valid license to use them. The developers of this software do not condone piracy or the unauthorized distribution of copyrighted tabletop roleplaying materials. Set AGREE_BYOD_USE=\"true\" in your environment or run `2d6mcp setup` to enable this feature.";
