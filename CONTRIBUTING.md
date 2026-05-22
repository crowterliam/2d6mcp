# Contributing to 2D6 MCP

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

## Development Workflow

```bash
git clone https://github.com/crowterliam/2d6mcp.git
cd 2d6mcp
npm install             # installs all workspace dependencies
npm run build           # compiles all packages (tsc --build)
npm test                # runs 209 tests across vitest
```

1. Create a feature branch from `main`
2. Make your changes; keep them focused and scoped
3. Run `npm run build` to verify compilation
4. Run `npm test` to verify all tests pass
5. Submit a pull request

## Monorepo Structure

This project uses npm workspaces with TypeScript project references:

```
packages/
  shared/    @2d6mcp/shared  — dice, keywords, prompts, quality filter (zero Node.js deps except zod)
  ogl/       @2d6mcp/ogl     — OGL rules database (Cepheus Engine SRD, OGL v1.0a)
  dw/        @2d6mcp/dw      — DW rules database (Dungeon World, CC-BY-3.0)
  server/    @2d6mcp/server  — MCP server (depends on shared, ogl, dw)
apps/
  worker/    @2d6mcp/worker  — Cloudflare Worker (depends on shared)
  bridge/    Discord voice relay (Fly.io)
  web/       Vite + React SPA dashboard
  recorder/  Browser PWA
```

Packages reference each other via `@2d6mcp/` namespace. The root `tsc --build` handles dependency ordering.

## Code Style

- TypeScript strict mode is enabled
- No `any` without explicit justification
- Follow existing patterns in `packages/server/src/`
- No third-party trademarked names in tool descriptions or public-facing text
- SPDX license headers on all new files: `// SPDX-License-Identifier: AGPL-3.0-only`

## Naming Convention

This project is system-agnostic. Avoid all third-party trademarks. Use generic descriptors: "2d6 sci-fi RPG", "starship", "star system", "characteristic", "move", "front", "monster", etc.

## Licensing

All `.ts` source files contributed to this repository are licensed AGPL-3.0-only. By submitting a pull request, you agree to license your contribution under the same terms. See `LICENSE.md` for the full multi-license architecture.

Do not contribute content that would violate the Open Game License firewall or CC-BY-3.0 license terms.

## Adding MCP Tools

New MCP tools should:

1. Be registered in `packages/server/src/tools/definitions.ts` and `packages/server/src/tools/index.ts`
2. Use Zod schemas for input validation
3. Use generic terminology (no trademarked names)
4. Pure computation tools go in `packages/shared/` for reuse by the Worker

## Worker Development

For Cloudflare Worker changes:

1. Ensure typecheck: `cd apps/worker && npx tsc --noEmit`
2. Test locally: `npx wrangler dev`
3. Set secrets via `wrangler secret put`, never in committed files
4. Reference `wrangler.toml.example` for config structure

## Testing

This project uses vitest (209 tests across 18 files). Write tests for new tools and features. Run `npm test` before submitting.

## Commit Messages

Use conventional commit format:

```
type(scope): description

feat(dice): add d66 table rolling
fix(byod): handle PDF parse errors gracefully
docs(readme): update monorepo architecture
```

## Questions

Open an issue or contact the lead maintainer at [liam@evaunit.one](mailto:liam@evaunit.one).
