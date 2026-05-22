# 2d6mcp Bridge Deployment — VPS

The Discord voice bridge connects to Discord's gateway, auto-joins voice channels, captures audio, and streams it to the Cloudflare Worker for AI processing. It requires raw network access (UDP) — any VPS works. Hetzner, DigitalOcean, Linode, Vultr, or a Raspberry Pi at home.

## Prerequisites

- A VPS running Ubuntu 22.04+ (or any Linux with systemd)
- Discord bot token (from Developer Portal)
- Worker URL (the deployed Cloudflare Worker)
- Node.js 22+

## Quick Setup (3 minutes)

```bash
# 1. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# 2. Clone and build
git clone https://github.com/crowterliam/2d6mcp.git
cd 2d6mcp
npm install
npm run build

# 3. Create environment file
cat > apps/bridge/.env << 'EOF'
DISCORD_BOT_TOKEN=your-bot-token-here
WORKER_URL=https://2d6mcp.3ivkf0oy1.workers.dev
HEALTH_PORT=3000
EOF

# 4. Install systemd service
sudo cp apps/bridge/2d6mcp-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable 2d6mcp-bridge
sudo systemctl start 2d6mcp-bridge

# 5. Verify
sudo systemctl status 2d6mcp-bridge
curl http://localhost:3000/health
```

The bridge starts automatically on boot and restarts on crash.

## Discord Bot Configuration

Enable these **Privileged Gateway Intents** in the Discord Developer Portal (Bot section):

- **SERVER MEMBERS INTENT** — required for auto-join (bridge needs voice state updates)
- **PRESENCE INTENT** — recommended

## How It Works

1. **Auto-join**: When a user enters any voice channel the bot can access, the bridge automatically connects. No slash commands needed.
2. **Ring buffer**: Continuously captures 120 seconds of audio per guild in a 16kHz mono PCM buffer.
3. **Push-to-ask**: Worker receives `/push-to-ask` → makes HTTP request to bridge → bridge flushes ring buffer → uploads WAV to Worker → Worker transcribes via Workers AI Whisper.
4. **Health**: `GET /health` returns guild count, uptime, memory for monitoring.

## Manual Start (for development)

```bash
cd apps/bridge
export DISCORD_BOT_TOKEN=your-token
export WORKER_URL=https://2d6mcp.3ivkf0oy1.workers.dev
node dist/index.js
```

## Monitoring

```bash
# Service status
sudo systemctl status 2d6mcp-bridge

# View logs
sudo journalctl -u 2d6mcp-bridge -f

# Health check
curl http://localhost:3000/health
# → {"status":"ok","guilds":1,"uptime":3600,"memory":"12MB"}
```

## Scaling

One bridge instance handles ~20 concurrent voice channels comfortably (256MB RAM). For more, run additional instances with separate bot tokens or use a load balancer.

## Firewall

No inbound ports need to be opened for Discord voice. The bridge connects to Discord (outbound TCP WebSocket + outbound UDP). The health port (3000) should be accessible to your monitoring and the Worker:

```bash
sudo ufw allow 3000/tcp
```

## Costs

| Provider | Monthly | Specs |
|---|---|---|
| Hetzner CX22 | $4 | 2 vCPU, 4GB, 20TB traffic |
| DigitalOcean | $6 | 1 vCPU, 1GB, 1TB traffic |
| Linode | $5 | 1 vCPU, 1GB, 1TB traffic |
| Vultr | $6 | 1 vCPU, 1GB, 2TB traffic |
| Raspberry Pi | $0 | Runs at home, no cost |

Discord voice bandwidth: ~8KB/s per active voice channel. A 1TB traffic allowance handles ~350,000 hours of voice.
