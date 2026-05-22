# Security Policy

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.4.x   | :white_check_mark: |
| 0.3.x   | :white_check_mark: |
| < 0.3   | :x:                |

## Reporting a Vulnerability

This project runs in two modes — self-hosted (local, no outbound network) and Cloudflare-deployed (Workers, Discord). If you discover a security vulnerability:

1. **Do not** open a public issue
2. Contact the lead maintainer at [liam@evaunit.one](mailto:liam@evaunit.one)
3. Provide a description of the vulnerability and steps to reproduce

You should receive an acknowledgment within 72 hours. The maintainer will work with you to assess, patch, and disclose the issue responsibly.

## Scope

### Self-Hosted MCP Server

- File ingestion vulnerabilities in the BYOD parser (`packages/server/src/byod/`)
- Dependency supply-chain risks (`npm` packages)
- SQL injection vectors in FTS5 queries
- Path traversal in file walking logic
- Hardcoded data injection in OGL or DW populate modules
- Shell injection via `execFile` calls (audio CLI wrappers, LLM CLI wrappers)

### Hosted Cloudflare Worker

- Discord Interactions endpoint signature verification (Ed25519 via tweetnacl)
- JWT signing and verification (Web Crypto API HMAC-SHA256)
- D1 SQL injection in user-facing FTS5 queries
- Stripe webhook signature verification
- Rate limiting bypass
- Cross-guild data access via unauthorized JWT
- Workers AI prompt injection

## Secrets Handling

### Never commit to the repository

- `wrangler.toml` — gitignored. Use `wrangler.toml.example` as a template
- `.dev.vars` — gitignored. Contains local dev secrets
- `.wrangler/` — gitignored. Local D1 SQLite files and miniflare state
- `.mcp-byod-consent-accepted` — gitignored
- `.mcp-discord-webhooks.json` — gitignored. Contains webhook URLs
- `*.tsbuildinfo` — gitignored. TypeScript incremental build cache

### Set via wrangler secret put

All production secrets for the Cloudflare Worker must be set via `wrangler secret put`:

- `DISCORD_BOT_TOKEN`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

These are stored encrypted in Cloudflare's secret store and never appear in the repository or deployment artifacts.

## Out of Scope

- Vulnerabilities in third-party PDFs indexed by the user (the user is responsible for the provenance of files they ingest)
- Social-engineering attacks against the maintainer
- Security of the user's own MCP client configuration
- Discord platform-level abuse (use Discord's own reporting tools)
