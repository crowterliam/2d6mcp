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

export const BYOD_CONSENT_FILE = resolve(PROJECT_ROOT, ".mcp-fair-use-accepted");

export function loadConfig(): {
  agreeNonCommercial: boolean;
  byodPath: string | null;
  oglDbPath: string;
} {
  const envAgreed = process.env.AGREE_NON_COMMERCIAL_USE === "true";
  const tokenExists = existsSync(BYOD_CONSENT_FILE);
  const agreeNonCommercial = envAgreed || tokenExists;

  const byodPath = process.env.BYOD_PATH || null;
  const oglDbPath =
    process.env.OGL_DB_PATH ||
    resolve(PROJECT_ROOT, "data", "ogl", "cepheus.db");

  return { agreeNonCommercial, byodPath, oglDbPath };
}

export function isByodEnabled(): boolean {
  const { agreeNonCommercial, byodPath } = loadConfig();
  return agreeNonCommercial && byodPath !== null && existsSync(byodPath);
}

export const BYOD_DISCLAIMER =
  "BYOD Mode is disabled. By enabling local file ingestion, you confirm that you are the legal owner of the imported files or hold a valid license to use them. You acknowledge that this tool is provided strictly for personal, non-commercial automation and referencing. The developers of this software do not condone piracy or the unauthorized commercial distribution of copyrighted tabletop roleplaying materials. Set AGREE_NON_COMMERCIAL_USE=\"true\" in your environment or run `2d6mcp setup` to enable this feature.";
