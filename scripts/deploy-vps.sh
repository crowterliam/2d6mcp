#!/bin/bash
# 2d6mcp Bridge — Hetzner CX22 one-command setup
# Run as root on a fresh Ubuntu 22.04/24.04 VPS

set -e

echo "=== 2d6mcp Bridge Setup ==="

# ── 1. Install deps ──
echo "[1/4] Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git

# ── 2. Clone & build ──
echo "[2/4] Cloning and building..."
cd /root
if [ -d 2d6mcp ]; then cd 2d6mcp && git pull; else git clone https://github.com/crowterliam/2d6mcp.git; fi
cd 2d6mcp
npm install
npm run build

# ── 3. Configure ──
echo "[3/4] Configuration..."
if [ ! -f apps/bridge/.env ]; then
  read -p "Discord Bot Token: " DISCORD_TOKEN
  read -p "Worker URL [https://2d6mcp.3ivkf0oy1.workers.dev]: " WORKER_URL
  WORKER_URL=${WORKER_URL:-https://2d6mcp.3ivkf0oy1.workers.dev}
  cat > apps/bridge/.env << EOF
DISCORD_BOT_TOKEN=${DISCORD_TOKEN}
WORKER_URL=${WORKER_URL}
HEALTH_PORT=3000
EOF
fi

# ── 4. Install service ──
echo "[4/4] Installing systemd service..."
cp apps/bridge/2d6mcp-bridge.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable 2d6mcp-bridge
systemctl restart 2d6mcp-bridge

# ── Done ──
echo ""
echo "=== Done ==="
echo "Status: $(systemctl is-active 2d6mcp-bridge)"
curl -s http://localhost:3000/health
echo ""
echo "Logs: journalctl -u 2d6mcp-bridge -f"
