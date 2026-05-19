// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { loadConfig, BYOD_DISCLAIMER, PROJECT_ROOT, type Config } from "./config.js";
import { roll2d6, rollCustom } from "./dice/roller.js";
import { rollD66, rollOnTable, roll2d6Sum, normalizeDiceType, resolveDiceRange } from "./dice/tables.js";
import { getDatabase, initSchema, closeDatabase } from "./ogl/database.js";
import { populateOglDatabase } from "./ogl/populate.js";
import {
  searchOglRules,
  searchOglTables,
  searchOglSkills,
  searchOglCareers,
  searchOglEquipment,
  searchCombat,
  searchShipOps,
  searchWorldBuilding,
  listOglCategories,
  listOglTables,
} from "./ogl/queries.js";
import { checkByodConsent, getByodPath } from "./byod/gate.js";
import { discoverFiles, ingestFile, type IngestedChunk, type IngestedFile } from "./byod/ingest.js";
import { getByodDatabase, indexChunks, rebuildByodFts, searchByodIndex, closeByodDatabase, getStoredFileHash, markFileFailed, FAILED_HASH, clearByodDatabase, listByodFiles, getFileChunks } from "./byod/search.js";
import { parseCharacterText, readCharacterFile, type CharacterStats } from "./character/parser.js";

function getServerVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8")) as { version: string };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function resolveSafePath(filePath: string): string | null {
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

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".md", ".markdown", ".txt", ".html", ".htm", ".json", ".xml", ".csv"]);

interface SyncFileResult {
  relativePath: string;
  fileName: string;
  ext: string;
  size: number;
  status: "indexed" | "skipped" | "failed" | "not_found" | "unsupported";
  chunks: number;
  elapsedMs: number;
  message: string;
}

async function syncFile(
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
  if (stat.size > 50 * 1024 * 1024) {
    return {
      relativePath,
      fileName: name,
      ext,
      size: stat.size,
      status: "failed",
      chunks: 0,
      elapsedMs: 0,
      message: `File exceeds 50 MB limit (${(stat.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  const fingerprint = String(stat.mtimeMs) + "-" + String(stat.size);

  const db = getByodDatabase();
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
  const file: IngestedFile = {
    path: resolved,
    relativePath,
    name,
    size: stat.size,
    ext,
    hash: fingerprint,
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

  indexChunks(
    db,
    relativePath,
    name,
    ext,
    stat.size,
    fingerprint,
    chunks.map((c) => ({ title: c.title, content: c.content, chunkIndex: c.chunkIndex }))
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

interface SyncResult {
  message: string;
  filesIndexed: number;
  totalFiles: number;
  remaining: number;
  complete: boolean;
  chunksIndexed: number;
  elapsedMs: number;
}

async function syncByodIndex(config: Config): Promise<SyncResult> {
  const consent = checkByodConsent();
  if (!consent.allowed) return { message: consent.message, filesIndexed: 0, totalFiles: 0, remaining: 0, complete: true, chunksIndexed: 0, elapsedMs: 0 };

  const byodPath = getByodPath();
  let files = discoverFiles(byodPath);

  if (files.length === 0) {
    return { message: "No supported files found in BYOD directory.", filesIndexed: 0, totalFiles: 0, remaining: 0, complete: true, chunksIndexed: 0, elapsedMs: 0 };
  }

  if (files.length > config.byodMaxFiles) {
    process.stderr.write(
      `2d6mcp: BYOD directory has ${files.length} files, limiting to ${config.byodMaxFiles} (set BYOD_MAX_FILES to override)\n`
    );
    files = files.slice(0, config.byodMaxFiles);
  }

  const db = getByodDatabase();
  const options = {
    chunkSize: config.byodChunkSize,
    overlap: config.byodChunkOverlap,
    maxChunksPerFile: config.byodMaxChunksPerFile,
  };

  let totalChunks = 0;
  let indexedFiles = 0;
  let failedFiles = 0;
  let skippedByHash = 0;
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
          filesIndexed: 0,
          totalFiles: files.length,
          remaining,
          complete: false,
          chunksIndexed: 0,
          elapsedMs: elapsed,
        };
      }
      const scanned = i;
      const upToDate = skippedByHash;
      return {
        message: `NOT COMPLETE — ${remaining} files remaining. Scanned ${scanned}/${files.length} (${indexedFiles} newly indexed, ${upToDate} already up to date, ${failedFiles} failed) in ${(elapsed / 1000).toFixed(1)}s. You MUST call sync_byod again to continue.`,
        filesIndexed: indexedFiles,
        totalFiles: files.length,
        remaining,
        complete: false,
        chunksIndexed: totalChunks,
        elapsedMs: elapsed,
      };
    }

    const batch: IngestedFile[] = [];
    while (i < files.length && batch.length < CONCURRENCY) {
      const file = files[i];
      const storedHash = getStoredFileHash(db, file.relativePath);
      if (storedHash === file.hash || storedHash === FAILED_HASH) {
        skippedByHash++;
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

    const chunkResults = await Promise.all(
      batch.map((f) => ingestFile(f, options))
    );

    const batchStart = indexedFiles + skippedByHash;
    for (let k = 0; k < batch.length; k++) {
      const file = batch[k];
      const chunks = chunkResults[k];

      if (chunks.length === 0) {
        failedFiles++;
        markFileFailed(db, file.relativePath, file.name, file.ext, file.size);
        continue;
      }

      indexChunks(
        db,
        file.relativePath,
        file.name,
        file.ext,
        file.size,
        file.hash,
        chunks.map((c) => ({ title: c.title, content: c.content, chunkIndex: c.chunkIndex }))
      );

      totalChunks += chunks.length;
      indexedFiles++;
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
        )}, ${chunkResults.reduce((s, c) => s + c.length, 0)} chunks)\n`
      );
    }

    await yieldToEventLoop();
  }

  if (indexedFiles > 0) {
    rebuildByodFts(db);
  }

  const elapsed = Date.now() - startTime;
  const parts: string[] = [];
  if (indexedFiles > 0) parts.push(`${indexedFiles} newly indexed (${totalChunks} chunks)`);
  if (skippedByHash > 0) parts.push(`${skippedByHash} already up to date`);
  if (failedFiles > 0) parts.push(`${failedFiles} failed`);

  return {
    message: `COMPLETE. Scanned ${files.length} files: ${parts.join(", ")} in ${(elapsed / 1000).toFixed(1)}s.`,
    filesIndexed: indexedFiles,
    totalFiles: files.length,
    remaining: 0,
    complete: true,
    chunksIndexed: totalChunks,
    elapsedMs: elapsed,
  };
}

