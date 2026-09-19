// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import { McpError, ErrorCode, type Resource, type ResourceTemplate } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import { getServerVersion } from "./tools/helpers.js";
import { getToolDefinitions } from "./tools/definitions.js";
import { getPromptDefinitions } from "./prompts.js";
import { getActiveSession, sessionStore } from "./session/database.js";

const MIME_JSON = "application/json";
const MIME_MARKDOWN = "text/markdown";

type RulesSystem = "ogl" | "dw" | "brp" | "5ecompatible" | "orcus" | "osr";

const RULES_SYSTEMS: readonly RulesSystem[] = ["ogl", "dw", "brp", "5ecompatible", "orcus", "osr"];

const SAFE_TABLE = /^[A-Za-z0-9_]+$/;

export const RESOURCE_URIS = [
  "2d6mcp://info",
  "2d6mcp://tools",
  "2d6mcp://prompts",
  "2d6mcp://systems",
  "2d6mcp://docs/quickstart",
  "2d6mcp://docs/environment",
  "2d6mcp://license",
  "2d6mcp://session/current",
  "2d6mcp://rules/ogl",
  "2d6mcp://rules/dw",
  "2d6mcp://rules/brp",
  "2d6mcp://rules/5ecompatible",
  "2d6mcp://rules/orcus",
  "2d6mcp://rules/osr",
] as const;

export type ResourceUri = (typeof RESOURCE_URIS)[number];

const RESOURCE_SET = new Set<string>(RESOURCE_URIS);

export function getResourceDefinitions(): Resource[] {
  return [
    {
      uri: "2d6mcp://info",
      name: "Server info",
      title: "2d6mcp server info",
      description: "Name, version, transport, and capability summary",
      mimeType: MIME_JSON,
    },
    {
      uri: "2d6mcp://tools",
      name: "Tool catalog",
      title: "MCP tools",
      description: "Names and descriptions of callable tools",
      mimeType: MIME_JSON,
    },
    {
      uri: "2d6mcp://prompts",
      name: "Prompt catalog",
      title: "MCP prompts",
      description: "Workflow prompts this server exposes",
      mimeType: MIME_JSON,
    },
    {
      uri: "2d6mcp://systems",
      name: "Rules systems",
      title: "Supported rules systems",
      description: "Licensed rules databases and how to query them",
      mimeType: MIME_JSON,
    },
    {
      uri: "2d6mcp://docs/quickstart",
      name: "Quick start",
      title: "Install and connect",
      description: "stdio install options for MCP clients",
      mimeType: MIME_MARKDOWN,
    },
    {
      uri: "2d6mcp://docs/environment",
      name: "Environment variables",
      title: "Environment reference",
      description: "Self-hosted configuration variables (no secrets)",
      mimeType: MIME_MARKDOWN,
    },
    {
      uri: "2d6mcp://license",
      name: "License summary",
      title: "Licenses",
      description: "AGPL source license plus per-directory game-data licenses",
      mimeType: MIME_MARKDOWN,
    },
    {
      uri: "2d6mcp://session/current",
      name: "Current session",
      title: "Active game session",
      description: "The open session, if any",
      mimeType: MIME_JSON,
    },
    ...RULES_SYSTEMS.map((system) => ({
      uri: `2d6mcp://rules/${system}`,
      name: `${system} database`,
      title: `${system} rules index`,
      description: `Table names and row counts for the ${system} SQLite database`,
      mimeType: MIME_JSON,
    })),
  ];
}

export function getResourceTemplates(): ResourceTemplate[] {
  return [
    {
      uriTemplate: "2d6mcp://rules/{system}",
      name: "Rules database index",
      title: "Rules system index",
      description: "Table listing for ogl, dw, brp, 5ecompatible, orcus, or osr",
      mimeType: MIME_JSON,
    },
  ];
}

export function readResource(uri: string): { uri: string; mimeType: string; text: string } {
  if (!RESOURCE_SET.has(uri)) {
    throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
  }
  return { uri, mimeType: mimeTypeFor(uri as ResourceUri), text: renderResource(uri as ResourceUri) };
}

