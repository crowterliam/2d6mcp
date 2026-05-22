# 2D6 MCP — Setup Guide

This guide covers connecting the 2d6mcp server to common AI coding harnesses (self-hosted mode) and deploying the Discord bot (Cloudflare hosted mode). After setup, your AI assistant gains dice rolling, rules lookup, character parsing, and BYOD file search capabilities for 2d6-based tabletop RPGs.

## Deployment Options

| Mode | Setup Time | Requires |
|---|---|---|
| **Self-Hosted MCP Server** | ~3 min | Node.js, macOS/Linux/Windows |
| **Hosted Discord Bot** | ~15 min | Cloudflare account, Discord bot app |

---

## Prerequisites (Both Modes)

```bash
cd /path/to/2d6mcp
npm install
npm run build
```

Verify with:
```bash
node packages/server/dist/cli.js setup     # creates consent token for BYOD mode (optional)
```

The MCP server binary is `packages/server/dist/index.js`. All harnesses launch it via `node`.

---

## Self-Hosted MCP Server

### Claude Desktop

**Config file**: macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`. Windows: `%APPDATA%\Claude\claude_desktop_config.json`.

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/absolute/path/to/2d6mcp/packages/server/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

Restart Claude Desktop after editing.

### Claude Code (CLI)

**Config file**: `~/.claude.json` (global) or `.claude.json` in your project (local).

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["/absolute/path/to/2d6mcp/packages/server/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

### Kilo Code / Kilo CLI

**Config file**: `kilo.json` in your project root, or `~/.config/kilo/kilo.json` for global.

```json
{
  "mcpServers": {
    "2d6mcp": {
      "command": "node",
      "args": ["packages/server/dist/index.js"],
      "env": {
        "AGREE_BYOD_USE": "true",
        "BYOD_PATH": "/absolute/path/to/your/rpg/files"
      }
    }
  }
}
```

### Cursor, Windsurf, Cline, Aider

See full setup instructions in [MCP_SETUP.md](MCP_SETUP.md) or [README.md](README.md).

---

## Hosted Discord Bot (Cloudflare)

### Prerequisites

- Cloudflare account with Workers Paid plan ($5/mo)
- Discord bot application (created in [Discord Developer Portal](https://discord.com/developers/applications))
- Node.js 20+ and npm

### Setup Steps

```bash
cd apps/worker

# Copy config template (wrangler.toml is gitignored)
cp wrangler.toml.example wrangler.toml

# Create infrastructure
npx wrangler d1 create 2d6mcp                      # 1. D1 database
npx wrangler r2 bucket create 2d6mcp-audio         # 2. R2 bucket

# Set secrets (run each, paste value when prompted)
npx wrangler secret put DISCORD_BOT_TOKEN           # 3. From Discord Dev Portal → Bot
npx wrangler secret put DISCORD_PUBLIC_KEY          # 4. From Discord Dev Portal → General
npx wrangler secret put DISCORD_CLIENT_ID           # 5. From Discord Dev Portal → General
npx wrangler secret put DISCORD_CLIENT_SECRET       # 6. From Discord Dev Portal → OAuth2
npx wrangler secret put JWT_SECRET                  # 7. Any random string (≥32 chars)
npx wrangler secret put STRIPE_SECRET_KEY           # 8. Placeholder: sk_test_...
npx wrangler secret put STRIPE_WEBHOOK_SECRET       # 9. Placeholder: whsec_...

# Run database migration
npx wrangler d1 execute 2d6mcp --remote --file src/db/schema.sql

# Seed rules data (OGL + DW)
node scripts/seed-d1.mjs
npx wrangler d1 execute 2d6mcp --remote --file src/db/seed.sql

# Deploy
npx wrangler deploy
```

### Configure Discord

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → Your App → General Information
2. Set **Interactions Endpoint URL** to `https://2d6mcp.YOUR-SUBDOMAIN.workers.dev/api/interactions`
3. Save — Discord will verify the endpoint
4. Register slash commands (replace `YOUR_BOT_TOKEN`):

