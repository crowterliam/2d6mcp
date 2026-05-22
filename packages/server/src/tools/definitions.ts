// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { type Tool } from "@modelcontextprotocol/sdk/types.js";

export function getToolDefinitions(): Tool[] {
  return [
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
      name: "get_byod_chunk",
      description:
        "Retrieve the full content of a specific chunk from the BYOD index by file path and chunk index. Use after query_local_byod to get complete text for relevant chunks. Returns the full chunk content (up to 8KB) rather than the search snippet.",
      inputSchema: {
        type: "object",
        properties: {
          relative_path: {
            type: "string",
            description: "The relative path of the file as shown in search results or list_byod_files",
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
      name: "query_brp_rules",
      description:
        "Search the Basic Roleplaying (BRP) rules database for characteristics, skills, professions, weapons, armor, spot rules, and sample foes. BRP data is Open Game Content under the BRP Open Game License v1.0.",
      inputSchema: {
        type: "object",
        properties: {
          search_term: {
            type: "string",
            description: "Search term (e.g., 'combat', 'sword', 'soldier', 'stealth', 'resistance table', 'poison')",
          },
          category: {
            type: "string",
            description: "Optional category filter: 'rules', 'characteristics', 'skills', 'professions', 'weapons', 'melee_weapons', 'missile_weapons', 'armor', 'shields', 'spot_rules', 'foes', 'categories', 'list_skills', 'list_professions', 'list_weapons'",
          },
        },
        required: ["search_term"],
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
    {
      name: "session_start",
      description:
        "Start a new game session for transcript logging, rulings tracking, and context. Returns a session ID to use with other session tools.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Optional session name (e.g., 'Session 12 - The Dungeon of Doom')",
          },
          rules_system: {
            type: "string",
            enum: ["ogl", "dw", "brp"],
            description: "Rules system for this session. 'ogl' = sci-fi 2d6 RPG (Cepheus Engine), 'dw' = fantasy 2d6 RPG (Dungeon World), 'brp' = Basic Roleplaying (d100 percentile system). Default: ogl.",
            default: "ogl",
          },
          byod_system: {
            type: "string",
            description: "Optional: narrow BYOD search to files matching this system name (e.g., 'call of cthulhu', 'traveller'). Recommended when using BYOD content.",
          },
        },
      },
    },
    {
      name: "session_end",
      description:
        "End the active game session. Optionally set a summary and trigger summary generation.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "The session ID from session_start",
          },
        },
        required: ["session_id"],
      },
    },
    {
      name: "session_list",
      description:
        "List all recorded game sessions, most recent first.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Max sessions to return (default 20)",
            default: 20,
          },
        },
      },
    },
    {
      name: "session_summarize",
      description:
        "Generate an AI summary for a session using the full transcript. Requires MLX LLM (mlx_lm.generate) to be installed.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "The session ID from session_start",
          },
        },
        required: ["session_id"],
      },
    },
    {
      name: "log_transcript",
      description:
        "Log a transcript segment to the current session — what was just said at the table.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "The session ID from session_start",
          },
          text: {
            type: "string",
            description: "The transcribed text or GM note",
          },
          speaker: {
            type: "string",
            description: "Who said it (optional, e.g., 'GM', 'Player 1')",
          },
          source: {
            type: "string",
            description: "Source of the transcript: 'manual', 'voice', 'discord', 'push-to-ask'",
            default: "manual",
          },
          intent: {
            type: "string",
            description: "Classified intent: 'question', 'ruling', 'action', 'narration', 'discussion'",
          },
        },
        required: ["session_id", "text"],
      },
    },
    {
      name: "get_session_context",
      description:
        "Get recent transcript segments and rulings from a session — the last N minutes of game context.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "The session ID from session_start",
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
        "Full-text search across session transcripts — find what was said about a topic.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "The session ID from session_start",
          },
          query: {
            type: "string",
            description: "Search term (e.g., 'goblin', 'merchant', 'trap')",
          },
        },
        required: ["session_id", "query"],
      },
    },
    {
      name: "synthesize_ruling",
      description:
        "Synthesize a rules ruling using local MLX LLM. Takes a question, auto-looks up relevant rules from OGL/DW/BRP/BYOD, and returns a cited ruling. Requires mlx_lm.generate to be installed.",
      inputSchema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The rules question to answer (e.g., 'Can I grapple while prone?')",
          },
          rules_system: {
            type: "string",
            enum: ["ogl", "dw", "brp", "auto"],
            description: "Which rules DB to search. 'auto' searches all. Default: 'auto'.",
            default: "auto",
          },
          session_id: {
            type: "string",
            description: "Optional session ID — includes recent rulings for context continuity",
          },
          rules_context: {
            type: "string",
            description: "Optional explicit rules text to use instead of auto-lookup",
          },
        },
        required: ["question"],
      },
    },
    {
      name: "resolve_from_context",
      description:
        "Full producer pipeline: take recent session transcript, synthesize a ruling based on what was discussed, log the ruling. Use this when the GM wants a ruling on whatever the players were just talking about.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "The session ID from session_start",
          },
          context_minutes: {
            type: "integer",
            description: "How many minutes of transcript to use as context (default 2)",
            default: 2,
          },
        },
        required: ["session_id"],
      },
    },
    {
      name: "transcribe_audio",
      description:
        "Transcribe an audio file using local MLX Whisper. For files longer than 5 minutes, the tool processes audio in 2-minute chunks. Each call transcribes one chunk and returns incremental results. Call again with the same file_path and session_id to continue until 'complete' is true. Requires mlx_whisper and ffmpeg to be installed.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Path to the audio file (WAV, MP3, M4A, FLAC, etc.)",
          },
          session_id: {
            type: "string",
            description: "Optional session ID. If provided, each transcribed chunk is auto-logged as a transcript segment with source='voice'.",
          },
          chunk_size_seconds: {
            type: "integer",
            description: "Size of each chunk in seconds (default: 120). Ignored for files under 5 minutes.",
            default: 120,
          },
        },
        required: ["file_path"],
      },
    },
    {
      name: "list_transcriptions",
      description: "List all in-progress audio transcriptions with their chunk progress. Shows which files are being transcribed, how many chunks remain, and session association.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "clear_transcription",
      description: "Reset transcription progress for a specific file, or clear all transcription state. Use this if a transcription gets stuck or you want to restart fresh.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Optional: path to the audio file to reset. If omitted, clears ALL transcription progress." },
        },
      },
    },
    {
      name: "delete_session",
      description: "Permanently delete a session and all its transcript segments and rulings. Use this to clean up old or test sessions. Irreversible.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "The session ID to delete" },
        },
        required: ["session_id"],
      },
    },
  ];
}
