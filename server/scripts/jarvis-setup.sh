#!/bin/bash
# jarvis-setup.sh — one-command installer for the Aitzaz voice pipeline.
#
# Usage (on the Mac that will run the voice server):
#     cd server && scripts/jarvis-setup.sh
#     scripts/jarvis-setup.sh --elevenlabs-key YOUR_KEY   # skip the prompt
#     scripts/jarvis-setup.sh --voice-id YOUR_VOICE_ID    # pick a voice
#
# What it does (idempotent — safe to re-run any time):
#   1. Python venv + all dependencies (requirements.txt)
#   2. config/server.yaml (auto-created from the example; default voice works)
#   3. Self-signed TLS cert for the HUD (auto-trusted on macOS)
#   4. Secrets in ~/.hermes/.env (HUD access code + Hermes keys generated)
#   5. launchd auto-start (macOS)
#   6. Full health check via scripts/jarvis-doctor.sh
#
# macOS is the primary target; on Linux it prepares everything and prints
# manual start instructions instead of installing launchd agents.

set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"

DARWIN=false
[ "$(uname)" = "Darwin" ] && DARWIN=true

say(){ printf "\n==> %s\n" "$*"; }
ok(){ printf "    [OK] %s\n" "$*"; }
warn(){ printf "    [!] %s\n" "$*"; }
die(){ printf "ERROR: %s\n" "$*" >&2; exit 1; }

# ---------------------------------------------------------------- options
VOICE_ID=""
EKEY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --voice-id) VOICE_ID="$2"; shift 2 ;;
    --elevenlabs-key) EKEY="$2"; shift 2 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
done

command -v python3 >/dev/null || die "python3 not found. On macOS run: xcode-select --install"

