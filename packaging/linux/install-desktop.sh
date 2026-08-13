#!/bin/bash
# Aitzaz AI Pro — Linux desktop integration (runs the local voice pipeline
# server and registers an application entry).
set -e
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Installing Aitzaz AI Pro desktop entry..."
sed "s|%APP_DIR%|$APP_DIR|g" packaging/linux/aitzaz.desktop > /tmp/aitzaz.desktop
mkdir -p ~/.local/share/applications ~/.local/share/icons
cp /tmp/aitzaz.desktop ~/.local/share/applications/aitzaz-ai-pro.desktop
cp packaging/desktop/icon.png ~/.local/share/icons/aitzaz-ai-pro.png
update-desktop-database ~/.local/share/applications 2>/dev/null || true
echo "Done. Find 'Aitzaz AI Pro' in your application menu."
echo "Note: the HUD opens at http://127.0.0.1:8765/hud/ (or https://<LAN-IP>/hud/ with certs)."
