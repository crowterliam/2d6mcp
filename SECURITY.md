# Security Policy

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.7.x   | :white_check_mark: |
| 0.6.x   | :white_check_mark: |
| < 0.6   | :x:                |

## Reporting a Vulnerability

This project is a self-hosted MCP server. If you discover a security vulnerability:

1. **Do not** open a public issue
2. Contact the lead maintainer at [liam@evaunit.one](mailto:liam@evaunit.one)
3. Provide a description of the vulnerability and steps to reproduce

You should receive an acknowledgment within 72 hours. The maintainer will work with you to assess, patch, and disclose the issue responsibly.

## Scope

- File ingestion vulnerabilities in the BYOD parser (`packages/server/src/byod/`)
- Dependency supply-chain risks (`npm` packages)
- SQL injection vectors in FTS5 queries
- Path traversal in file walking logic
- Hardcoded data injection in OGL or DW populate modules
- Shell injection via `execFile` calls (audio CLI wrappers, LLM CLI wrappers)
- Discord webhook URL storage (`.mcp-discord-webhooks.json`)

## Secrets Handling

### Never commit to the repository

- `.mcp-byod-consent-accepted` — gitignored
- `.mcp-discord-webhooks.json` — gitignored. Contains webhook URLs
- `*.tsbuildinfo` — gitignored. TypeScript incremental build cache

The MCP server reads secrets from environment variables only — never from committed files.

## Out of Scope

- Vulnerabilities in third-party PDFs indexed by the user (the user is responsible for the provenance of files they ingest)
- Social-engineering attacks against the maintainer
- Security of the user's own MCP client configuration
- Discord platform-level abuse (use Discord's own reporting tools)
