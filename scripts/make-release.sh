#!/usr/bin/env bash
# =============================================================================
# Aitzaz AI Pro — release installer builder (run on YOUR machine, no CI needed)
#
# Builds the Aitzaz AI Pro desktop app (app/) into installers and creates/updates
# a GitHub Release with them attached. This works even when the GitHub Actions
# workflow cannot be pushed (no 'Workflows' permission).
#
# Prereqs (on your machine):
#   - Node >= 22          (node -v)
#   - Go >= 1.24          (go version)
#   - gh CLI, logged in   (gh auth status)
#   - A working network (to npm ci + download Go/whisper/ffmpeg/piper deps)
#
# Usage:
#   ./scripts/make-release.sh 1.0.0
#   ./scripts/make-release.sh 1.0.0 --target x64   # build only your arch
#
# The tag is created (if missing), pushed, then installers are built and
# uploaded to the GitHub Release for that tag.
# =============================================================================
set -euo pipefail

VERSION="${1:?Usage: $0 <version> [--target x64|arm64]}"
TARGET="${2:-all}"

cd "$(dirname "$0")/.."   # repo root
APP_DIR="$PWD/app"
VER_TAG="v${VERSION}"

command -v node >/dev/null || { echo "ERROR: node >= 22 required"; exit 1; }
command -v go   >/dev/null || { echo "ERROR: go >= 1.24 required"; exit 1; }
command -v gh   >/dev/null || { echo "ERROR: gh CLI required (gh auth status)"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: not logged into gh"; exit 1; }

echo "==> Aitzaz AI Pro release: v${VERSION} (target=${TARGET})"

# 1. Tag + push (so the release links to a real ref)
if ! git rev-parse "${VER_TAG}" >/dev/null 2>&1; then
  echo "==> Creating tag ${VER_TAG}"
  git tag "${VER_TAG}"
fi
echo "==> Pushing tag ${VER_TAG}"
git push origin "${VER_TAG}"

# 2. Ensure version is set in package.json (bump if needed)
CUR="$(node -p "require('${APP_DIR}/package.json').version")"
if [ "${CUR}" != "${VERSION}" ]; then
  echo "==> Bumping app version ${CUR} -> ${VERSION}"
  node -e "const fs=require('fs');const p='${APP_DIR}/package.json';const d=JSON.parse(fs.readFileSync(p));d.version='${VERSION}';fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n')"
  node -e "const fs=require('fs');const p='${APP_DIR}/package-lock.json';const d=JSON.parse(fs.readFileSync(p));d.version='${VERSION}';if(d.packages&&d.packages[''])d.packages[''].version='${VERSION}';fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n')"
fi

# 3. Install + prep
echo "==> Installing dependencies (npm ci)"
(cd "${APP_DIR}" && npm ci)

echo "==> Creating empty Google OAuth config (fill real creds later in app-config.json)"
if [ ! -f "${APP_DIR}/app-config.json" ]; then
  echo '{"VITE_GOOGLE_CLIENT_ID":"","VITE_GOOGLE_CLIENT_SECRET":""}' > "${APP_DIR}/app-config.json"
fi

# 4. Rebuild native modules for Electron + build everything
echo "==> Rebuilding native modules for Electron"
(cd "${APP_DIR}" && npm run rebuild)

echo "==> Building installers (Go backend + Vite + electron-builder)"
(cd "${APP_DIR}" && npx electron-builder --publish never)

# 5. Collect artifacts
ARTIFACTS_DIR="${APP_DIR}/dist-artifacts"
rm -rf "${ARTIFACTS_DIR}" && mkdir -p "${ARTIFACTS_DIR}"
echo "==> Collecting artifacts"
find "${APP_DIR}/release" -type f \( -name '*.exe' -o -name '*.dmg' -o -name '*.deb' -o -name '*.AppImage' \) -exec cp {} "${ARTIFACTS_DIR}/" \;
echo "--- Artifacts: ---"
ls -la "${ARTIFACTS_DIR}"

# 6. Create/update the GitHub Release + upload
if gh release view "${VER_TAG}" >/dev/null 2>&1; then
  echo "==> Release ${VER_TAG} exists; uploading artifacts"
  gh release upload "${VER_TAG}" "${ARTIFACTS_DIR}"/* --clobber
else
  echo "==> Creating release ${VER_TAG}"
  gh release create "${VER_TAG}" \
    "${ARTIFACTS_DIR}"/* \
    --title "Aitzaz AI Pro ${VER_TAG}" \
    --generate-notes
fi

echo ""
echo "✅ Done! Release: https://github.com/muhammadlai/Aitzaz-OS/releases/tag/${VER_TAG}"
