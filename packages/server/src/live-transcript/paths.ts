// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { existsSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { loadConfig, PROJECT_ROOT } from "../config.js";
import { isPathInside } from "../byod/paths.js";

export type LivePathResolution =
  | { ok: true; path: string }
  | { ok: false; reason: "denied" | "not_found"; message: string };

/** Split colon/semicolon path lists without treating Windows drive letters as separators. */
export function splitEnvPathList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === ";") {
      pushPathPart(parts, current);
      current = "";
      continue;
    }
    if (ch === ":") {
      const next = raw[i + 1];
      if (/^[A-Za-z]$/.test(current) && (next === "\\" || next === "/")) {
        current += ch;
        continue;
      }
      pushPathPart(parts, current);
      current = "";
      continue;
    }
    current += ch;
  }
  pushPathPart(parts, current);
  return parts;
}

function pushPathPart(parts: string[], current: string): void {
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
}

function addRoot(roots: Set<string>, path: string): void {
  const resolved = resolve(path);
  roots.add(resolved);
  if (!existsSync(resolved)) return;
  try {
    roots.add(realpathSync(resolved));
  } catch {
    // Keep the unresolved root; realpath can fail on broken links.
  }
}

/** Well-known companion DB locations (Tauri identifier `app.opengranola`). */
export function companionDbCandidates(): string[] {
  const home = homedir();
  const appData = process.env.APPDATA;
  const localAppData = process.env.LOCALAPPDATA;
  const xdg = process.env.XDG_DATA_HOME;
  const ids = ["app.opengranola", "Open Granola", "open-granola", "opengranola"];
  const out: string[] = [];
  for (const id of ids) {
    if (appData) out.push(resolve(appData, id, "library", "opengranola.db"));
    if (localAppData) out.push(resolve(localAppData, id, "library", "opengranola.db"));
    out.push(resolve(home, "Library", "Application Support", id, "library", "opengranola.db"));
    out.push(resolve(home, ".local", "share", id, "library", "opengranola.db"));
    if (xdg) out.push(resolve(xdg, id, "library", "opengranola.db"));
  }
  return [...new Set(out)];
}

export function discoverOpenGranolaDb(): string | null {
  const { openGranolaDb } = loadConfig();
  if (openGranolaDb) {
    const resolved = resolve(openGranolaDb);
    if (existsSync(resolved)) {
      try {
        return realpathSync(resolved);
      } catch {
        return resolved;
      }
    }
    return resolved;
  }
  for (const candidate of companionDbCandidates()) {
    if (!existsSync(candidate)) continue;
    try {
      return realpathSync(candidate);
    } catch {
      return resolve(candidate);
    }
  }
  return null;
}

export function liveTranscriptAllowRoots(): string[] {
  const roots = new Set<string>();
  addRoot(roots, PROJECT_ROOT);
  const config = loadConfig();
  if (config.byodPath) addRoot(roots, config.byodPath);
  for (const extra of splitEnvPathList(config.liveTranscriptAllowPathsRaw)) {
    addRoot(roots, extra);
  }
  if (config.openGranolaDb) {
    const resolved = resolve(config.openGranolaDb);
    addRoot(roots, dirname(resolved));
    addRoot(roots, resolved);
  }
  for (const candidate of companionDbCandidates()) {
    if (!existsSync(candidate)) continue;
    addRoot(roots, dirname(candidate));
    addRoot(roots, candidate);
  }
  return [...roots];
}

function isAllowed(target: string, roots: string[]): boolean {
  return roots.some((root) => isPathInside(root, target));
}

export function resolveLiveTranscriptPath(filePath: string, mustExist = true): LivePathResolution {
  const trimmed = filePath.trim();
  if (!trimmed) {
    return { ok: false, reason: "not_found", message: "Path is required." };
  }

  const resolved = resolve(trimmed);
  const roots = liveTranscriptAllowRoots();
  if (!isAllowed(resolved, roots)) {
    return {
      ok: false,
      reason: "denied",
      message:
        "Access denied. Path must be under the project root, BYOD_PATH, LIVE_TRANSCRIPT_ALLOW_PATHS, or OPENGRANOLA_DB.",
    };
  }

  if (!existsSync(resolved)) {
    if (!mustExist) return { ok: true, path: resolved };
    return { ok: false, reason: "not_found", message: `Path not found: ${trimmed}` };
  }

  let real: string;
  try {
    real = realpathSync(resolved);
  } catch {
    return { ok: false, reason: "denied", message: "Access denied. Unable to resolve path." };
  }

  if (!isAllowed(real, roots)) {
    return {
      ok: false,
      reason: "denied",
      message: "Access denied. Resolved path is outside the live-transcript allowlist.",
    };
  }

  return { ok: true, path: real };
}
