// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getToolDefinitions } from "./definitions.js";
import { handleRoll2d6, handleRollCustom, handleRollTable, handleRollD20, handleRollPercentile, handleRollDamage } from "./handlers/dice.js";
import { handleQueryOglRules } from "./handlers/ogl.js";
import { handleQueryDwRules } from "./handlers/dw.js";
import { handleQueryBrpRules } from "./handlers/brp.js";
import { handleQuery5ecompatibleRules } from "./handlers/5ecompatible.js";
import { handleQueryOrcusRules } from "./handlers/orcus.js";
import {
  handleQueryLocalByod,
  handleSyncByod,
  handleSyncFile,
  handleClearByod,
  handleListByodFiles,
  handleInspectByodFile,
  handleGetByodChunk,
} from "./handlers/byod.js";
import { handleParseCharacter } from "./handlers/character.js";
import {
  handleDiscordPost,
  handleDiscordAddWebhook,
  handleDiscordRemoveWebhook,
  handleDiscordListWebhooks,
  handleDiscordTestWebhook,
} from "./handlers/discord.js";
import {
  handleSessionStart,
  handleSessionEnd,
  handleSessionList,
  handleSessionSummarize,
  handleLogTranscript,
  handleGetSessionContext,
  handleSearchTranscript,
  handleListTranscriptions,
  handleClearTranscription,
  handleDeleteSession,
} from "./handlers/session.js";
import {
  handleSynthesizeRuling,
  handleResolveFromContext,
  handleTranscribeAudio,
} from "./handlers/rulings.js";

export { getToolDefinitions };

export async function dispatchToolCall(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  switch (name) {
    case "roll_2d6":
      return handleRoll2d6(args);
    case "roll_d20":
      return handleRollD20(args);
    case "roll_percentile":
      return handleRollPercentile(args);
    case "roll_damage":
      return handleRollDamage(args);
    case "roll_custom":
      return handleRollCustom(args);
    case "roll_table":
      return handleRollTable(args);
    case "query_ogl_rules":
      return handleQueryOglRules(args);
    case "query_dw_rules":
      return handleQueryDwRules(args);
    case "query_brp_rules":
      return handleQueryBrpRules(args);
    case "query_5ecompatible_rules":
      return handleQuery5ecompatibleRules(args);
    case "query_orcus_rules":
      return handleQueryOrcusRules(args);
    case "query_local_byod":
      return handleQueryLocalByod(args);
    case "sync_byod":
      return handleSyncByod(args);
    case "sync_file":
      return handleSyncFile(args);
    case "clear_byod":
      return handleClearByod(args);
    case "list_byod_files":
      return handleListByodFiles(args);
    case "inspect_byod_file":
      return handleInspectByodFile(args);
    case "get_byod_chunk":
      return handleGetByodChunk(args);
    case "parse_character":
      return handleParseCharacter(args);
    case "discord_post":
      return handleDiscordPost(args);
    case "discord_add_webhook":
      return handleDiscordAddWebhook(args);
    case "discord_remove_webhook":
      return handleDiscordRemoveWebhook(args);
    case "discord_list_webhooks":
      return handleDiscordListWebhooks(args);
    case "discord_test_webhook":
      return handleDiscordTestWebhook(args);
    case "session_start":
      return handleSessionStart(args);
    case "session_end":
      return handleSessionEnd(args);
    case "session_list":
      return handleSessionList(args);
    case "session_summarize":
      return handleSessionSummarize(args);
    case "log_transcript":
      return handleLogTranscript(args);
    case "get_session_context":
      return handleGetSessionContext(args);
    case "search_transcript":
      return handleSearchTranscript(args);
    case "synthesize_ruling":
      return handleSynthesizeRuling(args);
    case "resolve_from_context":
      return handleResolveFromContext(args);
    case "transcribe_audio":
      return handleTranscribeAudio(args);
    case "list_transcriptions":
      return handleListTranscriptions(args);
    case "clear_transcription":
      return handleClearTranscription(args);
    case "delete_session":
      return handleDeleteSession(args);
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}
