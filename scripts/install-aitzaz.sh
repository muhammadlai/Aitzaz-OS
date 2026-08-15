#!/usr/bin/env bash
#
# One-line installer/upgrader for Aitzaz AI Pro (Linux amd64 .deb).
#
#   curl -fsSL https://raw.githubusercontent.com/muhammadlai/Aitzaz-OS/v1.1.6/scripts/install-aitzaz.sh | bash
#
# It downloads the latest release .deb, verifies its SHA-256 against the
# GitHub release metadata, removes any old install, installs the new one and
# reports the installed version. User data (login session + API keys) lives
# in ~/.config/aitzaz-ai-pro and is preserved.
set -euo pipefail

REPO="muhammadlai/Aitzaz-OS"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "==> Fetching latest release info..."
META="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest")"

DEB_INFO="$(echo "$META" | python3 -c '
import json,sys
meta = json.load(sys.stdin)
for a in meta.get("assets", []):
    if a["name"].endswith("-amd64.deb"):
        print(a["browser_download_url"], a["size"], a.get("digest","").replace("sha256:",""))
        break
')"
URL="$(echo "$DEB_INFO" | awk '{print $1}')"
SIZE="$(echo "$DEB_INFO" | awk '{print $2}')"
SHA="$(echo "$DEB_INFO" | awk '{print $3}')"

if [ -z "$URL" ]; then
  echo "ERROR: no .deb asset found in the latest release." >&2
  exit 1
fi
echo "==> Latest release asset: $(basename "$URL") (${SIZE} bytes)"

DEB="$WORK/$(basename "$URL")"
echo "==> Downloading (this is ~500MB, may take a while)..."
curl -fL --retry 4 --retry-all-errors -C - -o "$DEB" "$URL"

ACTUAL_SIZE="$(stat -c %s "$DEB")"
if [ "$ACTUAL_SIZE" != "$SIZE" ]; then
  echo "ERROR: size mismatch (got $ACTUAL_SIZE, want $SIZE). Download incomplete." >&2
  exit 1
fi

if [ -n "$SHA" ]; then
  echo "==> Verifying SHA-256..."
  ACTUAL_SHA="$(sha256sum "$DEB" | awk '{print $1}')"
  if [ "$ACTUAL_SHA" != "$SHA" ]; then
    echo "ERROR: checksum mismatch!" >&2
    echo "  got:  $ACTUAL_SHA" >&2
    echo "  want: $SHA" >&2
    exit 1
  fi
  echo "==> Checksum OK"
fi

echo "==> Removing old installation (user data is preserved)..."
sudo apt remove -y aitzaz-ai-pro 2>/dev/null || true

echo "==> Installing..."
sudo dpkg -i "$DEB"
sudo apt -f install -y

echo "==> Optional: emoji font for status icons..."
sudo apt install -y fonts-noto-color-emoji 2>/dev/null || true

echo ""
echo "======================================================"
INSTALLED="$(dpkg -s aitzaz-ai-pro 2>/dev/null | grep '^Version:' || echo 'Version: NOT INSTALLED')"
echo "Installed: $INSTALLED"
echo ""
echo "Ab app ko TERMINAL se kholo:"
echo "    aitzaz-ai-pro"
echo ""
echo "Terminal mein ye line aani chahiye:"
echo "    [BackendManager] Go AI backend is ready"
echo "Phir 'Hello Aitzaz' likho -> jawab + awaz aayegi."
echo "======================================================"
