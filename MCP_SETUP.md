# 2D6 MCP — Setup Guide

This guide covers connecting the 2d6mcp server to common AI coding harnesses. After setup, your AI assistant gains dice rolling, rules lookup, character parsing, and BYOD file search capabilities for generic 2d6-based sci-fi tabletop RPGs.

## Prerequisites

```bash
cd /path/to/2d6mcp
npm install
npm run build
```

Verify with:
```bash
node dist/cli.js setup     # creates consent token for BYOD mode (optional)
```

The server binary is `dist/index.js`. All harnesses launch it via `node`.

## Claude Desktop

**Config file**: macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`. Windows: `%APPDATA%\Claude\claude_desktop_config.json`.

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/absolute/path/to/2d6mcp/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

Restart Claude Desktop after editing.

**Minimal config (OGL-only, no BYOD)** — omit `env` entirely:
```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/absolute/path/to/2d6mcp/dist/index.js"]
    }
  }
}
```

## Claude Code (CLI)

**Config file**: `~/.claude.json` (global) or `.claude.json` in your project (local).

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/absolute/path/to/2d6mcp/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

The Claude Code project already includes domain-specific skills in `.claude/skills/2d6mcp*/SKILL.md`. Load them with `/skill 2d6-mcp-core` (or the relevant sub-skill).

## Cursor

**Config file**: `.cursor/mcp.json` in your project root.

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/absolute/path/to/2d6mcp/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

Cursor rule files are in `.cursor/rules/2d6mcp.md` — add the project to your Cursor workspace and the rules load automatically.

## Windsurf

**Config file**: `.windsurf/mcp.json` in your project root.

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/absolute/path/to/2d6mcp/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

The Windsurf rules file is `.windsurfrules` in the project root — loads automatically when the workspace is opened.

## Kilo Code / Kilo CLI

**Config file**: `kilo.json` in your project root, or `~/.config/kilo/kilo.json` for global.

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

Agent modes are in `.kilo/agent/`. Slash commands are in `.kilo/command/`. Both load automatically in Kilo sessions within this project.

## Cline (VS Code Extension)

**Config file**: `.clinerules` or `.cline/rules/mcp.json` in your project root, or Cline extension settings.

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/absolute/path/to/2d6mcp/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

Cline rules are in `.cline/rules/2d6mcp.md` — loads automatically.

## Aider

Add to `.aider.conf.yml`:

```yaml
mcp-servers:
  2d6mcp:
    command: node
    args: ["/absolute/path/to/2d6mcp/dist/index.js"]
    env:
      AGREE_BYOD_USE: "true"
      BYOD_PATH: "/absolute/path/to/your/rpg/files"
```

Aider conventions and tool reference are in `AIDER.md`.

## VSCode (Generic MCP Extension)

Any VS Code extension supporting the MCP protocol (e.g., "MCP Server" or "Continue" with MCP) uses a `.mcp.json` at the workspace root:

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/absolute/path/to/2d6mcp/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

## Environment Variables

All BYOD features require consent and a file path. The server also supports tuning limits for large reference folders.

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Set to `"true"` to enable BYOD file ingestion and search |
| `BYOD_PATH` | — | Absolute path to a directory of `.pdf`, `.md`, `.txt`, or `.html` RPG files |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per text chunk (500–50000) |
| `BYOD_CHUNK_OVERLAP` | `400` | Overlap between consecutive chunks |
| `BYOD_MAX_FILES` | `2000` | Maximum files processed per sync call |
| `BYOD_MAX_CHUNKS_PER_FILE` | `500` | Maximum chunks produced from a single file |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Time budget per `sync_byod` call in milliseconds (1000–300000) |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | Path to a custom OGL SQLite database |

**OGL-only mode**: No environment variables are needed. The bundled Cepheus Engine SRD database (`data/ogl/cepheus.db`) is used automatically.

**BYOD mode**: At minimum, set `AGREE_BYOD_USE=true` and `BYOD_PATH`. Run `npm run setup` as a convenience — it creates the consent token file so you don't need the env var.

## Verifying the Connection

After configuring your harness and restarting, ask your AI assistant:

> "Roll 2d6+2 vs 8 for a standard skill check."

If the server is connected, the assistant will call `roll_2d6` and return dice results with an effect margin.

To test rules lookup:

> "What does the OGL database say about combat?"

To test BYOD (if configured):

> "Sync my BYOD files and list what's indexed."

## Troubleshooting

**"Tool not found" or no response**: The MCP server may not have started. Check:
- The path to `dist/index.js` is absolute and correct
- `npm run build` completed without errors
- Your harness was restarted after editing its config file

**"BYOD Mode is disabled"**: Set `AGREE_BYOD_USE=true` in the harness config's `env` block, or run `npm run setup` in the 2d6mcp directory.

**"No BYOD_PATH set"**: Add `BYOD_PATH` to the `env` block pointing to a directory containing supported files (`.pdf`, `.md`, `.txt`, `.html`).

**Server starts but sync times out**: This is normal for large reference folders. The `sync_byod` tool returns `complete: false` — tell your assistant to call `sync_byod` again to continue where it left off.

**No results from BYOD search**: Files must be synced before they are searchable. Run `sync_byod` first (repeat until `complete: true`), then try your search again.

**"Table not found" on `roll_table`**: Use `query_ogl_rules("", category: "list_tables")` to see all available tables.

**Server crashes with "Cannot find module"**: Run `npm install` to ensure all dependencies are present, then `npm run build`.
