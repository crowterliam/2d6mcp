// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { checkByodConsent, getByodPath } from "../../byod/gate.js";
import { loadConfig } from "../../config.js";
import { getByodDatabase, searchByodIndex, clearByodDatabase, listByodFiles, getFileChunks, getChunkContent } from "../../byod/search.js";
import { syncByodIndex, syncFile, ensureByodForQuery } from "../helpers.js";

export async function handleQueryLocalByod(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const searchTerm =
    typeof args?.search_term === "string" ? args.search_term : "";
  const systemHint = typeof args?.system === "string" ? args.system : undefined;

  const consent = checkByodConsent();
  if (!consent.allowed) {
    return {
      content: [{ type: "text", text: consent.message }],
      isError: true,
    };
  }

  const config = loadConfig();
  const ensured = await ensureByodForQuery(config, searchTerm, systemHint);
  const byodPath = getByodPath();
  const db = getByodDatabase(byodPath);
  const prefixes = ensured.matchedRoots.length > 0 ? ensured.matchedRoots : undefined;
  const results = searchByodIndex(db, searchTerm, 20, prefixes);
  const includeFull = args?.include_full === true;

  const payload = includeFull
    ? results.map((r) => {
        const full = getChunkContent(db, r.filePath, r.chunkIndex);
        return { ...r, content: full?.chunk.content ?? null };
      })
    : results;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            query: searchTerm,
            matched_roots: ensured.matchedRoots,
            index_complete: ensured.sync.complete,
            index: {
              filesIndexed: ensured.sync.filesIndexed,
              remaining: ensured.sync.remaining,
              dirsRemaining: ensured.sync.dirsRemaining,
              message: ensured.sync.message,
            },
            results: payload,
            count: payload.length,
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function handleSyncByod(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const consent = checkByodConsent();
  if (!consent.allowed) {
    return {
      content: [{ type: "text", text: consent.message }],
      isError: true,
    };
  }

  const relativePath =
    typeof args?.relative_path === "string" ? args.relative_path : "";
  const query =
    typeof args?.query === "string"
      ? args.query
      : typeof args?.system === "string"
        ? args.system
        : "";

  if (relativePath) {
    const config = loadConfig();
    const result = await syncFile(config, relativePath);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  const config = loadConfig();
  const result = await syncByodIndex(config, query ? { query } : {});
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

export async function handleSyncFile(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const consent = checkByodConsent();
  if (!consent.allowed) {
    return {
      content: [{ type: "text", text: consent.message }],
      isError: true,
    };
  }

  const relativePath =
    typeof args?.relative_path === "string" ? args.relative_path : "";

  if (!relativePath) {
    return {
      content: [{ type: "text", text: "Error: relative_path is required" }],
      isError: true,
    };
  }

  const config = loadConfig();
  const result = await syncFile(config, relativePath);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

export async function handleClearByod(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const consent = checkByodConsent();
  if (!consent.allowed) {
    return {
      content: [{ type: "text", text: consent.message }],
      isError: true,
    };
  }

  const byodPath = getByodPath();
  const result = clearByodDatabase(byodPath);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

export async function handleListByodFiles(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const consent = checkByodConsent();
  if (!consent.allowed) {
    return {
      content: [{ type: "text", text: consent.message }],
      isError: true,
    };
  }

  const relativePath =
    typeof args?.relative_path === "string" ? args.relative_path : "";

  if (relativePath) {
    return handleInspectByodFile(args);
  }

  const byodPath = getByodPath();
  const db = getByodDatabase(byodPath);
  const files = listByodFiles(db);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            total: files.length,
            indexed: files.filter((f: { status: string }) => f.status === "indexed").length,
            failed: files.filter((f: { status: string }) => f.status === "failed").length,
            files,
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function handleInspectByodFile(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const consent = checkByodConsent();
  if (!consent.allowed) {
    return {
      content: [{ type: "text", text: consent.message }],
      isError: true,
    };
  }

  const relativePath =
    typeof args?.relative_path === "string" ? args.relative_path : "";

  if (!relativePath) {
    return {
      content: [{ type: "text", text: "Error: relative_path is required" }],
      isError: true,
    };
  }

  const byodPath = getByodPath();
  const db = getByodDatabase(byodPath);
  const result = getFileChunks(db, relativePath);

  if (!result.file) {
    return {
      content: [
        {
          type: "text",
          text: `No file found with path: ${relativePath}`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function handleGetByodChunk(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const consent = checkByodConsent();
  if (!consent.allowed) {
    return {
      content: [{ type: "text", text: consent.message }],
      isError: true,
    };
  }

  const relativePath =
    typeof args?.relative_path === "string" ? args.relative_path : "";
  const chunkIndex =
    typeof args?.chunk_index === "number" ? args.chunk_index : -1;

  if (!relativePath) {
    return {
      content: [{ type: "text", text: "Error: relative_path is required" }],
      isError: true,
    };
  }

  if (chunkIndex < 0) {
    return {
      content: [{ type: "text", text: "Error: chunk_index is required and must be >= 0" }],
      isError: true,
    };
  }

  const byodPath = getByodPath();
  const db = getByodDatabase(byodPath);
  const result = getChunkContent(db, relativePath, chunkIndex);

  if (!result) {
    return {
      content: [
        {
          type: "text",
          text: `No chunk found: ${relativePath} [index ${chunkIndex}]`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
