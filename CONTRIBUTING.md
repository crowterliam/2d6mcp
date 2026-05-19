# Contributing to 2D6 MCP Server

## Getting Started

```bash
git clone https://github.com/crowterliam/2d6mcp.git
cd 2d6mcp
npm install
npm run build
```

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes; keep them focused and scoped
3. Run `npm run build` to verify compilation
4. Test manually against an MCP client (Claude Desktop, Cline, Continue, etc.)
5. Submit a pull request

## Code Style

- TypeScript strict mode is enabled
- No `any` without explicit justification
- Follow existing patterns in `src/`
- No third-party trademarked names in tool descriptions or public-facing text

## Naming Convention

This project is system-agnostic. Avoid all third-party trademarks. Use generic
descriptors: "2d6 sci-fi RPG", "starship", "star system", "characteristic", etc.

## Licensing

All `.ts` source files contributed to this repository are licensed AGPL-3.0-only.
By submitting a pull request, you agree to license your contribution under the
same terms.

Do not contribute content that would violate the Open Game License firewall.
See `LICENSE.md` for details on the dual-license architecture.

## Adding Tools

New MCP tools should:

1. Be registered in `src/server.ts` (follow the existing `server.setRequestHandler` pattern)
2. Use Zod schemas for input validation
3. Use generic terminology (no trademarked names)
4. Keep tools self-contained and offline-first

## Questions

Open an issue or contact the lead maintainer at [liam@evaunit.one](mailto:liam@evaunit.one).

## Testing

This project currently uses manual testing against MCP clients. Verify new tools
work correctly before submitting a pull request.

## Commit Messages

Use conventional commit format:

```
type(scope): description

feat(dice): add d66 table rolling
fix(byod): handle PDF parse errors gracefully
docs(readme): update client configuration example
```
