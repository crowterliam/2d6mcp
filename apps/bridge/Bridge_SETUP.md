# 2d6mcp Bridge Deployment — Fly.io

## Prerequisites

- [Fly.io account](https://fly.io) + `flyctl` CLI installed
- Discord bot token (from Developer Portal)
- Worker URL (the deployed Cloudflare Worker)

## Setup

### 1. Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
iwr https://fly.io/install.ps1 -useb | iex
```

### 2. Login + Create App

```bash
cd apps/bridge
flyctl auth login
flyctl launch --name 2d6mcp-bridge --region lax --no-deploy
```

This creates `fly.toml`. Fly will detect the Dockerfile.

### 3. Set Secrets

```bash
flyctl secrets set DISCORD_BOT_TOKEN=your-bot-token
flyctl secrets set WORKER_URL=https://2d6mcp.YOUR-SUBDOMAIN.workers.dev
```

### 4. Deploy

```bash
flyctl deploy --build-target .
```

> **Note**: The build context must be the project root (not `apps/bridge/`) because
> the Dockerfile copies workspace dependencies from `packages/shared/`.

### 5. Verify

```bash
# Check status
flyctl status

# View logs
flyctl logs

# Health check
curl https://2d6mcp-bridge.fly.dev/health
# → {"status":"ok","guilds":0,"uptime":15,"memory":"42MB"}
```

### 6. Invite Bot

The bridge uses the same Discord application as the Worker. Add it to your server:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=3148800&scope=bot%20applications.commands
```

Permissions needed: Connect, Speak, Use Voice Activity.

### 7. Test

In Discord:
```
/join                  → bot joins your voice channel
/push-to-ask           → captures 30s of audio, uploads to Worker
/leave                 → bot disconnects
```

## Scaling

```bash
# Scale to 3 instances
flyctl scale count 3

# Check current scale
flyctl scale show
```

Default: 2 instances (set in `fly.toml`). Each handles ~20 concurrent guilds. Fly auto-scales by default.

## Costs

| Instance | vCPU | RAM | Monthly |
|---|---|---|---|
| shared-cpu-1x | 1 | 256MB | $2.74 |
| 2 instances (default) | 2 | 512MB | **$5.48/mo** |

At 2 instances, the bridge pool handles ~40 concurrent voice channels.
