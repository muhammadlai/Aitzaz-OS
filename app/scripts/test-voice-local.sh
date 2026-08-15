#!/usr/bin/env bash
#
# Local voice-pipeline verification for Aitzaz AI Pro (run on YOUR machine).
#
# Tests the REAL chain the desktop app uses for local TTS:
#   build Go backend -> start it -> /api/health -> /api/tts/voices
#   -> /api/tts/synthesize (Piper, downloads piper binary + voice on first use)
#   -> validate WAV header -> save a playable WAV you can listen to.
#
# Requirements: Go 1.23+, Node 22+, curl. Network access to GitHub/HuggingFace
# (first run downloads the Piper binary ~30MB and the voice model ~60MB).
#
# Usage:
#   cd app
#   bash scripts/test-voice-local.sh [voice-name] [text]
#
set -euo pipefail

VOICE="${1:-en_US-amy-medium}"
TEXT="${2:-Hello! I am Aitzaz, your desktop AI assistant. My voice pipeline is working.}"
PORT="${PORT:-8899}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT/resources/backend"
BACKEND_BIN="$BACKEND_DIR/alice-backend"
OUT_WAV="$ROOT/voice-test-output.wav"

echo "[voice-test] Step 1/5: building Go backend..."
if [ ! -x "$BACKEND_BIN" ]; then
  (cd "$ROOT/backend" && go build -ldflags="-s -w" -o "$BACKEND_BIN")
fi
echo "[voice-test] backend binary: $BACKEND_BIN"

echo "[voice-test] Step 2/5: starting backend on port $PORT..."
PORT="$PORT" ENABLE_STT=true ENABLE_TTS=true ENABLE_EMBEDDINGS=false \
PIPER_MODEL_PATH="$BACKEND_DIR/models/piper" \
WHISPER_MODEL_PATH="$BACKEND_DIR/models/whisper-base.bin" \
MINILM_MODEL_PATH="$BACKEND_DIR/models/minilm" \
  "$BACKEND_BIN" > /tmp/aitzaz-voice-test.log 2>&1 &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT

for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$PORT/api/health" > /tmp/aitzaz-health.json; then break; fi
  sleep 2
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "[voice-test] FAILED: backend exited early:"; cat /tmp/aitzaz-voice-test.log; exit 1
  fi
done
curl -sf "http://127.0.0.1:$PORT/api/health" | head -c 300; echo
echo "[voice-test] health OK"

echo "[voice-test] Step 3/5: listing voices..."
curl -sf "http://127.0.0.1:$PORT/api/tts/voices" | head -c 200; echo "..."

echo "[voice-test] Step 4/5: synthesizing (voice=$VOICE)..."
echo "[voice-test] text: \"$TEXT\""
RESPONSE_FILE="$(mktemp)"
curl -sf -X POST "http://127.0.0.1:$PORT/api/tts/synthesize" \
  -H 'Content-Type: application/json' \
  --max-time 900 \
  -d "{\"text\": $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$TEXT"), \"voice\": \"$VOICE\", \"speed\": 1.0}" \
  -o "$RESPONSE_FILE"

echo "[voice-test] Step 5/5: validating WAV and extracting audio..."
node -e "
const fs = require('fs');
const body = JSON.parse(fs.readFileSync('$RESPONSE_FILE', 'utf8'));
if (!body.success) { console.error('[voice-test] FAILED:', body.error); process.exit(1); }
const audio = body.data.audio;
if (!Array.isArray(audio) || audio.length < 10000) {
  console.error('[voice-test] FAILED: too little audio:', audio?.length);
  process.exit(1);
}
const bytes = Buffer.from(audio);
if (bytes.slice(0, 4).toString() !== 'RIFF' || bytes.slice(8, 12).toString() !== 'WAVE') {
  console.error('[voice-test] FAILED: not a WAV file');
  process.exit(1);
}
const sampleRate = bytes.readUInt32LE(24);
const seconds = (bytes.length - 44) / (sampleRate * 2);
fs.writeFileSync('$OUT_WAV', bytes);
console.log('[voice-test] WAV valid: sample_rate=' + sampleRate + 'Hz, bytes=' + bytes.length + ', duration~' + seconds.toFixed(1) + 's');
if (seconds < 0.5) { console.error('[voice-test] FAILED: audio too short to be speech'); process.exit(1); }
"
rm -f "$RESPONSE_FILE"

echo ""
echo "[voice-test] RESULT: PASS"
echo "[voice-test] Play this file to HEAR the assistant voice:"
echo "[voice-test]   $OUT_WAV"
echo "[voice-test] e.g.:  aplay \"$OUT_WAV\"   (or open in any audio player)"
