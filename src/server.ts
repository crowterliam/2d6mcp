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
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
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
import { ingestDirectory, type IngestedChunk } from "./byod/ingest.js";
import { getByodDatabase, indexChunks, rebuildByodFts, searchByodIndex, closeByodDatabase } from "./byod/search.js";
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

async function syncByodIndex(config: Config): Promise<{ message: string }> {
  const consent = checkByodConsent();
  if (!consent.allowed) return { message: consent.message };

  const byodPath = getByodPath();
  const { files, chunks } = await ingestDirectory(byodPath, {
    chunkSize: config.byodChunkSize,
    overlap: config.byodChunkOverlap,
  });
  const db = getByodDatabase();

  for (const file of files) {
    const fileChunks = chunks.filter((c) => c.filePath === file.relativePath);
    indexChunks(
      db,
      file.relativePath,
      file.name,
      file.ext,
      file.size,
      file.hash,
      fileChunks.map((c) => ({ title: c.title, content: c.content, chunkIndex: c.chunkIndex }))
    );
  }

  rebuildByodFts(db);

  return {
    message: `Indexed ${files.length} files (${chunks.length} chunks) from BYOD directory.`,
  };
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
          "Re-index all files in the BYOD directory. Use after adding or modifying files in your BYOD path.",
        inputSchema: {
          type: "object",
          properties: {},
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