function formatSizeForLog(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function ensureOglDb(): { dbPath: string; initialized: boolean } {
  const { oglDbPath } = loadConfig();

  if (!existsSync(oglDbPath)) {
    populateOglDatabase(oglDbPath);
    return { dbPath: oglDbPath, initialized: true };
  }

  return { dbPath: oglDbPath, initialized: false };
}

export async function startServer(): Promise<void> {
  const version = getServerVersion();
  const server = new Server(
    {
      name: "2d6mcp",
      version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [
      {
        name: "roll_2d6",
        description:
          "Roll 2d6 with optional modifiers and compare against a target number. Returns individual dice, total, and effect margin.",
        inputSchema: {
          type: "object",
          properties: {
            modifier: {
              type: "integer",
              description: "Modifier added to the 2d6 roll (default 0)",
              default: 0,
            },
            target_number: {
              type: "integer",
              description: "Target number to roll against; if provided, calculates effect margin and success/failure",
            },
          },
        },
      },
      {
        name: "roll_table",
        description:
          "Roll on a named table using a specified dice type (1d6, 2d6, d66, 1d3, 2d3). Returns the dice result, the matching table entry, and the full description.",
        inputSchema: {
          type: "object",
          properties: {
            table_name: {
              type: "string",
              description: "Name of the table to roll on (e.g., 'Reaction Table', 'Personal Encounter', 'Patron Encounter')",
            },
            dice_type: {
              type: "string",
              enum: ["1d6", "2d6", "d66", "1d3", "2d3"],
              description: "Dice type for the table (default: 2d6)",
              default: "2d6",
            },
          },
          required: ["table_name"],
        },
      },
      {
        name: "query_ogl_rules",
        description:
          "Search the pre-populated OGL rules database (Cepheus Engine SRD) for rules, skills, careers, equipment, or tables. Use this to reference game mechanics without third-party content.",
        inputSchema: {
          type: "object",
          properties: {
            search_term: {
              type: "string",
              description: "Search term or category to look up (e.g., 'combat', 'laser rifle', 'navy career', 'task resolution')",
            },
            category: {
              type: "string",
              description: "Optional category filter: 'rules', 'skills', 'careers', 'equipment', 'tables', 'categories', or 'list_tables'",
            },
          },
          required: ["search_term"],
        },
      },
      {
        name: "query_local_byod",
        description:
          "Search your local ingested directory (BYOD) for rules and content. Requires BYOD consent. Searches PDFs, text files, and markdown files that have been indexed.",
        inputSchema: {
          type: "object",
          properties: {
            search_term: {
              type: "string",
              description: "Search term to look up in your local BYOD index",
            },
          },
          required: ["search_term"],
        },
      },
      {
        name: "parse_character",
        description:
          "Parse a character sheet file and return structured data including UPP, characteristics, skills, name, and career.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Path to a character sheet file (text or JSON)",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "roll_custom",
        description:
          "Roll any dice notation (e.g., 3d6, 1d20, 4d6+2) and return individual dice results and total.",
        inputSchema: {
          type: "object",
          properties: {
            notation: {
              type: "string",
              description: 'Dice notation, e.g. "2d6", "3d6+2", "1d20-1", "4d6"',
            },
          },
          required: ["notation"],
        },
      },
      {
        name: "sync_byod",
        description:
          "Index files from your BYOD directory. Runs in time-budgeted batches (BYOD_SYNC_TIMEOUT_MS, default 15s). Returns progress with a 'complete' flag — if false, you MUST call this tool again to continue. Already-indexed files (unchanged since last sync) are skipped automatically.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "sync_file",
        description:
          "Index a single file from your BYOD directory by its relative path. Use this for large files that time out in bulk syncs, or to selectively sync specific files without running a full sync.",
        inputSchema: {
          type: "object",
          properties: {
            relative_path: {
              type: "string",
              description: "Relative path of the file within your BYOD_PATH directory",
            },
          },
          required: ["relative_path"],
        },
      },
      {
        name: "clear_byod",
        description:
          "Delete the BYOD search index database. Use this to start fresh — all indexed files are forgotten. The database is recreated on the next sync_byod call. Does not affect your source files.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_byod_files",
        description:
          "List all files currently in the BYOD database with their status (indexed or failed), chunk count, size, and ingestion date. Use this to understand what content is indexed and available for search.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "inspect_byod_file",
        description:
          "Show detailed information about a specific file in the BYOD database, including all its chunks with titles and sizes. Use the relativePath from list_byod_files as input.",
        inputSchema: {
          type: "object",
          properties: {
            relative_path: {
              type: "string",
              description: "The relative path of the file as shown in list_byod_files",
            },
          },
          required: ["relative_path"],
        },
      },
    ];

    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "roll_2d6": {
        const modifier = typeof args?.modifier === "number" ? args.modifier : 0;
        const target =
          typeof args?.target_number === "number" ? args.target_number : null;
        const result = roll2d6(modifier, target);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "roll_custom": {
        const notation =
          typeof args?.notation === "string" ? args.notation : "2d6";
        try {
          const result = rollCustom(notation);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return {
            content: [
              {
                type: "text",
                text: `Error: ${message}`,
              },
            ],
            isError: true,
          };
        }
      }

      case "roll_table": {
        const tableName =
          typeof args?.table_name === "string" ? args.table_name : "";
        const diceType =
          typeof args?.dice_type === "string"
            ? normalizeDiceType(args.dice_type)
            : "2d6";

        const { dbPath } = ensureOglDb();
        const db = getDatabase(dbPath);

        const table = searchOglTables(db, tableName);

        if (table && table.entries.length > 0) {
          const result = rollOnTable({
            name: table.name,
            description: table.description || undefined,
            diceType: table.diceType as "1d6" | "2d6" | "d66" | "1d3" | "2d3",
            entries: table.entries,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        const result = rollOnTable({
          name: tableName,
          diceType,
          entries: [],
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ...result,
                  warning: `Table "${tableName}" not found in OGL database. Rolled raw ${diceType}: ${result.rollValue}`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "query_ogl_rules": {
        const searchTerm =
          typeof args?.search_term === "string" ? args.search_term : "";
        const category =
          typeof args?.category === "string" ? args.category : "";

        const { dbPath } = ensureOglDb();
        const db = getDatabase(dbPath);

        const response: Record<string, unknown> = {};

        switch (category.toLowerCase()) {
          case "skills":
            response.skills = searchOglSkills(db, searchTerm);
            break;
          case "careers":
            response.careers = searchOglCareers(db, searchTerm);
            break;
          case "equipment":
            response.equipment = searchOglEquipment(db, searchTerm);
            break;
          case "tables": {
            const table = searchOglTables(db, searchTerm);
            response.tables = table
              ? [{ name: table.name, entries: table.entries }]
              : [];
            break;
          }
          case "categories":
            response.categories = listOglCategories(db);
            break;
          case "combat":
            response.combat = searchCombat(db, searchTerm);
            break;
          case "starships":
          case "ship_ops":
            response.starships = searchShipOps(db, searchTerm);
            break;
          case "worlds":
          case "world_building":
            response.worlds = searchWorldBuilding(db, searchTerm);
            break;
          case "list_tables":
            response.tables_list = listOglTables(db);
            break;
          default:
            response.rules = searchOglRules(db, searchTerm);
            response.skills = searchOglSkills(db, searchTerm);
            response.careers = searchOglCareers(db, searchTerm);
            response.equipment = searchOglEquipment(db, searchTerm);
            response.combat = searchCombat(db, searchTerm);
            response.starships = searchShipOps(db, searchTerm);
            response.worlds = searchWorldBuilding(db, searchTerm);
            break;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        };
      }

      case "query_local_byod": {
        const searchTerm =
          typeof args?.search_term === "string" ? args.search_term : "";

        const consent = checkByodConsent();
        if (!consent.allowed) {
          return {
            content: [{ type: "text", text: consent.message }],
            isError: true,
          };
        }

        const db = getByodDatabase();
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

      case "parse_character": {
        const filePath =
          typeof args?.file_path === "string" ? args.file_path : "";

        if (!filePath) {
          return {
            content: [
              {
                type: "text",
                text: "Error: file_path is required",
              },
            ],
            isError: true,
          };
        }

        const resolvedPath = resolveSafePath(filePath);

        if (!resolvedPath) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Access denied. File must be within the project directory or your configured BYOD path.",
              },
            ],
            isError: true,
          };
        }

        if (!existsSync(resolvedPath)) {
          return {
            content: [
              {
                type: "text",
                text: `Error: File not found: ${resolvedPath}`,
              },
            ],
            isError: true,
          };
        }

        try {
          const content = readFileSync(resolvedPath, "utf-8");
          const stats = readCharacterFile(content, filePath);
          return {
            content: [
              { type: "text", text: JSON.stringify(stats, null, 2) },
            ],
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "File read error";
          return {
            content: [
              {
                type: "text",
                text: `Error reading character file: ${message}`,
              },
            ],
            isError: true,
          };
        }
      }

      case "sync_byod": {
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

      case "sync_file": {
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

      case "clear_byod": {
        const consent = checkByodConsent();
        if (!consent.allowed) {
          return {
            content: [{ type: "text", text: consent.message }],
            isError: true,
          };
        }

        const result = clearByodDatabase();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "list_byod_files": {
        const consent = checkByodConsent();
        if (!consent.allowed) {
          return {
            content: [{ type: "text", text: consent.message }],
            isError: true,
          };
        }

        const db = getByodDatabase();
        const files = listByodFiles(db);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total: files.length,
                  indexed: files.filter((f) => f.status === "indexed").length,
                  failed: files.filter((f) => f.status === "failed").length,
                  files,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "inspect_byod_file": {
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

        const db = getByodDatabase();
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

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  const transport = new StdioServerTransport();

  ensureOglDb();

  const config = loadConfig();
  const consent = checkByodConsent();
  if (consent.allowed) {
    setImmediate(() => {
      syncByodIndex(config)
        .then((result) => {
          process.stderr.write(`2d6mcp: ${result.message}\n`);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          process.stderr.write(`2d6mcp: BYOD sync failed: ${msg}\n`);
        });
    });
  }

  await server.connect(transport);
}
