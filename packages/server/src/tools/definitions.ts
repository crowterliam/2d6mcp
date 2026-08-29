// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { type Tool } from "@modelcontextprotocol/sdk/types.js";

const BYOD_TOOL_NAMES = new Set([
  "query_local_byod",
  "sync_byod",
  "clear_byod",
  "list_byod_files",
  "get_byod_chunk",
]);

export interface ToolDefinitionOptions {
  byodConsented?: boolean;
}

const DISCORD_POST_SCHEMA: Tool["inputSchema"] = {
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
};

export function getToolDefinitions(options: ToolDefinitionOptions = {}): Tool[] {
  const tools: Tool[] = [
    {
      name: "roll",
      description:
        "Roll dice. Pass notation (e.g. 2d6+1, 1d20, 3d6, 2d6+3 fire). Optional mechanic: 2d6, d20, percentile, damage, or raw. When mechanic is omitted it is inferred from notation.",
      inputSchema: {
        type: "object",
        properties: {
          notation: {
            type: "string",
            description: 'Dice notation, e.g. "2d6+1", "1d20", "d100", "2d6+3 fire"',
          },
          mechanic: {
            type: "string",
            enum: ["2d6", "d20", "percentile", "damage", "raw"],
            description: "Resolution mechanic. Inferred from notation when omitted.",
          },
          modifier: {
            type: "integer",
            description: "Modifier added to 2d6 or d20 rolls (default 0)",
            default: 0,
          },
          target: {
            type: "integer",
            description: "Target number (2d6/d20) or roll-under percentile. If provided, calculates success.",
          },
          advantage: {
            type: "boolean",
            description: "d20 only: roll twice, take the higher. Default false.",
            default: false,
          },
          disadvantage: {
            type: "boolean",
            description: "d20 only: roll twice, take the lower. Cancels with advantage. Default false.",
            default: false,
          },
        },
      },
    },
    {
      name: "roll_table",
      description:
        "Roll on a named table from the OGL database or from indexed personal files. With source=byod and no table_name, lists discovered tables.",
      inputSchema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            enum: ["ogl", "byod"],
            description: "Where to look up the table. Default: ogl.",
            default: "ogl",
          },
          table_name: {
            type: "string",
            description: "Name of the table. Optional when source=byod to list tables instead of rolling.",
          },
          dice_type: {
            type: "string",
            enum: ["1d6", "2d6", "d66", "1d3", "2d3", "d4", "d8", "d10", "d12", "d20", "d100"],
            description: "Dice type when the table is not in the database (default: 2d6)",
            default: "2d6",
          },
        },
      },
    },
    {
      name: "query_rules",
      description:
        "Search a licensed rules database. system is required. Default category is core full-text search only. category=categories lists filters. search_term is optional for list/categories.",
      inputSchema: {
        type: "object",
        properties: {
          system: {
            type: "string",
            enum: ["ogl", "dw", "brp", "5ecompatible", "orcus"],
            description: "Rules database to search",
          },
          search_term: {
            type: "string",
            description: "Search term. Optional when category is categories or a list_* filter.",
          },
          category: {
            type: "string",
            description:
              "Optional filter. Default: core FTS (rules). Use categories to list filters for the chosen system.",
          },
        },
        required: ["system"],
      },
    },
    {
      name: "query_local_byod",
      description:
        "Search your locally ingested files. Requires BYOD consent. Results include chunkIndex for get_byod_chunk. Set include_full to attach full chunk text.",
      inputSchema: {
        type: "object",
        properties: {
          search_term: {
            type: "string",
            description: "Search term to look up in your local index",
          },
          include_full: {
            type: "boolean",
            description: "If true, include full chunk content for each hit (default false)",
            default: false,
          },
        },
        required: ["search_term"],
      },
    },
    {
      name: "sync_byod",
      description:
        "Index files from your BYOD directory. Optional relative_path indexes a single file. Runs in time-budgeted batches; if complete is false, call again.",
      inputSchema: {
        type: "object",
        properties: {
          relative_path: {
            type: "string",
            description: "If set, index only this file (relative to BYOD_PATH) instead of a bulk sync",
          },
        },
      },
    },
    {
      name: "clear_byod",
      description:
        "Delete the BYOD search index. Source files are not affected. The index is recreated on the next sync_byod call.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "list_byod_files",
      description:
        "List indexed files with status and chunk counts. Pass relative_path to inspect chunk structure for one file.",
      inputSchema: {
        type: "object",
        properties: {
          relative_path: {
            type: "string",
            description: "If set, inspect this file's chunks instead of listing all files",
          },
        },
      },
    },
    {
      name: "get_byod_chunk",
      description:
        "Retrieve the full content of a BYOD chunk by file path and chunk index from query_local_byod.",
      inputSchema: {
        type: "object",
        properties: {
          relative_path: {
            type: "string",
            description: "Relative path of the file as shown in search results or list_byod_files",
          },
          chunk_index: {
            type: "integer",
            description: "The chunk index (0-based) to retrieve",
          },
        },
        required: ["relative_path", "chunk_index"],
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
      name: "discord_post",
      description:
        "Post a message to one or more Discord webhooks. Supports rich embeds. Uses smart routing from context tags, or explicit webhook_names.",
      inputSchema: DISCORD_POST_SCHEMA,
    },
    {
      name: "discord_webhook",
      description:
        "Manage Discord webhooks stored in .mcp-discord-webhooks.json. action: add, remove, list, or test.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["add", "remove", "list", "test"],
            description: "Webhook action",
          },
          name: {
            type: "string",
            description: "Webhook name (required for add, remove, test)",
          },
          url: {
            type: "string",
            description: "Discord webhook URL (required for add)",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags for smart routing (add)",
          },
          description: {
            type: "string",
            description: "Human-readable description (add)",
          },
        },
        required: ["action"],
      },
    },
    {
      name: "session",
      description:
        "Manage game sessions. action: start, end, list, delete, or summarize.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["start", "end", "list", "delete", "summarize"],
            description: "Session action",
          },
          session_id: {
            type: "string",
            description: "Session ID (required for end, delete, summarize)",
          },
          name: {
            type: "string",
            description: "Optional session name (start)",
          },
          rules_system: {
            type: "string",
            enum: ["ogl", "dw", "brp", "5ecompatible", "orcus"],
            description: "Rules system for this session. Default: ogl.",
            default: "ogl",
          },
          byod_system: {
            type: "string",
            description: "Optional: narrow BYOD search to files matching this system name",
          },
          limit: {
            type: "integer",
            description: "Max sessions to return for list (default 20)",
            default: 20,
          },
        },
        required: ["action"],
      },
    },
    {
      name: "log_transcript",
      description: "Log a transcript segment to a session — what was just said at the table.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "The session ID from session start",
          },
          text: {
            type: "string",
            description: "The transcribed text or GM note",
          },
          speaker: {
            type: "string",
            description: "Who said it (optional, e.g. GM, Player 1)",
          },
          source: {
            type: "string",
            description: "Source of the transcript: manual, voice, discord",
            default: "manual",
          },
          intent: {
            type: "string",
            description: "Classified intent: question, ruling, action, narration, discussion",
          },
        },
        required: ["session_id", "text"],
      },
    },
    {
      name: "get_session_context",
      description: "Get recent transcript segments and rulings from a session — the last N minutes of game context.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "The session ID from session start",
          },
          minutes: {
            type: "integer",
            description: "How many minutes of recent context to return (default 5)",
            default: 5,
          },
          include_rulings: {
            type: "boolean",
            description: "Include recent rulings alongside transcript (default true)",
            default: true,
          },
        },
        required: ["session_id"],
      },
    },
    {
      name: "search_transcript",
      description:
        "Search session transcripts with SQL LIKE (not FTS5). Find what was said about a topic.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "The session ID from session start",
          },
          query: {
            type: "string",
            description: "Search term",
          },
        },
        required: ["session_id", "query"],
      },
    },
    {
      name: "synthesize_ruling",
      description:
        "Synthesize a cited rules ruling with the local LLM. Auto-looks up licensed rules and BYOD (when consent is on). Default rules_system comes from the session when session_id is set. Set from_context to derive the question from recent transcript.",
      inputSchema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The rules question. Optional when from_context is true.",
          },
          rules_system: {
            type: "string",
            enum: ["ogl", "dw", "brp", "5ecompatible", "orcus", "auto"],
            description: "Which rules DB to search. Default: session rules_system when session_id is set, otherwise auto.",
          },
          session_id: {
            type: "string",
            description: "Optional session ID — scopes lookup and includes recent rulings",
          },
          rules_context: {
            type: "string",
            description: "Optional explicit rules text to use instead of auto-lookup",
          },
          from_context: {
            type: "boolean",
            description: "If true, extract a question from recent session transcript and rule on it",
            default: false,
          },
          minutes: {
            type: "integer",
            description: "Minutes of transcript to use when from_context is true (default 2)",
            default: 2,
          },
        },
      },
    },
    {
      name: "transcribe_audio",
      description:
        "Transcribe an audio file with local Whisper. Files longer than 180 seconds are processed in 2-minute chunks. Each call transcribes one chunk; the last chunk sets complete true. action: transcribe (default), list, or clear.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["transcribe", "list", "clear"],
            description: "transcribe a file, list in-progress jobs, or clear progress",
            default: "transcribe",
          },
          file_path: {
            type: "string",
            description: "Path to the audio file (required for transcribe; optional for clear)",
          },
          session_id: {
            type: "string",
            description: "Optional session ID. If provided, each chunk is logged as a voice transcript segment.",
          },
          chunk_size_seconds: {
            type: "integer",
            description: "Size of each chunk in seconds (default 120). Ignored for files under 180 seconds.",
            default: 120,
          },
        },
      },
    },
  ];

  if (options.byodConsented === false) {
    return tools.filter((tool) => !BYOD_TOOL_NAMES.has(tool.name));
  }
  return tools;
}