function mimeTypeFor(uri: ResourceUri): string {
  if (uri.startsWith("2d6mcp://docs/") || uri === "2d6mcp://license") {
    return MIME_MARKDOWN;
  }
  return MIME_JSON;
}

function renderResource(uri: ResourceUri): string {
  switch (uri) {
    case "2d6mcp://info":
      return JSON.stringify(
        {
          name: "2d6mcp",
          version: getServerVersion(),
          transport: "stdio",
          capabilities: { tools: true, prompts: true, resources: true },
          homepage: "https://github.com/crowterliam/2d6mcp",
          marketplace: "https://lobehub.com/mcp/crowterliam-2d6mcp",
        },
        null,
        2
      );
    case "2d6mcp://tools":
      return JSON.stringify(
        getToolDefinitions().map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
        null,
        2
      );
    case "2d6mcp://prompts":
      return JSON.stringify(
        getPromptDefinitions().map((prompt) => ({
          name: prompt.name,
          description: prompt.description,
        })),
        null,
        2
      );
    case "2d6mcp://systems":
      return JSON.stringify(
        {
          query_tool: "query_rules",
          systems: [
            { id: "ogl", label: "2d6 sci-fi SRD", license: "OGL v1.0a" },
            { id: "dw", label: "2d6 fantasy SRD", license: "CC-BY-3.0" },
            { id: "brp", label: "Percentile SRD", license: "BRP OGL v1.0" },
            { id: "5ecompatible", label: "d20 fantasy SRD", license: "CC-BY-4.0" },
            { id: "orcus", label: "d20 compatible SRD", license: "OGL v1.0a" },
            { id: "osr", label: "B/X-style procedures (OSR / B/X-compatible)", license: "Original summaries; full books via BYOD" },
            { id: "byod", label: "Personal indexed files (session tag)", license: "Operator files; not a bundled DB" },
          ],
        },
        null,
        2
      );
    case "2d6mcp://docs/quickstart":
      return [
        "# 2d6mcp quick start",
        "",
        "stdio MCP server. Rules databases are created on first use.",
        "",
        "## npx (when published)",
        "",
        "```json",
        '{ "mcpServers": { "2d6mcp": { "command": "npx", "args": ["-y", "crowterliam-2d6mcp"] } } }',
        "```",
        "",
        "## Local clone",
        "",
        "```bash",
        "git clone https://github.com/crowterliam/2d6mcp.git && cd 2d6mcp && npm install && npm run build && npm start",
        "```",
        "",
        "## Docker",
        "",
        "```bash",
        "docker build -t 2d6mcp . && docker run -i --rm 2d6mcp",
        "```",
        "",
      ].join("\n");
    case "2d6mcp://docs/environment":
      return [
        "# Environment variables",
        "",
        "| Variable | Default | Purpose |",
        "|----------|---------|---------|",
        "| AGREE_BYOD_USE | false | Enable personal file ingestion |",
        "| BYOD_PATH | .reference/ | Directory of local source files |",
        "| SPACETIMEDB_URI | http://127.0.0.1:3000 | Local SpacetimeDB HTTP endpoint |",
        "| SPACETIMEDB_DB | 2d6mcp | SpacetimeDB database name |",
        "| SPACETIMEDB_MODE | embedded | embedded kernel or remote SpacetimeDB replica |",
        "| SPACETIMEDB_EMBEDDED_PATH | ~/.2d6mcp/spacetime-kernel.json | Local kernel snapshot (not SQLite) |",
        "| SESSION_DB_PATH | ~/.2d6mcp/sessions.db | Legacy SQLite import source only |",
        "| CHRONICLE_EXPORT_ALLOW_PATHS | — | Extra allowlisted markdown export paths |",
        "| OGL_DB_PATH | data/ogl/cepheus.db | OGL database |",
        "| DW_DB_PATH | data/dw/dungeon-world.db | Fantasy database |",
        "| BRP_DB_PATH | data/brp/basic-roleplaying.db | Percentile database |",
        "| SR5E_DB_PATH | data/5ecompatible/5ecompatible-srd.db | d20 fantasy database |",
        "| ORCUS_DB_PATH | data/orcus/orcus.db | d20 compatible database |",
        "| OSR_DB_PATH | data/osr/osr-procedures.db | OSR / B/X-compatible procedures database |",
        "| STT_BACKEND | mlx | mlx or whispercpp |",
        "| LLM_BACKEND | mlx | mlx, llamacpp, or ollama (win32 falls back to ollama when /api/tags answers) |",
        "| OLLAMA_HOST | http://127.0.0.1:11434 | Ollama daemon URL |",
        "| OLLAMA_MODEL | llama3.2:3b | Ollama model name |",
        "| LIVE_TRANSCRIPT_DB | — | External companion SQLite for ingest_live_transcript |",
        "| LIVE_TRANSCRIPT_ALLOW_PATHS | — | Extra allowlisted companion/NDJSON paths |",
        "",
        "Never put secrets in this resource. Discord webhook URLs live in `.mcp-discord-webhooks.json`.",
        "",
      ].join("\n");
    case "2d6mcp://license":
      return [
        "# Licenses",
        "",
        "- Source code: AGPL-3.0-only (`LICENSE`)",
        "- Multi-license map: `LICENSE.md`",
        "- `data/ogl/`: OGL v1.0a",
        "- `data/dw/`: CC-BY-3.0",
        "- `data/brp/`: BRP OGL v1.0",
        "- `data/5ecompatible/`: CC-BY-4.0",
        "- `data/orcus/`: OGL v1.0a",
        "- `data/osr/`: original 2d6mcp procedure summaries (AGPL); commercial books via BYOD",
        "",
      ].join("\n");
    case "2d6mcp://session/current":
      return readCurrentSession();
    case "2d6mcp://rules/ogl":
    case "2d6mcp://rules/dw":
    case "2d6mcp://rules/brp":
    case "2d6mcp://rules/5ecompatible":
    case "2d6mcp://rules/orcus":
    case "2d6mcp://rules/osr": {
      const system = uri.slice("2d6mcp://rules/".length) as RulesSystem;
      return JSON.stringify(describeRulesDb(system), null, 2);
    }
    default: {
      const _never: never = uri;
      return _never;
    }
  }
}

