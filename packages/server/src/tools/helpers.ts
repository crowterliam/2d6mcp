// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { readFileSync, existsSync, statSync } from "node:fs";
import { stat as statAsync } from "node:fs/promises";
import { resolve, join, extname, sep, basename } from "node:path";
import { loadConfig, PROJECT_ROOT, type Config } from "../config.js";
import { populateOglDatabase } from "@2d6mcp/ogl/populate";
import { populateDwDatabase } from "@2d6mcp/dw/populate";
import { populateBrpDatabase } from "@2d6mcp/brp/populate";
import { populate5ecompatibleDatabase } from "@2d6mcp/5ecompatible/populate";
import { populateOrcusDatabase } from "@2d6mcp/orcus/populate";
import { checkByodConsent, getByodPath } from "../byod/gate.js";
import { ingestFile, scanByodDirectory, SLOW_FS_READDIR_MS, type IngestedChunk, type IngestedFile } from "../byod/ingest.js";
import { isPathInside } from "../byod/paths.js";
import { listByodCatalog, matchCatalogEntries, type CatalogEntry } from "../byod/catalog.js";
import {
  getByodDatabase,
  indexChunks,
  rebuildByodFts,
  ensureByodFts,
  getStoredFileHash,
  markFileFailed,
  FAILED_HASH,
  loadWalkState,
  saveWalkState,
  scopeKeyFor,
  type PersistedIngestedFile,
  type ByodWalkState,
} from "../byod/search.js";
import { hasCachedChunks, getCachedChunks, storeCachedChunks, computeContentHash } from "../byod/content-cache.js";

// Keyword extraction and fuzzy matching — re-export from @2d6mcp/shared.
export {
  STOPWORDS,
  extractKeywords,
  extractKeywordList,
  deduplicateBy,
  formatSizeForLog,
  levenshtein,
  fuzzyAlternatives,
  fuzzyKeywordList,
  sanitizeFts5Query,
  buildPrefixFtsQuery,
  buildFuzzyFtsQuery,
  fts5QueryStrategy,
  fuzzyLikeVariants,
} from "@2d6mcp/shared";
import { formatSizeForLog } from "@2d6mcp/shared";

export function getServerVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8")) as { version: string };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function resolveSafePath(filePath: string): string | null {
  const resolved = resolve(filePath);
  const allowedRoots: string[] = [resolve(PROJECT_ROOT)];

  const { byodPath } = loadConfig();
  if (byodPath && existsSync(byodPath)) {
    allowedRoots.push(resolve(byodPath));
  }

  for (const root of allowedRoots) {
    if (resolved === root || resolved.startsWith(root + sep)) {
      return resolved;
    }
  }

  return null;
}

export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export const SUPPORTED_EXTENSIONS = new Set([".pdf", ".md", ".markdown", ".txt", ".html", ".htm", ".json", ".xml", ".csv"]);

export interface SyncFileResult {
  relativePath: string;
  fileName: string;
  ext: string;
  size: number;
  status: "indexed" | "skipped" | "failed" | "not_found" | "unsupported";
  chunks: number;
  elapsedMs: number;
  message: string;
}

