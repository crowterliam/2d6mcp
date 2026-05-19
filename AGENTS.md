# 2D6 MCP Server — Agent Instructions

## Project Identity

This is a Model Context Protocol (MCP) server that acts as a mechanical engine, dice roller, and rules reference for generic 2d6-based sci-fi tabletop RPGs. The server is system-agnostic and avoids all third-party trademarks.

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
npm run setup        # run first-time setup (consent token)
npm run populate-ogl # regenerate the OGL SQLite database
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
  byod/
    gate.ts         # Consent gate check
    ingest.ts       # File walking, PDF/text/md parsing
    search.ts       # FTS5 search against BYOD index
  character/
    parser.ts       # UPP extraction, stat parsing
data/
  ogl/
    cepheus.db      # Bundled OGL SQLite database (Cepheus Engine SRD)
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
| `query_local_byod` | Full-text search across personal ingested files |
| `parse_character` | Parse character sheet into structured data |
| `sync_byod` | Index/re-index files from BYOD directory |
| `clear_byod` | Delete BYOD index to start fresh |
| `list_byod_files` | List indexed files with status and chunk counts |
| `inspect_byod_file` | Show chunk structure for a specific file |

## Dual-License Architecture

- All `.ts` source files: AGPL-3.0
- All files under `data/ogl/`: OGL v1.0a
- `LICENSE.md` describes the firewall in detail
- `OGL-1.0a.txt` contains the full OGL text with Cepheus SRD copyright attributions

## BYOD Consent Gate

The server checks for `AGREE_BYOD_USE="true"` env var OR the presence of a `.mcp-byod-consent-accepted` token file in the project root before enabling BYOD tools. Without consent, BYOD tools return a clear disclaimer message.

## Naming Conventions

Never reference any third-party game system or trademarked terms. Use generic descriptors: "2d6 sci-fi RPG", "starship", "star system", "characteristic", etc.
