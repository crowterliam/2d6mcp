// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { loadConfig, PROJECT_ROOT, type Config } from "../config.js";
import { populateOglDatabase } from "@2d6mcp/ogl/populate";
import { populateDwDatabase } from "@2d6mcp/dw/populate";
import { populateBrpDatabase } from "@2d6mcp/brp/populate";
import { populate5ecompatibleDatabase } from "@2d6mcp/5ecompatible/populate";
import { populateOrcusDatabase } from "@2d6mcp/orcus/populate";
import { checkByodConsent, getByodPath } from "../byod/gate.js";
import { discoverFiles, ingestFile, type IngestedChunk, type IngestedFile } from "../byod/ingest.js";
import { getByodDatabase, indexChunks, rebuildByodFts, getStoredFileHash, markFileFailed, FAILED_HASH } from "../byod/search.js";
import { getContentCache, hasCachedChunks, getCachedChunks, storeCachedChunks, computeContentHash } from "../byod/content-cache.js";

// Keyword extraction and fuzzy matching are shared between self-hosted and
// hosted deployments — re-export from @2d6mcp/shared to avoid duplication.
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
    if (resolved === root || resolved.startsWith(root + "/")) {
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

  if (!resolved.startsWith(resolve(byodPath) + "/") && resolved !== resolve(byodPath)) {
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

  const name = resolved.split("/").pop() || relativePath;
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
}

export async function syncByodIndex(config: Config): Promise<SyncResult> {
  const consent = checkByodConsent();
  if (!consent.allowed) return { message: consent.message, byodPath: "", filesIndexed: 0, totalFiles: 0, remaining: 0, complete: true, chunksIndexed: 0, elapsedMs: 0, files: [] };

  const byodPath = getByodPath();
  let files = discoverFiles(byodPath, config.byodMaxFileSize);

  if (files.length === 0) {
    return { message: "No supported files found in BYOD directory.", byodPath, filesIndexed: 0, totalFiles: 0, remaining: 0, complete: true, chunksIndexed: 0, elapsedMs: 0, files: [] };
  }

  if (files.length > config.byodMaxFiles) {
    process.stderr.write(
      `2d6mcp: BYOD directory has ${files.length} files, limiting to ${config.byodMaxFiles} (set BYOD_MAX_FILES to override)\n`
    );
    files = files.slice(0, config.byodMaxFiles);
  }

  const db = getByodDatabase(byodPath);
  const options = {
    chunkSize: config.byodChunkSize,
    overlap: config.byodChunkOverlap,
    maxChunksPerFile: config.byodMaxChunksPerFile,
  };

  let totalChunks = 0;
  let indexedFiles = 0;
  let failedFiles = 0;
  let skippedByHash = 0;
  let reusedFromCache = 0;
  const fileStatuses: { path: string; status: string }[] = [];
  const startTime = Date.now();
  const logInterval = Math.max(1, Math.floor(files.length / 20));
  const CONCURRENCY = 3;

  process.stderr.write(`2d6mcp: Indexing ${files.length} files (${(config.byodSyncTimeoutMs / 1000).toFixed(0)}s budget, ${CONCURRENCY} parallel)...\n`);

  let i = 0;
  while (i < files.length) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= config.byodSyncTimeoutMs) {
      const remaining = files.length - i;
      if (indexedFiles === 0) {
        return {
          message: `NOT COMPLETE. No files indexed yet — the first batch took too long. To continue, call sync_byod again.`,
          byodPath,
          filesIndexed: 0,
          totalFiles: files.length,
          remaining,
          complete: false,
          chunksIndexed: 0,
          elapsedMs: elapsed,
          files: fileStatuses,
        };
      }
      const scanned = i;
      const upToDate = skippedByHash;
      return {
        message: `NOT COMPLETE — ${remaining} files remaining. Scanned ${scanned}/${files.length} (${indexedFiles} newly indexed, ${upToDate} already up to date, ${failedFiles} failed) in ${(elapsed / 1000).toFixed(1)}s. You MUST call sync_byod again to continue.`,
        byodPath,
        filesIndexed: indexedFiles,
        totalFiles: files.length,
        remaining,
        complete: false,
        chunksIndexed: totalChunks,
        elapsedMs: elapsed,
        files: fileStatuses,
      };
    }

    const batch: IngestedFile[] = [];
    while (i < files.length && batch.length < CONCURRENCY) {
      const file = files[i];
      const storedHash = getStoredFileHash(db, file.relativePath);
      if (storedHash === file.hash || storedHash === FAILED_HASH) {
        skippedByHash++;
        fileStatuses.push({ path: file.relativePath, status: storedHash === FAILED_HASH ? "skipped_failed" : "up_to_date" });
        i++;
        continue;
      }
      batch.push(file);
      i++;
    }

    if (batch.length === 0) {
      await yieldToEventLoop();
      continue;
    }

    const batchResults: { chunks: IngestedChunk[]; fromCache: boolean }[] = await Promise.all(
      batch.map(async (f) => {
        if (f.contentHash && hasCachedChunks(f.contentHash)) {
          const cached = getCachedChunks(f.contentHash);
          return {
            chunks: cached.map((c) => ({
              filePath: f.relativePath,
              fileName: f.name,
              title: c.title,
              content: c.content,
              chunkIndex: c.chunkIndex,
            })),
            fromCache: true,
          };
        }
        const chunks = await ingestFile(f, options);
        return { chunks, fromCache: false };
      })
    );

    for (let k = 0; k < batch.length; k++) {
      const file = batch[k];
      const { chunks, fromCache } = batchResults[k];

      if (chunks.length === 0) {
        failedFiles++;
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
      indexedFiles++;
      fileStatuses.push({ path: file.relativePath, status: fromCache ? "indexed_cached" : "indexed" });
    }

    const done = skippedByHash + indexedFiles + failedFiles;
    if ((done - 1) % logInterval === 0 || done % logInterval === 0 || done >= files.length - batch.length) {
      const batchSummary =
        batch.length > 1
          ? `${batch.length} files (${batch.map((f) => f.name).join(", ")})`
          : batch[0].name;
      process.stderr.write(
        `2d6mcp: [${done}/${files.length}] ${batchSummary} (${formatSizeForLog(
          batch.reduce((s, f) => s + f.size, 0)
        )}, ${batchResults.reduce((s, c) => s + c.chunks.length, 0)} chunks)\n`
      );
    }

    await yieldToEventLoop();
  }

  if (indexedFiles > 0) {
    rebuildByodFts(db);
  }

  const elapsed = Date.now() - startTime;
  const parts: string[] = [];
  if (indexedFiles > 0) parts.push(`${indexedFiles} newly indexed (${totalChunks} chunks${reusedFromCache > 0 ? `, ${reusedFromCache} from content cache` : ""})`);
  if (skippedByHash > 0) parts.push(`${skippedByHash} already up to date`);
  if (failedFiles > 0) parts.push(`${failedFiles} failed`);

  return {
    message: `COMPLETE. Scanned ${files.length} files: ${parts.join(", ")} in ${(elapsed / 1000).toFixed(1)}s.`,
    byodPath,
    filesIndexed: indexedFiles,
    totalFiles: files.length,
    remaining: 0,
    complete: true,
    chunksIndexed: totalChunks,
    elapsedMs: elapsed,
    files: fileStatuses,
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