```bash
curl -X PUT "https://discord.com/api/v10/applications/YOUR_CLIENT_ID/commands" \
  -H "Authorization: Bot YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"name":"ask","description":"Ask a rules question and get a cited ruling","options":[{"name":"question","description":"Your rules question","type":3,"required":true}]},{"name":"roll","description":"Roll dice","options":[{"name":"notation","description":"Dice notation","type":3,"required":true}]},{"name":"session","description":"Manage game sessions","options":[{"name":"action","description":"start, end, or context","type":3,"required":true,"choices":[{"name":"Start a new session","value":"start"},{"name":"End the current session","value":"end"},{"name":"View recent context","value":"context"}]}]},{"name":"search","description":"Search session transcript","options":[{"name":"query","description":"What to search for","type":3,"required":true}]},{"name":"help","description":"Show available commands"}]'
```

5. Invite the bot to your server:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2147485696&scope=bot%20applications.commands
```

---

## Verifying the Connection

After configuring your harness and restarting, ask your AI assistant:

> "Roll 2d6+2 vs 8 for a standard skill check."

If the server is connected, the assistant will call `roll_2d6` and return dice results with an effect margin.

## Environment Variables

### Self-Hosted

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGREE_BYOD_USE` | `"false"` | Set to `"true"` to enable BYOD file ingestion and search |
| `BYOD_PATH` | — | Absolute path to a directory of `.pdf`, `.md`, `.txt`, or `.html` RPG files |
| `BYOD_CHUNK_SIZE` | `8000` | Characters per text chunk (500–50000) |
| `BYOD_CHUNK_OVERLAP` | `400` | Overlap between consecutive chunks |
| `BYOD_MAX_FILES` | `2000` | Maximum files processed per sync call |
| `BYOD_SYNC_TIMEOUT_MS` | `15000` | Time budget per `sync_byod` call in milliseconds |
| `BYOD_CONTENT_CACHE_PATH` | `data/byod/content_cache.db` | Shared content cache database |
| `OGL_DB_PATH` | `data/ogl/cepheus.db` | Path to custom OGL SQLite database |
| `DW_DB_PATH` | `data/dw/dungeon-world.db` | Path to custom DW SQLite database |
| `MLX_WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` | MLX Whisper model |
| `MLX_LLM_MODEL` | `mlx-community/Llama-3.2-3B-Instruct-4bit` | MLX LLM model |
| `SESSION_DB_PATH` | `~/.2d6mcp/sessions.db` | Session database location |
| `STT_BACKEND` | `mlx` | STT backend: `mlx` or `whispercpp` |
| `LLM_BACKEND` | `mlx` | LLM backend: `mlx` or `llamacpp` |

### Hosted

Set via `wrangler secret put`. See [README.md](README.md) for the full list.

## Troubleshooting

**"Tool not found" or no response**: The MCP server may not have started. Check:
- The path to `packages/server/dist/index.js` is absolute and correct
- `npm run build` completed without errors
- Your harness was restarted after editing its config file

**"BYOD Mode is disabled"**: Set `AGREE_BYOD_USE=true` in the harness config's `env` block, or run `npm run setup` in the 2d6mcp directory.

**Interactions Endpoint won't verify**: Ensure all 6 secrets are set via `wrangler secret put` and `wrangler.toml` has no vars section with empty values. Redeploy after setting secrets.

**Worker returns 500**: Check `wrangler tail` for logs. Common causes: missing secrets, D1 not migrated, FTS5 tables not seeded.

**Server starts but sync times out**: This is normal for large reference folders. The `sync_byod` tool returns `complete: false` — tell your assistant to call `sync_byod` again to continue where it left off.

**Slash commands not appearing**: Commands must be registered via the Discord API (see curl command above). They appear after a short delay (up to 1 hour for global commands).
