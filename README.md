# 2D6 MCP Server

A system-agnostic Model Context Protocol (MCP) server providing a mechanical engine, dice roller, and rules reference for generic 2d6-based sci-fi tabletop RPGs.

## Features

- **Dice Engine** — Parse standard dice notation (`2d6+1`, `3d6`, `d66`), roll against target numbers, and calculate effect margins
- **Table Lookup** — Roll on named tables (reaction, encounters, patrons) using 1d6, 2d6, or d66 resolution
- **Rules Database** — Pre-populated SQLite database with Cepheus Engine SRD content under OGL 1.0a
- **BYOD Indexing** — Ingest your own PDF, text, and markdown files for local full-text search
- **Character Parser** — Extract UPP hex strings, characteristics, and skills from character sheets
- **Offline-First** — All queries run locally; no network calls, no telemetry

## Quick Start

```bash
npm install
npm run build
npm run setup          # create consent token for BYOD mode
npm run populate-ogl   # generate the OGL rules database
```

### Run as an MCP Server

```
npm run start
```

### MCP Client Configuration

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/path/to/2d6mcp/dist/index.js"],
      "env": {
        "AGREE_NON_COMMERCIAL_USE": "true",
        "BYOD_PATH": "/path/to/your/rpg/files"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `roll_2d6` | Roll 2d6 with modifier, compare against target, return effect margin |
| `roll_custom` | Roll any dice notation (`3d6`, `1d20`, `4d6+2`) |
| `roll_table` | Roll on a named table (`Reaction Table`, `Personal Encounter`, `Patron Encounter`) |
| `query_ogl_rules` | Search the OGL database for rules, skills, careers, equipment, or tables |
| `query_local_byod` | Search your locally ingested BYOD files (requires consent) |
| `parse_character` | Parse a character sheet file into structured JSON |
| `sync_byod` | Re-index all files in your BYOD directory |

## Modes of Operation

### Mode A: OGL Only (Default)

Works out of the box with the bundled Cepheus Engine SRD database. All OGL tools are available without any configuration.

### Mode B: BYOD Engine

Enable by setting `AGREE_NON_COMMERCIAL_USE="true"` or running `npm run setup`. Requires a `BYOD_PATH` pointing to a directory of PDF/text/markdown files. Ingested content is indexed into a local SQLite FTS5 database and searchable via `query_local_byod`.

**Disclaimer:** By enabling local file ingestion, you confirm that you are the legal owner of the imported files or hold a valid license to use them. This tool is provided strictly for personal, non-commercial automation and referencing.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGREE_NON_COMMERCIAL_USE` | `"false"` | Set to `"true"` to enable BYOD mode |
| `BYOD_PATH` | — | Path to directory containing local RPG source files |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | Path to custom OGL SQLite database |

## CLI Commands

```bash
npm run setup                    # create .mcp-fair-use-accepted token
npm run populate-ogl             # generate OGL database
npm run populate-ogl -- --force  # regenerate OGL database
```

## Architecture

```
src/
  index.ts          MCP server entry point (stdio transport)
  server.ts         Server class, tool registration
  config.ts         Environment config + BYOD gate
  cli.ts            CLI entry for setup/populate commands
  dice/
    roller.ts       Dice notation parser, 2d6 resolution
    tables.ts       d66 / 2d6 table rolling
  ogl/
    database.ts     SQLite connection + FTS5 setup
    schema.sql.ts   Schema DDL
    populate.ts     Populate DB with Cepheus Engine SRD data
    queries.ts      Rule search queries
  byod/
    gate.ts         Consent gate check
    ingest.ts       File walking, text/markdown parsing
    search.ts       FTS5 search against BYOD index
  character/
    parser.ts       UPP extraction, stat parsing
data/
  ogl/cepheus.db    Bundled OGL SQLite database
```

## Open Game Content

This product includes game rules and data derived from the **Cepheus Engine System Reference Document**, which is Open Game Content available under the Open Game License v1.0a.

**Designation:** All text within the `data/ogl/` directory is designated as Open Game Content. The names "Cepheus Engine", "Samardan Press", "Moon Toad Publishing", "Mongoose Publishing", and "Traveller", and any product titles published by those entities, are designated as Product Identity under the OGL and are used solely for compliance and attribution.

**Derivation:** This product is derived from the Traveller System Reference Document (Copyright 2008, Mongoose Publishing) and the Cepheus Engine System Reference Document (Copyright 2016, Samardan Press; Author Jason "Flynn" Kemp).

**Non-Affiliation:** This product is not affiliated with, endorsed by, or sponsored by Jason "Flynn" Kemp, Samardan Press, Mongoose Publishing, Far Future Enterprises, Moon Toad Publishing, or Wizards of the Coast, Inc. The use of Open Game Content from these sources does not convey endorsement.

**Mongoose Publishing Fair Use Policy:** The Traveller game in all forms is owned by Mongoose Publishing. Copyright 1977 - 2025 Mongoose Publishing. Traveller is a registered trademark of Mongoose Publishing. The contents of this project are for personal, non-commercial use only. Any use of Mongoose Publishing's trademarks within this project's documentation should not be viewed as a challenge to those trademarks.

[Full OGL license text](OGL-1.0a.txt) | [Full license documentation](LICENSE.md)

---

## License

This project uses a dual-license architecture:

- **Source code** (`src/**/*.ts`, config files): [AGPL-3.0-only](https://www.gnu.org/licenses/agpl-3.0.en.html)
- **Game data** (`data/ogl/**`): [OGL v1.0a](OGL-1.0a.txt)
