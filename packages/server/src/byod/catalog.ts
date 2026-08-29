// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import { extractKeywordList } from "@2d6mcp/shared";

const CATALOG_FILE_EXTS = new Set([
  ".pdf",
  ".md",
  ".markdown",
  ".txt",
  ".html",
  ".htm",
  ".json",
  ".xml",
  ".csv",
]);

export interface CatalogEntry {
  name: string;
  relativePath: string;
  kind: "dir" | "file";
}

export function normalizeCatalogText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function entryMatchesQuery(entry: CatalogEntry, query: string): boolean {
  const needles = extractKeywordList(query);
  if (needles.length === 0) return false;

  const hay = normalizeCatalogText(entry.name);
  const nameTokens = extractKeywordList(entry.name);
  const queryTokens = new Set(needles);

  const nameInQuery = nameTokens.length > 0 && nameTokens.every((token) => queryTokens.has(token));
  const queryInName = needles.every((token) => hay.includes(token));
  return nameInQuery || queryInName;
}

export function matchCatalogEntries(entries: CatalogEntry[], query: string): CatalogEntry[] {
  const primary = entries.filter((entry) => entryMatchesQuery(entry, query));
  if (primary.length === 0) return [];
  const extra = entries.filter((entry) => {
    if (primary.includes(entry)) return false;
    const hay = normalizeCatalogText(entry.name);
    return primary.some((hit) => hay.includes(normalizeCatalogText(hit.name)));
  });
  return [...primary, ...extra];
}

export async function listByodCatalog(byodPath: string): Promise<CatalogEntry[]> {
  if (!existsSync(byodPath)) return [];

  let dirents;
  try {
    dirents = await readdir(byodPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const entries: CatalogEntry[] = [];
  for (const dirent of dirents) {
    if (dirent.name.startsWith(".")) continue;
    let isDir = dirent.isDirectory();
    let isFile = dirent.isFile();
    if (!isDir && !isFile) {
      try {
        const st = await stat(join(byodPath, dirent.name));
        isDir = st.isDirectory();
        isFile = st.isFile();
      } catch {
        continue;
      }
    }
    if (isDir) {
      entries.push({ name: dirent.name, relativePath: dirent.name, kind: "dir" });
      continue;
    }
    if (!isFile) continue;
    const ext = extname(dirent.name).toLowerCase();
    if (!CATALOG_FILE_EXTS.has(ext)) continue;
    entries.push({ name: dirent.name, relativePath: dirent.name, kind: "file" });
  }
  return entries;
}

export function catalogAbsPath(byodPath: string, relativePath: string): string {
  return relativePath ? join(byodPath, relativePath) : byodPath;
}