case "$ROOT" in
  /Volumes/*) warn "repo lives on an external volume — macOS TCC can block the launchd service from there. Move the repo into your home folder if the service won't start." ;;
esac

# --------------------------------------------------------- 1. python env
say "Step 1/6 — Python environment (.venv)"
if [ -x .venv/bin/python ]; then
  ok "venv already present"
else
  python3 -m venv .venv || die "could not create .venv"
  ok "venv created"
fi
if [ "${JARVIS_SETUP_SKIP_PIP:-0}" = "1" ]; then
  warn "JARVIS_SETUP_SKIP_PIP=1 — skipping dependency install (advanced)"
elif .venv/bin/python -m pip install --quiet --upgrade pip \
     && .venv/bin/python -m pip install --quiet -r requirements.txt; then
  ok "dependencies installed (first run downloads the STT model on first start)"
else
  die "pip install failed — see the error above"
fi

# ------------------------------------------------------------- 2. config
say "Step 2/6 — Config (config/server.yaml)"
if [ -f config/server.yaml ]; then
  ok "config/server.yaml exists (kept as-is)"
else
  cp config/server.example.yaml config/server.yaml || die "copy failed"
  ok "config/server.yaml created from the example (default voice: Adam)"
fi
if [ -n "$VOICE_ID" ]; then
  .venv/bin/python - "$VOICE_ID" <<'PY' || warn "could not set voice_id (edit config/server.yaml by hand)"
import sys, yaml
p = "config/server.yaml"
d = yaml.safe_load(open(p, encoding="utf-8")) or {}
d.setdefault("voice", {})["voice_id"] = sys.argv[1]
open(p, "w", encoding="utf-8").write(yaml.safe_dump(d, sort_keys=False, allow_unicode=True))
PY
  ok "voice.voice_id set to $VOICE_ID"
fi

# ------------------------------------------------------------- 3. certs
say "Step 3/6 — TLS certificate (browser mic requires https)"
if [ -f certs/cert.pem ] && [ -f certs/key.pem ]; then
  ok "certs already exist"
else
  command -v openssl >/dev/null || die "openssl not found"
  # invoke via bash so a missing +x bit can never break a fresh clone
  if bash scripts/make-certs.sh >/dev/null 2>&1; then
    ok "certificate generated"
  else
    die "cert generation failed — run: bash scripts/make-certs.sh"
  fi
fi
if $DARWIN; then
  if security verify-cert -c certs/cert.pem -p ssl >/dev/null 2>&1; then
    ok "certificate already trusted"
  elif security add-trusted-cert -d -r trustRoot -k "$HOME/Library/Keychains/login.keychain-db" certs/cert.pem >/dev/null 2>&1; then
    ok "certificate trusted (login keychain)"
  else
    warn "could not auto-trust the certificate"
    warn "  manual: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/cert.pem"
  fi
fi

# ------------------------------------------------------------ 4. secrets
say "Step 4/6 — Secrets (~/.hermes/.env)"
ENVF="$HOME/.hermes/.env"
mkdir -p "$HOME/.hermes"
[ -f "$ENVF" ] || touch "$ENVF"
have(){ grep -qE "^$1=.+" "$ENVF"; }
add(){ grep -qE "^$1=" "$ENVF" || echo "$1=$2" >> "$ENVF"; }
HUD_CODE=""
HERMES_NEEDS_RESTART=0

if have JARVIS_HUD_TOKEN; then
  ok "JARVIS_HUD_TOKEN already set"
else
  HUD_CODE="aitzaz-$(python3 -c 'import secrets;print(secrets.token_hex(4))')"
  add JARVIS_HUD_TOKEN "$HUD_CODE"
  ok "JARVIS_HUD_TOKEN generated (HUD access code)"
fi

if command -v hermes >/dev/null 2>&1 || [ -x "$HOME/.hermes/hermes-agent/venv/bin/hermes" ]; then
  add API_SERVER_ENABLED true
  if have API_SERVER_KEY; then
    ok "API_SERVER_KEY already set"
  else
    add API_SERVER_KEY "$(python3 -c 'import secrets;print(secrets.token_hex(24))')"
    ok "API_SERVER_KEY generated"
    HERMES_NEEDS_RESTART=1
  fi
else
  warn "hermes not installed on this machine — the agent brain stays offline until then"
  warn "  install: https://hermes-agent.nousresearch.com/docs/getting-started/quickstart"
fi

if have ELEVENLABS_API_KEY; then
  ok "ELEVENLABS_API_KEY already set (voice output enabled)"
elif [ -n "$EKEY" ]; then
  add ELEVENLABS_API_KEY "$EKEY"
  ok "ELEVENLABS_API_KEY saved (voice output enabled)"
elif [ -t 0 ]; then
  printf "    Paste your ElevenLabs API key (elevenlabs.io -> Profile -> API Keys),\n    or press Enter to skip (voice output stays silent until you add it): "
  read -r ANS || true
  if [ -n "$ANS" ]; then
    add ELEVENLABS_API_KEY "$ANS"
    ok "ELEVENLABS_API_KEY saved"
  else
    warn "skipped — add it any time with: scripts/jarvis-setup.sh --elevenlabs-key YOUR_KEY"
  fi
else
  warn "no ELEVENLABS_API_KEY and no terminal to ask — add it later:"
  warn "  scripts/jarvis-setup.sh --elevenlabs-key YOUR_KEY"
fi

# ----------------------------------------------------------- 5. launchd
say "Step 5/6 — Auto-start"
if $DARWIN; then
  AGENTS="$HOME/Library/LaunchAgents"
  mkdir -p "$AGENTS"
  HOME_ESC=${HOME//&/\\&}
  sed -e "s|/PATH/TO/voice-pipeline/.venv/bin/python|$ROOT/.venv/bin/python|" \
      -e "s|/PATH/TO/voice-pipeline/server.py|$ROOT/server.py|" \
      -e "s|/Users/YOUR_USER|$HOME_ESC|g" \
      launchd/com.jarvis.voice.plist > "$AGENTS/com.jarvis.voice.plist"
  UID_GUI="gui/$(id -u)"
  launchctl bootout "$UID_GUI/com.jarvis.voice" 2>/dev/null
  if launchctl bootstrap "$UID_GUI" "$AGENTS/com.jarvis.voice.plist" 2>/dev/null; then
    ok "voice service installed (auto-starts on boot; STT model warms ~40s)"
  else
    warn "launchctl bootstrap failed — start manually: .venv/bin/python server.py"
  fi
  if [ -x "$HOME/.hermes/hermes-agent/venv/bin/hermes" ]; then
    sed -e "s|/Users/YOUR_USER/.hermes/hermes-agent/venv/bin/hermes|$HOME_ESC/.hermes/hermes-agent/venv/bin/hermes|" \
        -e "s|/Users/YOUR_USER|$HOME_ESC|g" \
        launchd/com.jarvis.dashboard.plist > "$AGENTS/com.jarvis.dashboard.plist"
    launchctl bootout "$UID_GUI/com.jarvis.dashboard" 2>/dev/null
    launchctl bootstrap "$UID_GUI" "$AGENTS/com.jarvis.dashboard.plist" 2>/dev/null \
      && ok "dashboard service installed" || warn "dashboard service failed to install"
  fi
else
  warn "not macOS — skipping launchd. Start manually:"
  warn "  .venv/bin/python server.py"
fi

# -------------------------------------------------------------- 6. check
say "Step 6/6 — Health check (this may show FAILs until the server warms up)"
if [ -f scripts/jarvis-doctor.sh ]; then
  bash scripts/jarvis-doctor.sh || true
fi

# -------------------------------------------------------------- summary
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
[ -n "$LAN_IP" ] || LAN_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++)if($i=="src"){print $(i+1);exit}}')"
[ -n "$LAN_IP" ] || LAN_IP="127.0.0.1"
CODE="${HUD_CODE:-$(grep -E '^JARVIS_HUD_TOKEN=' "$ENVF" 2>/dev/null | head -1 | cut -d= -f2-)}"

cat <<EOF

===========================================================================
  AITZAZ VOICE PIPELINE — SETUP COMPLETE
===========================================================================
  HUD:          https://$LAN_IP/hud/   (or https://jarvis.local/hud/)
  Access code:  $CODE   (asked once per device; stored in ~/.hermes/.env)
---------------------------------------------------------------------------
  Next steps
    * If you added Hermes keys: restart the hermes gateway once.
    * Voice output: add an ElevenLabs key if you skipped it:
        scripts/jarvis-setup.sh --elevenlabs-key YOUR_KEY
    * Re-check anytime:  scripts/jarvis-doctor.sh
    * Restart voice:     scripts/jarvis-restart.sh
    * Watch it boot:     tail -f ~/Library/Logs/jarvis-voice.log
===========================================================================
EOF
