# Versioning

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

2d6mcp is a **single product** (self-hosted MCP server) distributed as an npm workspaces monorepo. Version numbers follow **SemVer 2.0.0** (`MAJOR.MINOR.PATCH`) and stay in **lockstep**: the root `package.json` and every `packages/*/package.json` share one version.

The MCP handshake and `2d6mcp://info` resource read `server.version` from **root** `package.json` via `getServerVersion()` in `packages/server/src/tools/helpers.ts`. Registry metadata in `server.json` must match.

Root is `"private": true`. Do **not** `npm publish`, Docker-push, or create a GitHub Release that auto-publishes. Tags are documentation of a git snapshot; publish stays draft-only until the maintainer explicitly approves it.

## Lockstep files

| File | Role |
|------|------|
| `package.json` | Source of truth for MCP `server.version` |
| `packages/*/package.json` | Same version (internal workspaces, `"*"` deps) |
| `server.json` | MCP registry `version` and package `version` |
| `package-lock.json` | Workspace package versions only; must match |

`npm run version:check` fails if any of those drift.

## Conventional Commits → bump

| Commit prefix | Bump | Example |
|---------------|------|---------|
| `fix:`, `docs:`, `chore:`, `test:`, `refactor:`, `style:`, `ci:` | **patch** | `0.8.0` → `0.8.1` |
| `feat:` | **minor** | `0.8.0` → `0.9.0` |
| `BREAKING CHANGE` in body, or `feat!:` / `fix!:` | **major** after 1.0.0; **minor** on 0.x | see below |

If a batch of commits mixes types, use the highest bump (patch < minor < major).

### 0.x policy (unstable API)

While the product version is `0.Y.Z`, the public MCP/tool surface is **unstable**. Breaking changes bump **minor**, not major:

- `0.8.0` + breaking change → `0.9.0` (`npm run version:bump -- minor`)
- Do **not** invent `1.0.0` until the maintainer cuts a stable API
- `npm run version:bump -- major` is refused on 0.x unless `--force` (that force path is how 1.0.0 will be cut later)

## How to cut a release

1. `main` holds the intended snapshot. `npm run version:check` passes.
2. Choose the bump from conventional commits since the last `vX.Y.Z` tag (table above).
3. Move items from `CHANGELOG.md` `[Unreleased]` into a dated `## [X.Y.Z] - YYYY-MM-DD` section ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)). Use generic language only — no closed commercial product titles, no personal or fleet campaign names.
4. Bump every lockstep file together:

   ```bash
   npm run version:bump -- patch    # or minor / major
   npm run version:check
   ```

   Dry-run: `npm run version:bump -- minor --dry-run`

5. Commit: `chore(release): bump lockstep version to X.Y.Z`
6. Open a PR. Do not self-merge.
7. After merge to `main`, tag the release commit:

   ```bash
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

   Lightweight annotated tags are fine (`git tag -a vX.Y.Z -m "vX.Y.Z"`).

8. Stop there. No npm publish, no Docker push, no GitHub Release that auto-publishes.

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run version:check` | Assert every lockstep file matches root |
| `npm run version:bump -- patch\|minor\|major` | Write the new version to all lockstep files |
| `node scripts/bump-version.mjs set X.Y.Z` | Set an explicit version (same lockstep write) |

CI runs `node scripts/bump-version.mjs check` without installing dependencies. The Vitest suite also guards drift.

## Changelog

`CHANGELOG.md` is Keep a Changelog style: `[Unreleased]` first, then dated sections. Seed notes from merged work at a high level. Do not name closed commercial books or table/campaign labels from private play.

## Next bump (operators)

After `0.9.0`:

- Bugfix / docs-only / chore on `main` → `npm run version:bump -- patch` (`0.9.1`)
- New user-facing capability (`feat:`) → `npm run version:bump -- minor` (`0.10.0`)
- Breaking MCP/tool change while still on 0.x → still `minor`
- First stable API → `npm run version:bump -- major --force` (`1.0.0`), only when the maintainer asks
