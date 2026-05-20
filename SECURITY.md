# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.4.x   | :white_check_mark: |
| 0.3.x   | :white_check_mark: |
| < 0.3   | :x:                |

## Reporting a Vulnerability

This MCP server runs locally and makes no outbound network connections by design.
However, if you discover a security vulnerability in the dependency chain, BYOD file
parsing, or any other component:

1. **Do not** open a public issue
2. Contact the lead maintainer at [liam@evaunit.one](mailto:liam@evaunit.one)
3. Provide a description of the vulnerability and steps to reproduce

You should receive an acknowledgment within 72 hours. The maintainer will work with
you to assess, patch, and disclose the issue responsibly.

## Scope

- File ingestion vulnerabilities in the BYOD parser (`src/byod/`)
- Dependency supply-chain risks (`npm` packages)
- SQL injection vectors in FTS5 queries
- Path traversal in file walking logic
- Hardcoded data injection in OGL or DW populate modules (`src/ogl/populate.ts`, `src/dw/populate.ts`)

## Out of Scope

- Vulnerabilities in third-party PDFs indexed by the user (the user is responsible for
  the provenance of files they ingest)
- Social-engineering attacks against the maintainer
- Security of the user's own MCP client configuration
