// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { isAbsolute, relative, resolve, sep } from "node:path";

export function toRelativePath(baseDir: string, fullPath: string): string {
  return relative(resolve(baseDir), resolve(fullPath));
}

export function isPathInside(root: string, target: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  if (resolvedTarget === resolvedRoot) return true;
  const rel = relative(resolvedRoot, resolvedTarget);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

export function pathHasPrefix(filePath: string, prefix: string): boolean {
  if (prefix === "") return true;
  const normalizedFile = filePath.replace(/\\/g, "/");
  const normalizedPrefix = prefix.replace(/\\/g, "/");
  return normalizedFile === normalizedPrefix || normalizedFile.startsWith(`${normalizedPrefix}/`);
}

export function pathMatchesAnyPrefix(filePath: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathHasPrefix(filePath, prefix));
}
