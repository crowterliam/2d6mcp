// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getToolDefinitions } from "./definitions.js";
import { handleRoll, handleRollTable } from "./handlers/dice.js";
import { handleQueryRules } from "./handlers/rules.js";
import {
  handleQueryLocalByod,
  handleSyncByod,
  handleClearByod,
  handleListByodFiles,
  handleGetByodChunk,
} from "./handlers/byod.js";
import { handleParseCharacter } from "./handlers/character.js";
import {
  handleDiscordPost,
  handleDiscordWebhook,
} from "./handlers/discord.js";
import {
  handleSession,
  handleLogTranscript,
  handleGetSessionContext,
  handleSearchTranscript,
} from "./handlers/session.js";
import {
  handleSynthesizeRuling,
  handleTranscribeAudio,
} from "./handlers/rulings.js";

export { getToolDefinitions };

export async function dispatchToolCall(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  switch (name) {
    case "roll":
      return handleRoll(args);
    case "roll_table":
      return handleRollTable(args);
    case "query_rules":
      return handleQueryRules(args);
    case "query_local_byod":
      return handleQueryLocalByod(args);
    case "sync_byod":
      return handleSyncByod(args);
    case "clear_byod":
      return handleClearByod(args);
    case "list_byod_files":
      return handleListByodFiles(args);
    case "get_byod_chunk":
      return handleGetByodChunk(args);
    case "parse_character":
      return handleParseCharacter(args);
    case "discord_post":
      return handleDiscordPost(args);
    case "discord_webhook":
      return handleDiscordWebhook(args);
    case "session":
      return handleSession(args);
    case "log_transcript":
      return handleLogTranscript(args);
    case "get_session_context":
      return handleGetSessionContext(args);
    case "search_transcript":
      return handleSearchTranscript(args);
    case "synthesize_ruling":
      return handleSynthesizeRuling(args);
    case "transcribe_audio":
      return handleTranscribeAudio(args);
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}
