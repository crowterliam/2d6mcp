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
import { ensureDwSchema, closeDwDatabase } from "./dw/database.js";
import { populateDwDatabase } from "./dw/populate.js";
import {
  searchDwRules,
  searchDwMoves,
  searchDwClasses,
  searchDwSpells,
  searchDwEquipment,
  searchDwMonsters,
  searchDwGmTools,
  listDwMoveCategories,
  listDwMonsterSettings,
} from "./dw/queries.js";
import { checkByodConsent, getByodPath } from "./byod/gate.js";
import { discoverFiles, ingestFile, type IngestedChunk, type IngestedFile } from "./byod/ingest.js";
import { getByodDatabase, indexChunks, rebuildByodFts, searchByodIndex, closeByodDatabase, getStoredFileHash, markFileFailed, FAILED_HASH, clearByodDatabase, listByodFiles, getFileChunks } from "./byod/search.js";
import { parseCharacterText, readCharacterFile, type CharacterStats } from "./character/parser.js";
import {
  listWebhooks,
  getWebhook,
  addWebhook,
  removeWebhook,
  resolveWebhooks,
  parseRoutingContext,
  type WebhookEntry,
} from "./discord/config.js";
import { sendDiscordMessage, colorFromName, type DiscordMessage, type DiscordEmbed, type PostResult } from "./discord/webhook.js";

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

