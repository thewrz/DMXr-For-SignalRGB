#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/dmxr-server"
SERVICE_USER="dmxr"
SERVICE_NAME="dmxr"

if [[ $EUID -ne 0 ]]; then
    echo "ERROR: This script must be run as root (sudo)." >&2
    exit 1
fi

echo ""
echo "  Uninstalling DMXr Server..."
echo ""

# Stop and disable service
systemctl stop "$SERVICE_NAME" 2>/dev/null || true
systemctl disable "$SERVICE_NAME" 2>/dev/null || true
rm -f /etc/systemd/system/${SERVICE_NAME}.service
systemctl daemon-reload

echo "  Service stopped and removed."

# Prompt before removing install directory
read -rp "  Remove ${INSTALL_DIR} and all data? [y/N] " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
    rm -rf "$INSTALL_DIR"
    echo "  Removed ${INSTALL_DIR}"
fi

# Prompt before removing service user
read -rp "  Remove system user '${SERVICE_USER}'? [y/N] " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
    userdel "$SERVICE_USER" 2>/dev/null || true
    echo "  Removed user ${SERVICE_USER}"
fi

echo ""
echo "  DMXr Server uninstalled."
echo ""
