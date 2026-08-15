#!/bin/bash
# jarvis-doctor.sh — one-shot diagnostic for the whole Aitzaz voice chain (macOS).
#
# Checks BOTH directions end to end:
#   voice IN  : mic -> HUD/desktop app -> TLS cert trust -> ws 8765 -> STT -> Hermes
#   voice OUT : Hermes -> ElevenLabs API key/quota -> TTS -> HUD playback
#
# Run it on the Mac that hosts the voice pipeline server:
#   cd server && scripts/jarvis-doctor.sh
#
# Fix FAIL lines top to bottom, then re-run until everything is OK.

cd "$(dirname "$0")/.."

PASS=0; FAIL=0; WARN=0
ok(){   printf "  [ OK ] %s\n" "$1"; PASS=$((PASS+1)); }
bad(){  printf "  [FAIL] %s\n" "$1"; FAIL=$((FAIL+1)); }
warn(){ printf "  [WARN] %s\n" "$1"; WARN=$((WARN+1)); }
hint(){ printf "          fix -> %s\n" "$1"; }
section(){ printf "\n=== %s ===\n" "$1"; }

ENVF="$HOME/.hermes/.env"

# ---------------------------------------------------------------- 1. config
section "1. Voice server config (server/config/server.yaml)"
if [ -f config/server.yaml ]; then
  ok "config/server.yaml exists"
  VID=$(grep -E '^\s*voice_id:' config/server.yaml | head -1 | awk '{print $2}' | tr -d '"')
  if [ -z "$VID" ] || printf '%s' "$VID" | grep -qi 'YOUR_'; then
    bad "voice.voice_id not set (still the '$VID' placeholder)"
    hint "edit config/server.yaml -> voice.voice_id (paste your ElevenLabs voice id)"
  else
    ok "voice.voice_id configured"
  fi
  grep -qE '^\s*tls_ports:' config/server.yaml \
    && ok "TLS ports configured (required for mic)" \
    || warn "no tls_ports in server config (browser mic needs https)"
else
  bad "config/server.yaml MISSING — server.py exits immediately without it"
  hint "cp config/server.example.yaml config/server.yaml  (then set voice.voice_id)"
fi

# ------------------------------------------------------------ 2. env/secrets
section "2. Secrets (~/.hermes/.env)"
if [ -f "$ENVF" ]; then
  ok ".env file exists"
  grep -qE '^ELEVENLABS_API_KEY=.+' "$ENVF" \
    && ok "ELEVENLABS_API_KEY set (voice output)" \
    || { bad "ELEVENLABS_API_KEY missing — every reply dies with 'ElevenLabs API key not found'"; hint "add ELEVENLABS_API_KEY=... to ~/.hermes/.env (docs/SETUP.md §2)"; }
  grep -qE '^API_SERVER_KEY=.+' "$ENVF" \
    && ok "API_SERVER_KEY set (Hermes brain)" \
    || { bad "API_SERVER_KEY missing — 'Agent backend offline. Running in basic mode.'"; hint "add API_SERVER_KEY=... to ~/.hermes/.env (docs/SETUP.md §1)"; }
  grep -qE '^JARVIS_HUD_TOKEN=.+' "$ENVF" \
    && ok "JARVIS_HUD_TOKEN set (HUD auth)" \
    || warn "JARVIS_HUD_TOKEN not set (auth disabled — set it if the HUD asks for an access code)"
else
  bad "~/.hermes/.env missing — no secrets at all (voice output AND agent brain both dead)"
  hint "follow docs/SETUP.md §1-2, then restart the voice server"
fi

