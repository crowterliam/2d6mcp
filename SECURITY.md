# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

This MCP server runs locally and makes no outbound network connections by design.
However, if you discover a security vulnerability in the dependency chain, BYOD file
parsing, or any other component:

1. **Do not** open a public issue
2. Contact the maintainer via GitHub: [crowterliam](https://github.com/crowterliam)
3. Provide a description of the vulnerability and steps to reproduce

You should receive an acknowledgment within 72 hours. The maintainer will work with
you to assess, patch, and disclose the issue responsibly.

## Scope

- File ingestion vulnerabilities in the BYOD parser (`src/byod/`)
- Dependency supply-chain risks (`npm` packages)
- SQL injection vectors in FTS5 queries
- Path traversal in file walking logic

## Out of Scope

- Vulnerabilities in third-party PDFs indexed by the user (the user is responsible for
  the provenance of files they ingest)
- Social-engineering attacks against the maintainer
- Security of the user's own MCP client configuration
