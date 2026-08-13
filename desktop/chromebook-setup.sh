#!/usr/bin/env bash
# Aitzaz AI Pro — one-command setup + build + install for Chromebook (Crostini).
# Usage (inside the Linux "Terminal" app):
#   sudo apt update && sudo apt install -y curl
#   curl -fsSL https://raw.githubusercontent.com/muhammadlai/Aitzaz-OS/main/desktop/chromebook-setup.sh | bash
set -euo pipefail

echo "==> Aitzaz AI Pro — Chromebook setup shuru"

# 1. base tools
echo "==> [1/5] Base tools install ho rahe hain (git, curl)..."
sudo apt update -y
sudo apt install -y git curl ca-certificates

# 2. Node.js 22
if command -v node >/dev/null 2>&1; then
  echo "==> [2/5] Node.js pehle se hai: $(node -v)"
else
  echo "==> [2/5] Node.js 22 install ho raha hai..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
fi

# 3. repo
REPO_DIR="$HOME/Aitzaz-OS"
if [ -d "$REPO_DIR/.git" ]; then
  echo "==> [3/5] Repo pehle se hai, update ho raha hai..."
  git -C "$REPO_DIR" pull --ff-only
else
  echo "==> [3/5] Aitzaz-OS download ho raha hai..."
  git clone https://github.com/muhammadlai/Aitzaz-OS.git "$REPO_DIR"
fi

# 4. build
cd "$REPO_DIR/desktop"
echo "==> [4/5] Dependencies + installer build (2-5 minute lagenge)..."
npm install
ARCH=$(dpkg --print-architecture)
if [ "$ARCH" = "arm64" ]; then
  echo "     architecture: arm64"
  npx electron-builder --linux --arm64
else
  echo "     architecture: amd64"
  npx electron-builder --linux --x64
fi

# 5. install the .deb
DEB=$(find "$REPO_DIR/desktop/release" -name "*.deb" | head -1)
if [ -z "$DEB" ]; then
  echo "!! .deb file nahi bani — build fail ho gaya." >&2
  exit 1
fi
echo "==> [5/5] Install ho raha hai: $DEB"
sudo apt install -y "$DEB"

echo ""
echo "=============================================================="
echo "  HO GAYA! App drawer ke 'Linux apps' folder mein"
echo "  'Aitzaz AI Pro' aa gaya hai. Kholo aur server ka address"
echo "  likho (jaise: https://192.168.1.20)."
echo "=============================================================="
