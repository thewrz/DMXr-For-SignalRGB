#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -x "./node" ]]; then
    echo "ERROR: ./node not found or not executable." >&2
    echo "Re-download from: https://github.com/thewrz/DMXr/releases/latest" >&2
    exit 1
fi

if [[ ! -f "dist/index.js" ]]; then
    echo "ERROR: dist/index.js not found." >&2
    echo "Re-download from: https://github.com/thewrz/DMXr/releases/latest" >&2
    exit 1
fi

export HOST="${HOST:-0.0.0.0}"

echo ""
echo "  DMXr Server starting..."
echo "  Web Manager: http://localhost:8080"
echo "  Press Ctrl+C to stop."
echo ""

exec ./node dist/index.js
