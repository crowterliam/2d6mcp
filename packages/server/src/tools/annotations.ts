// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { type Tool, type ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const WRITE_LOCAL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};

const NETWORK: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

type CatalogToolName =
  | "roll"
  | "roll_table"
  | "query_rules"
  | "query_local_byod"
  | "sync_byod"
  | "clear_byod"
  | "list_byod_files"
  | "get_byod_chunk"
  | "parse_character"
  | "discord_post"
  | "discord_webhook"
  | "session"
  | "log_transcript"
  | "get_session_context"
  | "search_transcript"
  | "synthesize_ruling"
  | "transcribe_audio";

const CATALOG_TOOL_NAMES = new Set<string>([
  "roll",
  "roll_table",
  "query_rules",
  "query_local_byod",
  "sync_byod",
  "clear_byod",
  "list_byod_files",
  "get_byod_chunk",
  "parse_character",
  "discord_post",
  "discord_webhook",
  "session",
  "log_transcript",
  "get_session_context",
  "search_transcript",
  "synthesize_ruling",
  "transcribe_audio",
]);

function isCatalogToolName(name: string): name is CatalogToolName {
  return CATALOG_TOOL_NAMES.has(name);
}

function annotationsFor(name: CatalogToolName): ToolAnnotations {
  switch (name) {
    case "roll":
    case "roll_table":
    case "query_rules":
    case "list_byod_files":
    case "get_byod_chunk":
    case "parse_character":
    case "get_session_context":
    case "search_transcript":
      return READ_ONLY;
    case "query_local_byod":
    case "sync_byod":
    case "log_transcript":
    case "synthesize_ruling":
    case "transcribe_audio":
      return WRITE_LOCAL;
    case "clear_byod":
    case "session":
      return DESTRUCTIVE;
    case "discord_post":
    case "discord_webhook":
      return NETWORK;
    default: {
      const _never: never = name;
      return _never;
    }
  }
}

export function annotateTool(tool: Tool): Tool {
  if (!isCatalogToolName(tool.name)) {
    return tool;
  }
  return { ...tool, annotations: annotationsFor(tool.name) };
}