# ElevenLabs live check (valid key + remaining quota)
EKEY=$(grep -E '^ELEVENLABS_API_KEY=' "$ENVF" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
if [ -n "$EKEY" ]; then
  SUB=$(curl -s -m 10 -H "xi-api-key: $EKEY" https://api.elevenlabs.io/v1/user/subscription)
  if printf '%s' "$SUB" | grep -q 'character_limit'; then
    QUOTA=$(printf '%s' "$SUB" | python3 -c 'import json,sys
d=json.load(sys.stdin)
lim=d.get("character_limit"); used=d.get("character_count")
print(f"remaining {lim-used:,}/{lim:,} chars") if isinstance(lim,int) else print("quota ok")' 2>/dev/null)
    ok "ElevenLabs key valid — $QUOTA"
  else
    bad "ElevenLabs API rejected the key: $(printf '%s' "$SUB" | head -c 140)"
    hint "check the key at elevenlabs.io, or quota exhausted / network blocked"
  fi
fi

# ------------------------------------------------------- 3. services/ports
section "3. Services (what should be listening right now)"
listen(){ lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
port(){ if listen "$1"; then ok "port $1 listening  ($2)"; else bad "port $1 DOWN  ($2)"; fi; }
port 8765 "voice ws  (server.py)"
port 443  "HUD https (server.py TLS)"
port 8766 "HUD https alt"
port 9443 "dashboard TLS proxy"
port 9119 "hermes dashboard (loopback)"
HKEY=$(grep -E '^API_SERVER_KEY=' "$ENVF" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')
if curl -s -m 5 -H "Authorization: Bearer $HKEY" http://127.0.0.1:8642/health 2>/dev/null | grep -qi '"ok"'; then
  ok "Hermes API (8642) healthy"
else
  bad "Hermes API (8642) DOWN — the brain itself is offline"
  hint "start 'hermes gateway' (docs/SETUP.md §1)"
fi
if [ "$(uname)" = "Darwin" ]; then
  U="gui/$(id -u)"
  for s in com.jarvis.voice com.jarvis.dashboard; do
    OUT=$(launchctl print "$U/$s" 2>/dev/null)
    if printf '%s' "$OUT" | grep -q 'state = running'; then
      ok "launchd $s running"
    else
      EC=$(printf '%s' "$OUT" | grep 'last exit code' | awk '{print $NF}')
      bad "launchd $s not running (last exit code: ${EC:-not loaded})"
      hint "server/scripts/jarvis-start.sh  (and read the plist comments in launchd/)"
    fi
  done
fi

# -------------------------------------------- 4. voice-IN path (mic/TLS/TCC)
section "4. Mic path (voice IN) — TLS trust & macOS permission"
if [ -f certs/cert.pem ] && [ -f certs/key.pem ]; then
  ok "certs/cert.pem + key.pem exist"
  SAN=$(openssl x509 -in certs/cert.pem -noout -text 2>/dev/null | grep -A1 'Subject Alternative Name' | tail -1 | xargs)
  [ -n "$SAN" ] && ok "cert SAN: $SAN" || warn "cert has no SAN entry"
  if security verify-cert -c certs/cert.pem -p ssl >/dev/null 2>&1; then
    ok "cert trusted in this Mac's keychain (browser mic allowed)"
  else
    bad "cert NOT trusted — browsers/Electron refuse getUserMedia -> 'mic blocked'"
    hint "sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/cert.pem"
  fi
else
  bad "certs missing — HUD runs without TLS, so the mic will be blocked"
  hint "server/scripts/make-certs.sh"
fi

# macOS TCC (microphone permission) — best effort; reading TCC.db needs
# Full Disk Access granted to the Terminal app running this script.
if [ "$(uname)" = "Darwin" ]; then
  TCC="$HOME/Library/Application Support/com.apple.TCC/TCC.db"
  if [ -r "$TCC" ]; then
    MIC=$(sqlite3 "$TCC" "select client,auth_value from access where service='kTCCServiceMicrophone';" 2>/dev/null)
    if [ -n "$MIC" ]; then
      printf '%s\n' "$MIC" | while IFS='|' read -r client auth; do
        case "$auth" in
          2) ok "mic permission granted: $client" ;;
          0) bad "mic permission DENIED for $client"
              hint "System Settings > Privacy & Security > Microphone -> allow $client (then fully quit & reopen it)" ;;
          *) warn "mic permission unknown ($auth) for $client" ;;
        esac
      done
    else
      warn "no microphone entries in TCC db yet — your HUD app has never asked"
      hint "open the HUD once (or press the ring) and allow the microphone prompt"
    fi
  else
    warn "cannot read TCC db (unreadable) — grant this Terminal Full Disk Access to auto-check mic permission"
    hint "System Settings > Privacy & Security > Microphone — check your app/Chrome/Terminal is allowed"
  fi
fi

# ------------------------------------------------------------- 5. server log
section "5. Recent errors in the voice server log"
LOG="$HOME/Library/Logs/jarvis-voice.log"
if [ -f "$LOG" ]; then
  ERR=$(grep -iE 'error|traceback|exception|denied|not found|refused' "$LOG" | tail -4)
  if [ -n "$ERR" ]; then
    bad "recent errors found in $LOG:"
    printf '%s\n' "$ERR" | sed 's/^/          | /'
  else
    ok "no recent errors in jarvis-voice.log"
  fi
else
  warn "no ~/Library/Logs/jarvis-voice.log yet — the launchd agent may have never started"
fi

# --------------------------------------------------------------- 6. verdict
section "VERDICT"
printf "  PASS: %s   FAIL: %s   WARN: %s\n" "$PASS" "$FAIL" "$WARN"
if [ "$FAIL" -eq 0 ]; then
  cat <<'EOF'
  Everything on the host checks out. If voice still won't work:
    1. REBUILD the desktop app from this repo's latest code — the packaged Mac
       app needs NSMicrophoneUsageDescription or macOS silently blocks its mic.
    2. Fully quit + reopen the HUD app, then allow the microphone prompt.
    3. Full end-to-end test:  server/scripts/jarvis-smoke.sh
    4. Playback only test: open the HUD and type a message — a reply that
       appears as text but never as sound = ElevenLabs/TTS issue.
EOF
else
  cat <<'EOF'
  Fix the FAIL lines top to bottom, then re-run this script:
    1. server/scripts/jarvis-start.sh           (bring services up)
    2. tail -f ~/Library/Logs/jarvis-voice.log  (watch it boot)
    3. server/scripts/jarvis-doctor.sh          (re-check)
EOF
fi
