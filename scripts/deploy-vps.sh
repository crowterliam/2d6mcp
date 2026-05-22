#!/bin/bash
# 2d6mcp Bridge — one-command VPS setup (Ubuntu 22.04/24.04)
# Creates a dedicated bridge user and secures the service.
set -e

echo "=== 2d6mcp Bridge Setup ==="

# ── 1. Install deps ──
echo "[1/5] Installing Node.js 22..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
fi
apt-get install -y nodejs git

# ── 2. Create bridge user ──
echo "[2/5] Creating bridge user..."
if ! id bridge &>/dev/null; then
  useradd -r -s /bin/false -m -d /opt/2d6mcp bridge
fi
mkdir -p /opt/2d6mcp

# ── 3. Clone & build ──
echo "[3/5] Cloning and building..."
if [ -d /opt/2d6mcp/.git ]; then
  cd /opt/2d6mcp && git pull
else
  git clone https://github.com/crowterliam/2d6mcp.git /opt/2d6mcp
fi
cd /opt/2d6mcp
npm install
npm run build

# ── 4. Configure ──
echo "[4/5] Configuration..."
if [ ! -f apps/bridge/.env ]; then
  read -p "Discord Bot Token: " DISCORD_TOKEN
  read -p "Worker URL [https://2d6mcp.3ivkf0oy1.workers.dev]: " WORKER_URL
  WORKER_URL=${WORKER_URL:-https://2d6mcp.3ivkf0oy1.workers.dev}
  cat > apps/bridge/.env << ENVEOF
DISCORD_BOT_TOKEN=${DISCORD_TOKEN}
WORKER_URL=${WORKER_URL}
HEALTH_PORT=3000
ENVEOF
fi

# Set ownership
chown -R bridge:bridge /opt/2d6mcp

# ── 5. Install service ──
echo "[5/5] Installing systemd service..."
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
