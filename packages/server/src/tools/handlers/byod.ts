// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { checkByodConsent, getByodPath } from "../../byod/gate.js";
import { loadConfig } from "../../config.js";
import { getByodDatabase, searchByodIndex, clearByodDatabase, listByodFiles, getFileChunks, getChunkContent } from "../../byod/search.js";
import { syncByodIndex, syncFile } from "../helpers.js";

export async function handleQueryLocalByod(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const searchTerm =
    typeof args?.search_term === "string" ? args.search_term : "";

  const consent = checkByodConsent();
  if (!consent.allowed) {
    return {
      content: [{ type: "text", text: consent.message }],
      isError: true,
    };
  }

  const byodPath = getByodPath();
  const db = getByodDatabase(byodPath);
  const results = searchByodIndex(db, searchTerm);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            query: searchTerm,
            results,
            count: results.length,
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

  const config = loadConfig();
  const result = await syncByodIndex(config);
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
