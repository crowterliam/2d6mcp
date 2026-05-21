# 2D6 MCP Server — Agent Instructions

## Project Identity

This is a Model Context Protocol (MCP) server that acts as a mechanical engine, dice roller, and rules reference for 2d6-based tabletop RPGs. The server is system-agnostic and avoids all third-party trademarks. It includes an OGL rules database (Cepheus Engine SRD) for sci-fi games and a Dungeon World rules database (CC-BY-3.0) with moves, classes, spells, equipment, monsters, and GM tools for fantasy games.

## Agent Modes

Specialised agent instructions are available for multiple AI coding harnesses:

### Kilo Code (`.kilo/agent/`)

| Agent File | Domain |
|-----------|--------|
| `.kilo/agent/2d6mcp.md` | Master reference — all tools, workflows, environment vars |
| `.kilo/agent/2d6mcp-task-resolution.md` | Dice rolling, effect margins, difficulty, boon/bane |
| `.kilo/agent/2d6mcp-rules-reference.md` | Rules lookup, table rolling, OGL + BYOD search |
| `.kilo/agent/2d6mcp-character-creation.md` | UPP, characteristics, career paths, skills |
| `.kilo/agent/2d6mcp-byod.md` | BYOD sync, listing, inspection, troubleshooting |

Slash commands are in `.kilo/command/`:

| Command | Purpose |
|---------|---------|
| `.kilo/command/roll.md` | Quick dice rolling |
| `.kilo/command/rules-lookup.md` | Quick rules lookup |
| `.kilo/command/byod-index.md` | BYOD index management |

### Claude Code (`.claude/skills/`)

| Skill | Domain |
|-------|--------|
| `.claude/skills/2d6mcp/SKILL.md` | Master reference — all tools, workflows, environment vars |
| `.claude/skills/2d6mcp-task-resolution/SKILL.md` | Dice rolling, effect margins, difficulty, boon/bane |
| `.claude/skills/2d6mcp-rules-reference/SKILL.md` | Rules lookup, table rolling, OGL + BYOD search |
| `.claude/skills/2d6mcp-character-creation/SKILL.md` | UPP, characteristics, career paths, skills |
| `.claude/skills/2d6mcp-byod/SKILL.md` | BYOD sync, listing, inspection, troubleshooting |

### Cursor (`.cursor/rules/`)

| Rule File | Domain |
|-----------|--------|
| `.cursor/rules/2d6mcp.md` | Comprehensive reference — all tools, mechanics, workflows |

### Windsurf

| Rule File | Domain |
|-----------|--------|
| `.windsurfrules` | Comprehensive reference — all tools, mechanics, workflows |

### Cline (`.cline/rules/`)

| Rule File | Domain |
|-----------|--------|
| `.cline/rules/2d6mcp.md` | Comprehensive reference — all tools, mechanics, workflows |

### Aider

| File | Domain |
|------|--------|
| `AIDER.md` | Project conventions, MCP tools, environment reference |

## Build & Test Commands

```bash
npm install          # install dependencies
npm run build        # compile TypeScript to dist/
npm run start        # run the MCP server (stdio transport)
npm test             # run the test suite (vitest)
npm run test:watch   # run tests in watch mode
npm run test:coverage # run tests with coverage report
npm run setup        # run first-time setup (consent token)
npm run populate-ogl # regenerate the OGL SQLite database
npm run populate-dw  # regenerate the Dungeon World SQLite database
```

## Architecture

