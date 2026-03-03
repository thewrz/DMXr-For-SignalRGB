#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/dmxr-server"
SERVICE_USER="dmxr"
SERVICE_NAME="dmxr"

if [[ $EUID -ne 0 ]]; then
    echo "ERROR: This script must be run as root (sudo)." >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "  Installing DMXr Server to ${INSTALL_DIR}..."
echo ""

# Create service user (no login shell, no home directory)
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
    echo "  Created system user: ${SERVICE_USER}"
fi

# Add to dialout group for serial port access (ENTTEC USB)
usermod -aG dialout "$SERVICE_USER"

# Copy distribution files
mkdir -p "$INSTALL_DIR"
cp -r "$SCRIPT_DIR"/{node,dist,node_modules,public,package.json} "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/node"

# Create config directory for persistent settings
mkdir -p "$INSTALL_DIR/config"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# Write systemd unit file
cat > /etc/systemd/system/${SERVICE_NAME}.service <<'UNIT'
[Unit]
Description=DMXr Server - SignalRGB DMX Bridge
After=network.target

[Service]
Type=simple
User=dmxr
Group=dmxr
WorkingDirectory=/opt/dmxr-server
ExecStart=/opt/dmxr-server/node dist/index.js
Restart=on-failure
RestartSec=5
Environment=HOST=0.0.0.0
Environment=NODE_ENV=production

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/dmxr-server/config
ProtectHome=true
PrivateTmp=true

# Serial port access
SupplementaryGroups=dialout

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"

echo ""
echo "  DMXr Server installed and started."
echo "  Web Manager: http://${LOCAL_IP}:8080"
echo ""
echo "  Status:  sudo systemctl status ${SERVICE_NAME}"
echo "  Logs:    sudo journalctl -u ${SERVICE_NAME} -f"
echo "  Stop:    sudo systemctl stop ${SERVICE_NAME}"
echo "  Restart: sudo systemctl restart ${SERVICE_NAME}"
echo ""