function ensureDwDb(): { dbPath: string; initialized: boolean } {
  const { dwDbPath } = loadConfig();

  if (!existsSync(dwDbPath)) {
    populateDwDatabase(dwDbPath);
    return { dbPath: dwDbPath, initialized: true };
  }

  return { dbPath: dwDbPath, initialized: false };
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
      {
        name: "query_dw_rules",
        description:
          "Search the Dungeon World rules database for moves, classes, spells, equipment, monsters, or GM tools. DW data is derived from Dungeon World by Sage LaTorra and Adam Koebel (CC-BY-3.0), converted to Markdown by agude. See data/dw/ATTRIBUTION for full attribution.",
        inputSchema: {
          type: "object",
          properties: {
            search_term: {
              type: "string",
              description: "Search term (e.g., 'hack and slash', 'wizard', 'goblin', 'front', 'armor')",
            },
            category: {
              type: "string",
              description: "Optional category filter: 'moves', 'classes', 'spells', 'equipment', 'monsters', 'gm_tools', 'rules'",
            },
          },
          required: ["search_term"],
        },
      },
      {
        name: "discord_post",
        description:
          "Post a message to one or more Discord webhooks. Supports rich embeds with fields, colours, and footers. Uses smart routing: provide context tags (e.g. 'gm', 'combat', 'narrative') to automatically select the best webhook(s), or explicitly name which webhooks to post to.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Plain text message content (max 2000 chars)",
            },
            webhook_names: {
              type: "array",
              items: { type: "string" },
              description: "Explicit webhook names to post to. If provided, overrides smart routing.",
            },
            context: {
              type: "object",
              description: "Context for smart webhook routing. The system matches tags to find the best webhook(s).",
              properties: {
                channel_type: {
                  type: "string",
                  description: "Comma-separated channel types: 'gm', 'player', 'ooc', 'starship'",
                },
                visibility: {
                  type: "string",
                  description: "Comma-separated visibility: 'public', 'private', 'secret'",
                },
                game_context: {
                  type: "string",
                  description: "Comma-separated game contexts: 'combat', 'narrative', 'exploration', 'trade', 'social', 'stealth', 'magic', 'dice'",
                },
                character: {
                  type: "string",
                  description: "Character name(s) involved (comma-separated)",
                },
                location: {
                  type: "string",
                  description: "In-game location(s) (comma-separated)",
                },
              },
            },
            username: {
              type: "string",
              description: "Override the webhook's displayed username for this message",
            },
            avatar_url: {
              type: "string",
              description: "Override the webhook's avatar for this message",
            },
            embeds: {
              type: "array",
              description: "Rich embed objects (max 10). Each embed can have title, description, color, fields, footer.",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Embed title (max 256 chars)" },
                  description: { type: "string", description: "Embed description (max 4096 chars)" },
                  color: {
                    type: "string",
                    description: "Embed colour: name ('red', 'gold', 'teal') or hex ('#ff0000')",
                  },
                  fields: {
                    type: "array",
                    description: "Embed fields (max 25)",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        value: { type: "string" },
                        inline: { type: "boolean" },
                      },
                      required: ["name", "value"],
                    },
                  },
                  footer: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      icon_url: { type: "string" },
                    },
                    required: ["text"],
                  },
                },
              },
            },
            tts: {
              type: "boolean",
              description: "Use text-to-speech for this message (default: false)",
              default: false,
            },
          },
        },
      },
      {
        name: "discord_add_webhook",
        description:
          "Add a Discord webhook to the stored configuration. Webhooks are saved to .mcp-discord-webhooks.json (gitignored). Each webhook needs a unique name, a Discord webhook URL, and optional tags for smart routing.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Unique name for this webhook (e.g., 'gm-tower', 'main-table', 'ooc-channel')",
            },
            url: {
              type: "string",
              description: "Discord webhook URL (https://discord.com/api/webhooks/...)",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for smart routing: 'gm', 'player', 'public', 'private', 'combat', 'narrative', 'ooc', 'dice', 'starship', 'exploration', 'trade', 'social', 'stealth', 'magic'",
            },
            description: {
              type: "string",
              description: "Human-readable description of this webhook's purpose",
            },
          },
          required: ["name", "url"],
        },
      },
      {
        name: "discord_remove_webhook",
        description:
          "Remove a stored Discord webhook by name.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the webhook to remove",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "discord_list_webhooks",
        description:
          "List all configured Discord webhooks with their names, tags, and descriptions. URLs are partially masked for security.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "discord_test_webhook",
        description:
          "Send a test message to a specific Discord webhook to verify connectivity. Posts a simple '2d6mcp connection test' message.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the webhook to test",
            },
          },
          required: ["name"],
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

      case "query_dw_rules": {
        const searchTerm =
          typeof args?.search_term === "string" ? args.search_term : "";
        const category =
          typeof args?.category === "string" ? args.category : "";

        const { dbPath } = ensureDwDb();
        const db = ensureDwSchema(dbPath);

        const response: Record<string, unknown> = {};

        switch (category.toLowerCase()) {
          case "moves":
            response.moves = searchDwMoves(db, searchTerm);
            response.move_categories = listDwMoveCategories(db);
            break;
          case "classes":
            response.classes = searchDwClasses(db, searchTerm);
            break;
          case "spells":
            response.spells = searchDwSpells(db, searchTerm);
            break;
          case "equipment":
            response.equipment = searchDwEquipment(db, searchTerm);
            break;
          case "monsters":
            response.monsters = searchDwMonsters(db, searchTerm);
            response.monster_settings = listDwMonsterSettings(db);
            break;
          case "gm_tools":
          case "gm":
            response.gm_tools = searchDwGmTools(db, searchTerm);
            break;
          case "rules":
            response.rules = searchDwRules(db, searchTerm);
            break;
          default:
            response.moves = searchDwMoves(db, searchTerm);
            response.classes = searchDwClasses(db, searchTerm);
            response.spells = searchDwSpells(db, searchTerm);
            response.equipment = searchDwEquipment(db, searchTerm);
            response.monsters = searchDwMonsters(db, searchTerm);
            response.gm_tools = searchDwGmTools(db, searchTerm);
            break;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        };
      }

      case "discord_post": {
        const content = typeof args?.content === "string" ? args.content : undefined;
        const webhookNames = Array.isArray(args?.webhook_names)
          ? (args.webhook_names as string[])
          : undefined;
        const contextObj =
          args?.context && typeof args.context === "object"
            ? (args.context as Record<string, string>)
            : {};
        const username = typeof args?.username === "string" ? args.username : undefined;
        const avatarUrl = typeof args?.avatar_url === "string" ? args.avatar_url : undefined;
        const tts = args?.tts === true;
        const rawEmbeds = Array.isArray(args?.embeds) ? (args.embeds as Record<string, unknown>[]) : undefined;

        const contextTags = parseRoutingContext(contextObj);
        const { webhooks, routing } = resolveWebhooks(contextTags, webhookNames);

        if (webhooks.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    routing,
                    results: [],
                    error: "No webhooks matched. Use discord_add_webhook to configure webhooks, or provide explicit webhook_names.",
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const embeds: DiscordEmbed[] | undefined = rawEmbeds?.map((e) => {
          const embed: DiscordEmbed = {};
          if (typeof e.title === "string") embed.title = e.title;
          if (typeof e.description === "string") embed.description = e.description;
          if (typeof e.color === "string") embed.color = colorFromName(e.color);
          if (Array.isArray(e.fields)) {
            embed.fields = (e.fields as Record<string, unknown>[]).map((f) => ({
              name: String(f.name ?? ""),
              value: String(f.value ?? ""),
              ...(f.inline === true ? { inline: true } : {}),
            }));
          }
          if (e.footer && typeof e.footer === "object") {
            const footer = e.footer as Record<string, unknown>;
            embed.footer = { text: String(footer.text ?? "") };
          }
          return embed;
        });

        const message: DiscordMessage = {
          ...(content ? { content } : {}),
          ...(username ? { username } : {}),
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          ...(embeds && embeds.length > 0 ? { embeds } : {}),
          ...(tts ? { tts: true } : {}),
        };

        if (!message.content && (!message.embeds || message.embeds.length === 0)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { success: false, error: "Message must have content or at least one embed." },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const results: PostResult[] = await Promise.all(
          webhooks.map((w) => sendDiscordMessage(w.url, w.name, { ...message }))
        );

        const allSuccess = results.every((r) => r.success);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: allSuccess,
                  routing,
                  results,
                  posted_to: results.map((r) => r.webhook_name),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "discord_add_webhook": {
        const name = typeof args?.name === "string" ? args.name : "";
        const url = typeof args?.url === "string" ? args.url : "";
        const tags = Array.isArray(args?.tags) ? (args.tags as string[]) : [];
        const description = typeof args?.description === "string" ? args.description : "";

        if (!name) {
          return {
            content: [{ type: "text", text: "Error: name is required" }],
            isError: true,
          };
        }
        if (!url) {
          return {
            content: [{ type: "text", text: "Error: url is required" }],
            isError: true,
          };
        }
        if (!url.startsWith("https://discord.com/api/webhooks/") && !url.startsWith("https://discordapp.com/api/webhooks/")) {
          return {
            content: [
              {
                type: "text",
                text: 'Error: URL must be a valid Discord webhook URL (https://discord.com/api/webhooks/... or https://discordapp.com/api/webhooks/...)',
              },
            ],
            isError: true,
          };
        }

        const entry: WebhookEntry = { name, url, tags, description };
        const result = addWebhook(entry);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.success,
        };
      }

      case "discord_remove_webhook": {
        const name = typeof args?.name === "string" ? args.name : "";
        if (!name) {
          return {
            content: [{ type: "text", text: "Error: name is required" }],
            isError: true,
          };
        }
        const result = removeWebhook(name);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.success,
        };
      }

      case "discord_list_webhooks": {
        const webhooks = listWebhooks();
        const masked = webhooks.map((w) => ({
          name: w.name,
          url: w.url.replace(/\/[^/]+$/, "/***masked***"),
          tags: w.tags,
          description: w.description,
        }));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { total: masked.length, webhooks: masked },
                null,
                2
              ),
            },
          ],
        };
      }

      case "discord_test_webhook": {
        const name = typeof args?.name === "string" ? args.name : "";
        if (!name) {
          return {
            content: [{ type: "text", text: "Error: name is required" }],
            isError: true,
          };
        }

        const webhook = getWebhook(name);
        if (!webhook) {
          return {
            content: [
              {
                type: "text",
                text: `Webhook "${name}" not found. Use discord_list_webhooks to see available webhooks.`,
              },
            ],
            isError: true,
          };
        }

        const result = await sendDiscordMessage(webhook.url, webhook.name, {
          content: "2d6mcp connection test — webhook is working!",
          embeds: [
            {
              title: "Connection Test",
              description: "If you see this message, your webhook is correctly configured.",
              color: 0x2d6,
              footer: { text: "2d6mcp" },
            },
          ],
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.success,
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  const transport = new StdioServerTransport();

  ensureOglDb();
  ensureDwDb();

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