```
src/
  index.ts          # MCP server entry point (stdio transport)
  server.ts         # Server class, tool registration
  config.ts         # Environment config + BYOD gate
  cli.ts            # CLI entry for setup/populate commands
  dice/
    roller.ts       # Dice notation parser, 2d6 resolution
    tables.ts       # d66 / 2d6 table rolling
  ogl/
    database.ts     # SQLite connection + FTS5 setup
    schema.sql.ts   # Schema DDL strings
    populate.ts     # Populate DB with Cepheus Engine SRD data
    queries.ts      # Rule search queries
  dw/
    database.ts     # DW SQLite connection + schema setup
    schema.sql.ts   # DW Schema DDL
    populate.ts     # Populate DB with Dungeon World data (CC-BY-3.0)
    queries.ts      # DW rule search queries
  byod/
    gate.ts         # Consent gate check
    ingest.ts       # File walking, PDF/text/md parsing
    search.ts       # FTS5 search against BYOD index
    content-cache.ts # Content-addressable chunk cache (shared across workspaces)
  character/
    parser.ts       # UPP extraction, stat parsing
  discord/
    config.ts       # Webhook storage, smart routing, tag matching
    webhook.ts      # HTTP posting, embed validation, colour helpers
  audio/
    mlx-transcribe.ts  # MLX Whisper + whisper.cpp backend dispatch
    backends/
      whispercpp.ts    # whisper.cpp STT backend (Win/Linux)
    chunker.ts         # ffmpeg chunking, repetition cleanup
    speakers.ts        # silence-gap speaker diarization
  rulings/
    mlx-synthesize.ts  # MLX LM + llama.cpp backend dispatch, quality filter
    backends/
      llamacpp.ts      # llama.cpp LLM backend (Win/Linux)
  session/
    database.ts        # Session SQLite (transcripts, rulings, progress)
    schema.sql.ts      # DDL for sessions, segments, rulings, transcription_progress
  tools/               # Componentised tool handlers
    helpers.ts         # Shared helpers, keyword extraction, fuzzy matching
    definitions.ts     # All tool JSON schemas
    index.ts           # Handler dispatch table
data/
  ogl/
    cepheus.db      # Bundled OGL SQLite database (Cepheus Engine SRD)
  dw/
    dungeon-world.db  # Bundled DW SQLite database (Dungeon World, CC-BY-3.0)
tests/                # Vitest test suite
  config/             # Config module tests
  dice/               # Dice roller and table tests
  ogl/                # OGL database and query tests
  dw/                 # DW database and query tests
  byod/               # BYOD gate, ingest, search, cache tests
  character/          # Character parser tests
  discord/            # Discord config and webhook tests
.kilo/
  agent/            # Agent mode instructions
  command/          # Slash command definitions
.claude/
  skills/           # Claude Code skill definitions (SKILL.md)
.cursor/
  rules/            # Cursor rule definitions
.cline/
  rules/            # Cline rule definitions
.windsurfrules      # Windsurf rules file
AIDER.md            # Aider conventions and MCP tool reference
MCP_SETUP.md         # User guide for connecting to AI harnesses
```

## Available Tools

| Tool | Purpose |
|------|---------|
| `roll_2d6` | Roll 2d6 with modifier, compare against target |
| `roll_custom` | Roll any dice notation (`3d6`, `d66`, `4d6+2`) |
| `roll_table` | Roll on a named table from OGL database |
| `query_ogl_rules` | Search OGL rules for skills, careers, equipment, tables |
| `query_dw_rules` | Search DW rules for moves, classes, spells, equipment, monsters, GM tools |
| `query_local_byod` | Full-text search across personal ingested files |
| `parse_character` | Parse character sheet into structured data |
| `sync_byod` | Index/re-index files from BYOD directory |
| `clear_byod` | Delete BYOD index to start fresh |
| `list_byod_files` | List indexed files with status and chunk counts |
| `inspect_byod_file` | Show chunk structure for a specific file |
| `sync_file` | Index a single file by relative path (for large files that timeout in bulk sync) |
| `get_byod_chunk` | Retrieve full chunk content by file path + chunk index (for getting complete text after search snippets) |
| `discord_post` | Post messages to Discord webhooks with smart routing based on context tags |
| `discord_add_webhook` | Add a Discord webhook with name, URL, tags, and description |
| `discord_remove_webhook` | Remove a stored Discord webhook by name |
| `discord_list_webhooks` | List all configured webhooks (URLs partially masked) |
| `discord_test_webhook` | Send a test message to verify webhook connectivity |
| `synthesize_ruling` | Synthesize a rules ruling using local MLX LLM. Auto-looks up OGL/DW/BYOD rules, returns a cited ruling. Requires `mlx_lm.generate`. |
| `resolve_from_context` | Full producer pipeline: take recent session transcript, detect rules question, look up rules, synthesize ruling, log it. |
| `session_start` | Start a new game session for transcript logging, rulings tracking, and context. Returns a session ID. |
| `session_end` | End the active game session. |
| `session_list` | List all recorded game sessions, most recent first. |
| `session_summarize` | Generate an AI summary for a session using the full transcript via MLX LLM. |
| `log_transcript` | Log a transcript segment to the current session — what was just said at the table. |
| `get_session_context` | Get recent transcript segments and rulings from a session — the last N minutes of game context. |
| `search_transcript` | Full-text search across session transcripts — find what was said about a topic. |
| `transcribe_audio` | Transcribe an audio file using local MLX Whisper. Requires `mlx_whisper` to be installed. |
| `list_transcriptions` | List all in-progress audio transcriptions with chunk progress. |
| `clear_transcription` | Reset transcription progress for a specific file, or clear all state. |
| `delete_session` | Permanently delete a session and all its transcript segments and rulings. |

## Session Management & Ruling Synthesis

The server supports full game session logging and AI-assisted rules rulings:

- **Session lifecycle**: Start a session with `session_start`, log transcript segments with `log_transcript` throughout play, then end with `session_end`.
- **BYOD system scoping**: Pass `byod_system` to `session_start` (e.g., `"call of cthulhu"`) to filter all subsequent BYOD searches to files matching that system name. Prevents wrong-system contamination.
- **Context retrieval**: Use `get_session_context` to fetch recent transcript and rulings from the last N minutes — useful for catching up or recalling what just happened.
- **Transcript search**: Use `search_transcript` to find what was said about a specific topic across the entire session.
- **Ruling synthesis**: Use `synthesize_ruling` to ask a rules question and get an AI-generated cited ruling based on OGL/DW/BYOD rules. Requires MLX LM (`mlx_lm.generate`) to be installed locally.
- **Context-based resolution**: Use `resolve_from_context` to run the full pipeline — take recent transcript, detect the rules question, look up rules, synthesize a ruling, and log it to the session.
- **Session summaries**: Use `session_summarize` to generate an AI summary of the full session transcript via MLX LLM.
- **Audio transcription**: Use `transcribe_audio` to convert recorded audio files to text using local MLX Whisper. Files over 3 minutes are processed in 2-minute chunks with progress tracking — call repeatedly with the same `file_path` and `session_id` until `complete: true`. Each chunk is auto-logged to the session.
- **Transcription management**: Use `list_transcriptions` to see in-progress files and `clear_transcription` to reset stuck state.

## Cross-Platform Backends

The audio transcription and ruling synthesis use pluggable backends. On macOS, the default is Apple MLX. On Windows/Linux, swap to whisper.cpp and llama.cpp by setting environment variables:

| Platform | STT Backend | LLM Backend |
|---|---|---|
| macOS (default) | `mlx` (MLX Whisper) | `mlx` (MLX LM) |
| Windows/Linux | `whispercpp` (whisper.cpp) | `llamacpp` (llama.cpp) |

The server detects the backend via `STT_BACKEND` and `LLM_BACKEND` env vars. All tools, session management, and search work identically regardless of backend — only the underlying CLI binary changes.

## Multi-License Architecture

- All `.ts` source files: AGPL-3.0
- All files under `data/ogl/`: OGL v1.0a
- All files under `data/dw/`: CC-BY-3.0
- `LICENSE.md` describes the firewall in detail
- `OGL-1.0a.txt` contains the full OGL text with Cepheus SRD copyright attributions
- `data/dw/CC-BY-3.0.txt` contains the full Creative Commons Attribution 3.0 license text
- `data/dw/ATTRIBUTION` contains Dungeon World derivation and attribution details

## BYOD Consent Gate

The server checks for `AGREE_BYOD_USE="true"` env var OR the presence of a `.mcp-byod-consent-accepted` token file in the project root before enabling BYOD tools. Without consent, BYOD tools return a clear disclaimer message.

## Naming Conventions

Never reference any third-party game system or trademarked terms. Use generic descriptors: "2d6 sci-fi RPG", "2d6 fantasy RPG", "starship", "star system", "characteristic", "move", "front", "monster", etc.

**Tool loyalty**: Once 2d6mcp tools are invoked (particularly BYOD — `query_local_byod`, `get_byod_chunk`, `synthesize_ruling`), continue using them for all game content. Do not switch to external file-reading MCP tools unless the user explicitly asks.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Enable BYOD mode |
| `BYOD_PATH` | `.reference/` (auto-discovered in project root if not set) | Directory of local source files |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per chunk (500–50000) |
| `BYOD_CHUNK_OVERLAP` | `400` | Overlap between chunks |
| `BYOD_MAX_FILES` | `2000` | Max files per sync |
| `BYOD_MAX_CHUNKS_PER_FILE` | `500` | Max chunks per file |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Max ms per sync batch |
| `BYOD_CONTENT_CACHE_PATH` | `data/byod/content_cache.db` | Shared content-addressable cache path |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | Custom OGL database path |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | Custom DW database path |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model for STT |
| `MLX_LLM_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-4bit` | MLX LM model for ruling synthesis |
| `SESSION_DB_PATH` | `~/.2d6mcp/sessions.db` | Session database location |
| `STT_BACKEND` | `mlx` | STT backend: `mlx` (macOS) or `whispercpp` (Win/Linux) |
| `LLM_BACKEND` | `mlx` | LLM backend: `mlx` (macOS) or `llamacpp` (Win/Linux) |
| `WHISPERCPP_MODEL` | `ggml-large-v3-turbo.bin` | whisper.cpp model path (Win/Linux) |
| `LLAMACPP_MODEL` | `Llama-3.2-3B-Instruct.Q4_K_M.gguf` | llama.cpp model path (Win/Linux) |