function readCurrentSession(): string {
  const db = sessionStore();
  const active = getActiveSession(db);
  if (!active) {
    return JSON.stringify({ active: false }, null, 2);
  }
  return JSON.stringify(
    {
      active: true,
      id: active.id,
      name: active.name,
      rules_system: active.rules_system,
      table_label: active.table_label,
      started_at: active.started_at,
    },
    null,
    2
  );
}

function dbPathFor(system: RulesSystem): string {
  const config = loadConfig();
  switch (system) {
    case "ogl":
      return config.oglDbPath;
    case "dw":
      return config.dwDbPath;
    case "brp":
      return config.brpDbPath;
    case "5ecompatible":
      return config.sr5eDbPath;
    case "orcus":
      return config.orcusDbPath;
    case "osr":
      return config.osrDbPath;
    default: {
      const _never: never = system;
      return _never;
    }
  }
}

function describeRulesDb(system: RulesSystem): {
  system: RulesSystem;
  path: string;
  present: boolean;
  tables: Array<{ name: string; rows: number }>;
} {
  const dbPath = dbPathFor(system);
  if (!existsSync(dbPath)) {
    return { system, path: dbPath, present: false, tables: [] };
  }

  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%' AND name NOT LIKE '%_fts_%' ORDER BY name"
      )
      .all() as Array<{ name: string }>;

    const listed: Array<{ name: string; rows: number }> = [];
    for (const table of tables) {
      if (!SAFE_TABLE.test(table.name)) continue;
      const row = db.prepare(`SELECT COUNT(*) AS c FROM "${table.name}"`).get() as { c: number };
      listed.push({ name: table.name, rows: row.c });
    }
    return { system, path: dbPath, present: true, tables: listed };
  } finally {
    db.close();
  }
}
