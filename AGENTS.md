# 2D6 MCP Server — Agent Instructions

## Project Identity

This is a Model Context Protocol (MCP) server that acts as a mechanical engine, dice roller, and rules reference for generic 2d6-based sci-fi tabletop RPGs. The server is system-agnostic and avoids all third-party trademarks.

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
```

## Dual-License Architecture

- All `.ts` source files: AGPL-3.0
- All files under `data/ogl/`: OGL v1.0a
- `LICENSE.md` describes the firewall in detail
- `OGL-1.0a.txt` contains the full OGL text with Cepheus SRD copyright attributions

## BYOD Consent Gate

The server checks for `AGREE_NON_COMMERCIAL_USE="true"` env var OR the presence of a `.mcp-fair-use-accepted` token file in the project root before enabling BYOD tools. Without consent, BYOD tools return a clear disclaimer message.

## Naming Conventions

Never reference any third-party game system or trademarked terms. Use generic descriptors: "2d6 sci-fi RPG", "starship", "star system", "characteristic", etc.
