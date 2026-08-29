# 2D6 MCP — Setup Guide

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

This guide covers connecting the 2d6mcp server to common AI coding harnesses. After setup, your AI assistant gains dice rolling, rules lookup, character parsing, Discord webhook posting, and BYOD file search capabilities for 2d6-based tabletop RPGs.

## Prerequisites

```bash
cd /path/to/2d6mcp
npm install
npm run build
```

Verify with:
```bash
node packages/server/dist/cli.js setup     # creates consent token for BYOD mode (optional)
```

The MCP server binary is `packages/server/dist/index.js`. All harnesses launch it via `node`.

---

## MCP Server

### Claude Desktop

**Config file**: macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`. Windows: `%APPDATA%\Claude\claude_desktop_config.json`.

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/absolute/path/to/2d6mcp/packages/server/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

Restart Claude Desktop after editing.

### Claude Code (CLI)

**Config file**: `~/.claude.json` (global) or `.claude.json` in your project (local).

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/absolute/path/to/2d6mcp/packages/server/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

### Kilo Code / Kilo CLI

**Config file**: `kilo.json` in your project root, or `~/.config/kilo/kilo.json` for global.

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["packages/server/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

### Cursor, Windsurf, Cline, Aider

See full setup instructions in [MCP_SETUP.md](MCP_SETUP.md) or [README.md](README.md).

---

## Verifying the Connection

After configuring your harness and restarting, ask your AI assistant:

> "Roll 2d6+2 vs 8 for a standard skill check."

If the server is connected, the assistant will call `roll` and return dice results with an effect margin.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Set to `"true"` to enable BYOD file ingestion and search |
| `BYOD_PATH` | — | Absolute path to a directory of `.pdf`, `.md`, `.txt`, or `.html` RPG files |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per text chunk (500–50000) |
| `BYOD_CHUNK_OVERLAP` | `400` | Overlap between consecutive chunks |
| `BYOD_MAX_FILES` | `2000` | Maximum files processed per sync call |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Time budget per `sync_byod` call in milliseconds |
| `BYOD_CONTENT_CACHE_PATH` | `data/byod/content_cache.db` | Shared content cache database |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | Path to custom OGL SQLite database |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | Path to custom DW SQLite database |
| `BRP_DB_PATH` | `data/brp/basic-roleplaying.db` | Path to custom BRP SQLite database |
| `SR5E_DB_PATH` | `data/5ecompatible/5ecompatible-srd.db` | Path to custom 5E-compatible SQLite database |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model |
| `MLX_LLM_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-4bit` | MLX LLM model |
| `SESSION_DB_PATH` | `~/.2d6mcp/sessions.db` | Session database location |
| `STT_BACKEND` | `mlx` | STT backend: `mlx` or `whispercpp` |
| `LLM_BACKEND` | `mlx` | LLM backend: `mlx` or `llamacpp` |

## Troubleshooting

**"Tool not found" or no response**: The MCP server may not have started. Check:
- The path to `packages/server/dist/index.js` is absolute and correct
- `npm run build` completed without errors
- Your harness was restarted after editing its config file

**"BYOD Mode is disabled"**: Set `AGREE_BYOD_USE=true` in the harness config's `env` block, or run `npm run setup` in the 2d6mcp directory.

**Server starts but sync times out**: This is normal for large reference folders. The `sync_byod` tool returns `complete: false` — tell your assistant to call `sync_byod` again to continue where it left off.
