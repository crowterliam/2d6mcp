// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, PROJECT_ROOT } from "../config.js";
import { isPathInside } from "../byod/paths.js";
import { liveTranscriptAllowRoots, splitEnvPathList } from "../live-transcript/paths.js";

export type ChronicleExportResolution =
  | { ok: true; path: string }
  | { ok: false; reason: "denied"; message: string };

function addRoot(roots: Set<string>, path: string): void {
  const resolved = resolve(path);
  roots.add(resolved);
  if (!existsSync(resolved)) return;
  try {
    roots.add(realpathSync(resolved));
  } catch {
    // Keep unresolved.
  }
}

export function chronicleExportAllowRoots(): string[] {
  const { byodPath, chronicleExportAllowPathsRaw } = loadConfig();
  const roots = new Set<string>(liveTranscriptAllowRoots());
  addRoot(roots, PROJECT_ROOT);
  if (byodPath) addRoot(roots, byodPath);
  for (const part of splitEnvPathList(chronicleExportAllowPathsRaw)) {
    addRoot(roots, part);
  }
  return [...roots];
}

export function resolveChronicleExportPath(requested: string): ChronicleExportResolution {
  const resolved = resolve(requested);
  const roots = chronicleExportAllowRoots();
  if (roots.some((root) => isPathInside(root, resolved))) {
    return { ok: true, path: resolved };
  }
  return {
    ok: false,
    reason: "denied",
    message:
      "Export path is not allowlisted. Use a path under the project root, BYOD_PATH, LIVE_TRANSCRIPT_ALLOW_PATHS, or CHRONICLE_EXPORT_ALLOW_PATHS.",
  };
}