export async function syncFile(
  config: Config,
  relativePath: string
): Promise<SyncFileResult> {
  const consent = checkByodConsent();
  if (!consent.allowed) {
    return {
      relativePath,
      fileName: "",
      ext: "",
      size: 0,
      status: "failed",
      chunks: 0,
      elapsedMs: 0,
      message: consent.message,
    };
  }

  const byodPath = getByodPath();
  const fullPath = join(byodPath, relativePath);
  const resolved = resolve(fullPath);

  if (!isPathInside(byodPath, resolved)) {
    return {
      relativePath,
      fileName: "",
      ext: "",
      size: 0,
      status: "failed",
      chunks: 0,
      elapsedMs: 0,
      message: "Access denied. File must be within the BYOD path.",
    };
  }

  if (!existsSync(resolved)) {
    return {
      relativePath,
      fileName: "",
      ext: "",
      size: 0,
      status: "not_found",
      chunks: 0,
      elapsedMs: 0,
      message: `File not found: ${relativePath}`,
    };
  }

  const name = basename(resolved);
  const ext = extname(name).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return {
      relativePath,
      fileName: name,
      ext,
      size: 0,
      status: "unsupported",
      chunks: 0,
      elapsedMs: 0,
      message: `Unsupported file type: ${ext}`,
    };
  }

  const stat = statSync(resolved);
  if (stat.size > config.byodMaxFileSize) {
    const limitMb = (config.byodMaxFileSize / (1024 * 1024)).toFixed(0);
    return {
      relativePath,
      fileName: name,
      ext,
      size: stat.size,
      status: "failed",
      chunks: 0,
      elapsedMs: 0,
      message: `File exceeds ${limitMb} MB limit (${(stat.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  const fingerprint = String(stat.mtimeMs) + "-" + String(stat.size);

  const db = getByodDatabase(byodPath);
  const storedHash = getStoredFileHash(db, relativePath);
  if (storedHash === fingerprint) {
    return {
      relativePath,
      fileName: name,
      ext,
      size: stat.size,
      status: "skipped",
      chunks: 0,
      elapsedMs: 0,
      message: "File unchanged since last sync — skipped.",
    };
  }

  const startTime = Date.now();

  let contentHash: string | null = null;
  try {
    const buf = readFileSync(resolved);
    contentHash = computeContentHash(buf);
  } catch {
  }

  if (contentHash && hasCachedChunks(contentHash)) {
    const cached = getCachedChunks(contentHash);
    indexChunks(
      db,
      relativePath,
      name,
      ext,
      stat.size,
      fingerprint,
      contentHash,
      cached
    );
    rebuildByodFts(db);

    const elapsed = Date.now() - startTime;
    return {
      relativePath,
      fileName: name,
      ext,
      size: stat.size,
      status: "indexed",
      chunks: cached.length,
      elapsedMs: elapsed,
      message: `Indexed ${name} from content cache (${cached.length} chunks, ${formatSizeForLog(stat.size)}) in ${(elapsed / 1000).toFixed(1)}s.`,
    };
  }

  const file: IngestedFile = {
    path: resolved,
    relativePath,
    name,
    size: stat.size,
    ext,
    hash: fingerprint,
    contentHash,
  };

  const options = {
    chunkSize: config.byodChunkSize,
    overlap: config.byodChunkOverlap,
    maxChunksPerFile: config.byodMaxChunksPerFile,
  };

  const chunks = await ingestFile(file, options);

  if (chunks.length === 0) {
    markFileFailed(db, relativePath, name, ext, stat.size);
    const elapsed = Date.now() - startTime;
    return {
      relativePath,
      fileName: name,
      ext,
      size: stat.size,
      status: "failed",
      chunks: 0,
      elapsedMs: elapsed,
      message: `Failed to extract text from ${name}. File marked as failed.`,
    };
  }

  const chunkData = chunks.map((c) => ({ title: c.title, content: c.content, chunkIndex: c.chunkIndex }));

  if (contentHash) {
    storeCachedChunks(contentHash, chunkData);
  }

  indexChunks(
    db,
    relativePath,
    name,
    ext,
    stat.size,
    fingerprint,
    contentHash,
    chunkData
  );

  rebuildByodFts(db);

  const elapsed = Date.now() - startTime;
  return {
    relativePath,
    fileName: name,
    ext,
    size: stat.size,
    status: "indexed",
    chunks: chunks.length,
    elapsedMs: elapsed,
    message: `Indexed ${name} (${chunks.length} chunks, ${formatSizeForLog(stat.size)}) in ${(elapsed / 1000).toFixed(1)}s.`,
  };
}

export interface SyncResult {
  message: string;
  byodPath: string;
  filesIndexed: number;
  totalFiles: number;
  remaining: number;
  complete: boolean;
  chunksIndexed: number;
  elapsedMs: number;
  files: { path: string; status: string }[];
  walkComplete: boolean;
  dirsRemaining: number;
  discovered: number;
  matchedRoots: string[];
  catalog?: CatalogEntry[];
}

export interface SyncByodOptions {
  query?: string;
  roots?: string[];
  /** When true, skip collections already marked complete in walk state. */
  skipCompleted?: boolean;
}

const LOCAL_INDEX_CONCURRENCY = 3;
const NETWORK_INDEX_CONCURRENCY = 1;

function idleSyncResult(message: string, extra: Partial<SyncResult> = {}): SyncResult {
  return {
    message,
    byodPath: "",
    filesIndexed: 0,
    totalFiles: 0,
    remaining: 0,
    complete: true,
    chunksIndexed: 0,
    elapsedMs: 0,
    files: [],
    walkComplete: true,
    dirsRemaining: 0,
    discovered: 0,
    matchedRoots: [],
    ...extra,
  };
}

function toIngestedFile(file: PersistedIngestedFile, byodPath: string): IngestedFile {
  return {
    path: join(byodPath, file.relativePath),
    relativePath: file.relativePath,
    name: file.name,
    size: file.size,
    ext: file.ext,
    hash: file.hash,
    contentHash: null,
  };
}

function toPersistedFile(file: IngestedFile): PersistedIngestedFile {
  return {
    path: file.path,
    relativePath: file.relativePath,
    name: file.name,
    size: file.size,
    ext: file.ext,
    hash: file.hash,
  };
}

function indexConcurrency(config: Config, slowFs: boolean): number {
  return config.byodNetwork || slowFs ? NETWORK_INDEX_CONCURRENCY : LOCAL_INDEX_CONCURRENCY;
}

async function ingestFileBatch(
  db: ReturnType<typeof getByodDatabase>,
  byodPath: string,
  batch: IngestedFile[],
  options: { chunkSize: number; overlap: number; maxChunksPerFile: number }
): Promise<{
  indexed: number;
  failed: number;
  reusedFromCache: number;
  totalChunks: number;
  fileStatuses: { path: string; status: string }[];
}> {
  const batchResults: { chunks: IngestedChunk[]; fromCache: boolean }[] = await Promise.all(
    batch.map(async (f) => {
      const file: IngestedFile = { ...f, path: join(byodPath, f.relativePath) };
      if (!file.contentHash) {
        try {
          file.contentHash = computeContentHash(readFileSync(file.path));
        } catch {
          file.contentHash = null;
        }
      }
      if (file.contentHash && hasCachedChunks(file.contentHash)) {
        const cached = getCachedChunks(file.contentHash);
        f.contentHash = file.contentHash;
        return {
          chunks: cached.map((c) => ({
            filePath: file.relativePath,
            fileName: file.name,
            title: c.title,
            content: c.content,
            chunkIndex: c.chunkIndex,
          })),
          fromCache: true,
        };
      }
      f.contentHash = file.contentHash;
      const chunks = await ingestFile(file, options);
      return { chunks, fromCache: false };
    })
  );

  let indexed = 0;
  let failed = 0;
  let reusedFromCache = 0;
  let totalChunks = 0;
  const fileStatuses: { path: string; status: string }[] = [];

  for (let k = 0; k < batch.length; k++) {
    const file = batch[k];
    const { chunks, fromCache } = batchResults[k];

    if (chunks.length === 0) {
      failed++;
      markFileFailed(db, file.relativePath, file.name, file.ext, file.size);
      fileStatuses.push({ path: file.relativePath, status: "failed" });
      continue;
    }

    const chunkData = chunks.map((c) => ({ title: c.title, content: c.content, chunkIndex: c.chunkIndex }));

    if (!fromCache && file.contentHash) {
      storeCachedChunks(file.contentHash, chunkData);
    }

    indexChunks(
      db,
      file.relativePath,
      file.name,
      file.ext,
      file.size,
      file.hash,
      file.contentHash,
      chunkData
    );

    if (fromCache) reusedFromCache++;
    totalChunks += chunks.length;
    indexed++;
    fileStatuses.push({ path: file.relativePath, status: fromCache ? "indexed_cached" : "indexed" });
  }

  return { indexed, failed, reusedFromCache, totalChunks, fileStatuses };
}

export async function syncByodIndex(config: Config, syncOptions: SyncByodOptions = {}): Promise<SyncResult> {
  const consent = checkByodConsent();
  if (!consent.allowed) return idleSyncResult(consent.message);

  const byodPath = getByodPath();
  const db = getByodDatabase(byodPath);
  const query = syncOptions.query?.trim() ?? "";
  const explicitRoots = syncOptions.roots;

  if (!explicitRoots && !query) {
    const catalog = await listByodCatalog(byodPath);
    return idleSyncResult(
      "Listed top-level BYOD collections. Pass query (for example \"traveller\") to index matching folders on demand.",
      { byodPath, catalog, complete: true, walkComplete: true }
    );
  }

  let catalog: CatalogEntry[] | undefined;
  let matchedRoots = explicitRoots;
  if (!matchedRoots) {
    catalog = await listByodCatalog(byodPath);
    matchedRoots = matchCatalogEntries(catalog, query).map((entry) => entry.relativePath);
    if (matchedRoots.length === 0) {
      return idleSyncResult(`No BYOD collections matched "${query}".`, {
        byodPath,
        catalog,
        matchedRoots: [],
        complete: true,
        walkComplete: true,
      });
    }
  }

  return runScopedByodSync(config, byodPath, db, matchedRoots, catalog, syncOptions.skipCompleted === true);
}

export interface EnsureByodResult {
  matchedRoots: string[];
  catalog: CatalogEntry[];
  sync: SyncResult;
}

export async function ensureByodForQuery(
  config: Config,
  query: string,
  systemHint?: string
): Promise<EnsureByodResult> {
  const byodPath = getByodPath();
  const catalog = await listByodCatalog(byodPath);
  const hint = systemHint?.trim() ?? "";
  let matched = hint ? matchCatalogEntries(catalog, hint) : [];
  if (matched.length === 0) {
    matched = matchCatalogEntries(catalog, query);
  }
  const matchedRoots = matched.map((entry) => entry.relativePath);
  if (matchedRoots.length === 0) {
    return {
      matchedRoots: [],
      catalog,
      sync: idleSyncResult(`No BYOD collections matched the request.`, { byodPath, catalog }),
    };
  }
  const sync = await syncByodIndex(config, { roots: matchedRoots, skipCompleted: true });
  return { matchedRoots, catalog, sync };
}

async function classifyRoots(
  byodPath: string,
  roots: string[]
): Promise<{ dirs: string[]; files: PersistedIngestedFile[] }> {
  const dirs: string[] = [];
  const files: PersistedIngestedFile[] = [];
  for (const root of roots) {
    const abs = root ? join(byodPath, root) : byodPath;
    try {
      const st = await statAsync(abs);
      if (st.isDirectory()) {
        dirs.push(root);
      } else if (st.isFile()) {
        files.push({
          path: abs,
          relativePath: root,
          name: basename(abs),
          size: st.size,
          ext: extname(abs).toLowerCase(),
          hash: `${st.mtimeMs}-${st.size}`,
        });
      }
    } catch {
      process.stderr.write(`2d6mcp: Skipping missing BYOD root ${root}\n`);
    }
  }
  return { dirs, files };
}

function uniqueRoots(roots: string[]): string[] {
  return [...new Set(roots)];
}

async function prepareScopedWalk(
  byodPath: string,
  existing: ByodWalkState | null,
  matchedRoots: string[],
  slowFs: boolean,
  skipCompleted: boolean
): Promise<ByodWalkState> {
  const completed = new Set(existing?.completedRoots ?? []);
  const stillNeeded = skipCompleted
    ? matchedRoots.filter((root) => !completed.has(root))
    : matchedRoots;
  const key = scopeKeyFor(stillNeeded.length > 0 ? stillNeeded : matchedRoots);

  if (stillNeeded.length === 0) {
    return {
      pendingDirs: [],
      pendingFiles: [],
      walkComplete: true,
      discovered: 0,
      slowFs: Boolean(existing?.slowFs || slowFs),
      scopeKey: key,
      completedRoots: existing?.completedRoots ?? [...matchedRoots],
    };
  }

  if (existing && existing.scopeKey === key && !existing.walkComplete) {
    return { ...existing, slowFs: existing.slowFs || slowFs };
  }

  const classified = await classifyRoots(byodPath, stillNeeded);
  const completedRoots = (existing?.completedRoots ?? []).filter((root) => !stillNeeded.includes(root));
  return {
    pendingDirs: classified.dirs,
    pendingFiles: classified.files,
    walkComplete: false,
    discovered: classified.files.length,
    slowFs: Boolean(existing?.slowFs || slowFs),
    scopeKey: key,
    completedRoots,
  };
}

async function runScopedByodSync(
  config: Config,
  byodPath: string,
  db: ReturnType<typeof getByodDatabase>,
  matchedRoots: string[],
  catalog: CatalogEntry[] | undefined,
  skipCompleted: boolean
): Promise<SyncResult> {
  const startTime = Date.now();
  const deadline = startTime + config.byodSyncTimeoutMs;
  const loaded = loadWalkState(db);
  let state = await prepareScopedWalk(byodPath, loaded, matchedRoots, config.byodNetwork, skipCompleted);
  if (config.byodNetwork) {
    state.slowFs = true;
  }

  if (state.walkComplete && state.pendingDirs.length === 0 && state.pendingFiles.length === 0) {
    return idleSyncResult(`Matching collections already indexed: ${matchedRoots.join(", ")}.`, {
      byodPath,
      catalog,
      matchedRoots,
      complete: true,
      walkComplete: true,
    });
  }

  const options = {
    chunkSize: config.byodChunkSize,
    overlap: config.byodChunkOverlap,
    maxChunksPerFile: config.byodMaxChunksPerFile,
  };

  let indexedFiles = 0;
  let failedFiles = 0;
  let skippedByHash = 0;
  let reusedFromCache = 0;
  let totalChunks = 0;
  const fileStatuses: { path: string; status: string }[] = [];
  let didWork = false;

  const concurrency = indexConcurrency(config, state.slowFs);
  process.stderr.write(
    `2d6mcp: On-demand BYOD sync [${matchedRoots.join(", ")}] (${(config.byodSyncTimeoutMs / 1000).toFixed(0)}s budget, concurrency ${concurrency})...\n`
  );

  while (true) {
    if (didWork && Date.now() >= deadline) {
      break;
    }

    const hasWalkWork = state.pendingDirs.length > 0;
    const hasIndexWork = state.pendingFiles.length > 0;
    if (!hasWalkWork && !hasIndexWork) {
      state.walkComplete = true;
      saveWalkState(db, state);
      break;
    }

    if (state.pendingFiles.length === 0 && state.pendingDirs.length > 0) {
      const relDir = state.pendingDirs.shift() ?? "";
      const absDir = relDir ? join(byodPath, relDir) : byodPath;
      const scanned = await scanByodDirectory(absDir, byodPath, config.byodMaxFileSize);
      if (scanned.readdirMs >= SLOW_FS_READDIR_MS) {
        state.slowFs = true;
      }

      if (state.discovered < config.byodMaxFiles) {
        const room = config.byodMaxFiles - state.discovered;
        const accepted = scanned.files.slice(0, room);
        state.pendingFiles.push(...accepted.map(toPersistedFile));
        state.discovered += accepted.length;
        if (state.discovered < config.byodMaxFiles) {
          state.pendingDirs.push(...scanned.subdirsRelative);
        }
      }

      didWork = true;
      saveWalkState(db, state);
      await yieldToEventLoop();
      continue;
    }

    const batch: IngestedFile[] = [];
    const currentConcurrency = indexConcurrency(config, state.slowFs);
    while (state.pendingFiles.length > 0 && batch.length < currentConcurrency) {
      const persisted = state.pendingFiles.shift();
      if (!persisted) break;
      const file = toIngestedFile(persisted, byodPath);
      const storedHash = getStoredFileHash(db, file.relativePath);
      if (storedHash === file.hash || storedHash === FAILED_HASH) {
        skippedByHash++;
        fileStatuses.push({
          path: file.relativePath,
          status: storedHash === FAILED_HASH ? "skipped_failed" : "up_to_date",
        });
        continue;
      }
      batch.push(file);
    }

    if (batch.length === 0) {
      didWork = true;
      saveWalkState(db, state);
      await yieldToEventLoop();
      continue;
    }

    const outcome = await ingestFileBatch(db, byodPath, batch, options);
    indexedFiles += outcome.indexed;
    failedFiles += outcome.failed;
    reusedFromCache += outcome.reusedFromCache;
    totalChunks += outcome.totalChunks;
    fileStatuses.push(...outcome.fileStatuses);

    didWork = true;
    saveWalkState(db, state);
    await yieldToEventLoop();
  }

  ensureByodFts(db);
  if (state.pendingDirs.length === 0 && state.pendingFiles.length === 0) {
    state.walkComplete = true;
    state.completedRoots = uniqueRoots([...state.completedRoots, ...matchedRoots]);
  }
  saveWalkState(db, state);

  const elapsed = Date.now() - startTime;
  const walkComplete = state.walkComplete && state.pendingDirs.length === 0 && state.pendingFiles.length === 0;
  const remaining = state.pendingFiles.length;
  const dirsRemaining = state.pendingDirs.length;

  if (walkComplete && state.discovered === 0 && indexedFiles === 0 && skippedByHash === 0) {
    return idleSyncResult("No supported files found in matching BYOD collections.", {
      byodPath,
      elapsedMs: elapsed,
      walkComplete: true,
      dirsRemaining: 0,
      discovered: 0,
      matchedRoots,
      catalog,
    });
  }

  const parts: string[] = [];
  if (indexedFiles > 0) {
    parts.push(
      `${indexedFiles} newly indexed (${totalChunks} chunks${reusedFromCache > 0 ? `, ${reusedFromCache} from content cache` : ""})`
    );
  }
  if (skippedByHash > 0) parts.push(`${skippedByHash} already up to date`);
  if (failedFiles > 0) parts.push(`${failedFiles} failed`);
  const summary = parts.length > 0 ? parts.join(", ") : "no file changes";

  if (!walkComplete) {
    return {
      message: `NOT COMPLETE — indexed ${matchedRoots.join(", ")}. ${remaining} files queued, ${dirsRemaining} directories remaining. ${summary} in ${(elapsed / 1000).toFixed(1)}s. Call again to continue this collection.`,
      byodPath,
      filesIndexed: indexedFiles,
      totalFiles: state.discovered,
      remaining,
      complete: false,
      chunksIndexed: totalChunks,
      elapsedMs: elapsed,
      files: fileStatuses,
      walkComplete: state.walkComplete,
      dirsRemaining,
      discovered: state.discovered,
      matchedRoots,
      catalog,
    };
  }

  return {
    message: `COMPLETE. Indexed ${matchedRoots.join(", ")} (${state.discovered} files): ${summary} in ${(elapsed / 1000).toFixed(1)}s.`,
    byodPath,
    filesIndexed: indexedFiles,
    totalFiles: state.discovered,
    remaining: 0,
    complete: true,
    chunksIndexed: totalChunks,
    elapsedMs: elapsed,
    files: fileStatuses,
    walkComplete: true,
    dirsRemaining: 0,
    discovered: state.discovered,
    matchedRoots,
    catalog,
  };
}

// formatSizeForLog is imported from @2d6mcp/shared (see top of file) and
// re-exported for callers importing from this module.

export function ensureOglDb(): { dbPath: string; initialized: boolean } {
  const { oglDbPath } = loadConfig();

  if (!existsSync(oglDbPath)) {
    populateOglDatabase(oglDbPath);
    return { dbPath: oglDbPath, initialized: true };
  }

  return { dbPath: oglDbPath, initialized: false };
}

export function ensureDwDb(): { dbPath: string; initialized: boolean } {
  const { dwDbPath } = loadConfig();

  if (!existsSync(dwDbPath)) {
    populateDwDatabase(dwDbPath);
    return { dbPath: dwDbPath, initialized: true };
  }

  return { dbPath: dwDbPath, initialized: false };
}

export function ensureBrpDb(): { dbPath: string; initialized: boolean } {
  const { brpDbPath } = loadConfig();

  if (!existsSync(brpDbPath)) {
    populateBrpDatabase(brpDbPath);
    return { dbPath: brpDbPath, initialized: true };
  }

  return { dbPath: brpDbPath, initialized: false };
}

export function ensure5ecompatibleDb(): { dbPath: string; initialized: boolean } {
  const { sr5eDbPath } = loadConfig();

  if (!existsSync(sr5eDbPath)) {
    populate5ecompatibleDatabase(sr5eDbPath);
    return { dbPath: sr5eDbPath, initialized: true };
  }

  return { dbPath: sr5eDbPath, initialized: false };
}

export function ensureOrcusDb(): { dbPath: string; initialized: boolean } {
  const { orcusDbPath } = loadConfig();

  if (!existsSync(orcusDbPath)) {
    populateOrcusDatabase(orcusDbPath);
    return { dbPath: orcusDbPath, initialized: true };
  }

  return { dbPath: orcusDbPath, initialized: false };
}

// Fuzzy matching (fuzzyAlternatives, fuzzyKeywordList) is provided by
// @2d6mcp/shared and re-exported at the top of this file.
