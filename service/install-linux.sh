#!/usr/bin/env bash
set -euo pipefail

# DMXr Linux Service Installer (systemd)
# Run as root or with sudo

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="$SCRIPT_DIR/dmxr.service"
INSTALL_DIR="/opt/dmxr"

if [[ $EUID -ne 0 ]]; then
    echo "ERROR: This script must be run as root (or with sudo)."
    exit 1
fi

if [[ ! -f "$SERVICE_FILE" ]]; then
    echo "ERROR: dmxr.service not found at $SERVICE_FILE"
    exit 1
fi

echo "=== DMXr Service Installer ==="

# Create system user (no login shell, in dialout group for serial access)
if ! id -u dmxr &>/dev/null; then
    echo "Creating system user 'dmxr' in group 'dialout'..."
    useradd --system --no-create-home --shell /usr/sbin/nologin --groups dialout dmxr
else
    echo "User 'dmxr' already exists, ensuring dialout group membership..."
    usermod -aG dialout dmxr
fi

# Create install directory
echo "Setting up $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR/server/config" "$INSTALL_DIR/server/logs"
chown -R dmxr:dmxr "$INSTALL_DIR"

# Create env override directory
mkdir -p /etc/dmxr
if [[ ! -f /etc/dmxr/dmxr.env ]]; then
    cat > /etc/dmxr/dmxr.env <<'EOF'
# DMXr environment overrides
# Uncomment and edit as needed:
# PORT=8080
# HOST=0.0.0.0
# DMX_DRIVER=enttec-usb-dmx-pro
# DMX_DEVICE_PATH=/dev/ttyUSB0
# LOG_LEVEL=info
EOF
    echo "Created /etc/dmxr/dmxr.env (edit to configure)"
fi

# Install systemd unit
echo "Installing systemd service..."
cp "$SERVICE_FILE" /etc/systemd/system/dmxr.service
systemctl daemon-reload
systemctl enable dmxr.service

echo ""
echo "=== Installation complete ==="
echo ""
echo "Next steps:"
echo "  1. Copy your built server to $INSTALL_DIR/server/"
echo "  2. Edit /etc/dmxr/dmxr.env for your hardware config"
echo "  3. Start:  systemctl start dmxr"
echo "  4. Status: systemctl status dmxr"
echo "  5. Logs:   journalctl -u dmxr -f"
echo ""
