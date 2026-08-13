# Aitzaz AI Pro — Full Setup Guide

Tested on macOS (Apple Silicon) with Hermes Agent v0.16. Allow ~1 hour.
Linux works the same (substitute systemd for launchd); Windows runs the
client/worker side.

## 0. What you get at the end

- A voice pipeline server that stays armed and **listens continuously**
  (server-side VAD — no Listen button, background noise ignored).
- A holographic HUD with the animated Aitzaz avatar (desktop browser,
  Electron app, or installed PWA on your phone).
- A desktop voice client (continuous mode by default).
- One persistent agent conversation shared by voice and typed chat.

## 1. Hermes Agent (the brain)

Install Hermes Agent and give it an LLM provider — follow the
[official quickstart](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart).
Verify `hermes` works in your terminal before continuing.

Enable its API server in `~/.hermes/.env`:

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=<long random secret>      # required — full toolset incl. terminal!
```

Start the gateway (`hermes gateway`) and verify:

```bash
KEY=$(grep '^API_SERVER_KEY=' ~/.hermes/.env | cut -d= -f2)
curl -H "Authorization: Bearer $KEY" http://127.0.0.1:8642/health
# {"status": "ok", ...}
```

Recommended: add voice-behavior rules to your global `~/.hermes/SOUL.md`
(short spoken sentences, no markdown aloud, never speak secrets, announce risky
actions and wait for approval). The agent — not the voice server — should own
its personality. Tell it its name is Aitzaz.

## 2. ElevenLabs (the voice)

Create an API key at elevenlabs.io and pick a voice from their library, noting
its `voice_id`. Add to `~/.hermes/.env`:

```bash
ELEVENLABS_API_KEY=...
```

For the HUD's quota bar, give the key the **User → Read** permission.

## 3. The voice pipeline server (this repo)

```bash
cd server
python3 -m venv .venv
.venv/bin/pip install -r ../requirements-server.txt
cp config/server.example.yaml config/server.yaml
```

Notes:

- `faster-whisper`, `silero-vad` and `torchaudio` are required — RealtimeSTT
  treats them as optional extras and fails at runtime without them (silently
  for VAD, loudly for the engine). The pinned `RealtimeSTT==0.3.104` is the
  line the pipeline's `feed_audio`/`perform_final_transcription` API comes
  from. First start takes 60–90 s (torch import + model download).
- Edit `config/server.yaml`: set `voice.voice_id`, and adjust or remove the
  `machines:` list. The first run downloads the Whisper model (~460 MB for
  `small.en`).
- `vad:` is the continuous-listening tuning section — defaults are good for
  most rooms; `engine: energy` if you don't want the torch stack.

### TLS certificates (required for browser microphone)

Browsers only expose the mic to secure origins:

```bash
scripts/make-certs.sh            # auto-detects your LAN IP for the SAN
```

Trust `certs/cert.pem` on each device (macOS: Keychain; Windows:
`certutil -user -addstore Root cert.pem`; iPhone: download
`https://host:8766/hud/aitzaz.cer`, install profile, then enable in
Settings → General → About → Certificate Trust Settings).

Optional but nice: rename your host's mDNS name (`sudo scutil --set
LocalHostName aitzaz` on macOS) so the HUD lives at
`https://aitzaz.local/hud/`. Port 443 needs the wildcard bind already set in
the example config.

### HUD access token

```bash
echo "AITZAZ_HUD_TOKEN=aitzaz-$(python3 -c 'import secrets;print(secrets.token_hex(3))')" >> ~/.hermes/.env
```

The HUD asks for this once per device. Omit the variable entirely to disable
auth (not recommended). `JARVIS_HUD_TOKEN` remains an accepted alias so the
bundled plugin/worker keep working unmodified.

### Boot greeting (one-time, ~110 ElevenLabs characters)

```bash
scripts/make-boot-audio.sh YourFirstName
```

### Run it

```bash
.venv/bin/python server.py
```

Wait ~40 s for the STT model to warm, then open `https://YOUR_HOST/hud/`.

**That's the whole startup experience**: boot sequence → avatar loads →
Aitzaz shows READY → the microphone arms itself → Aitzaz enters LISTENING
and announces it. Just speak. No Listen button exists.

Run `scripts/aitzaz-health.sh` to check all five services.

## 4. Desktop app

- **Windows**: edit `packaging/windows/install.bat` (server IP), run it —
  creates a venv + "Aitzaz Assistant" desktop shortcut (continuous voice
  client) and an "Aitzaz HUD" shortcut.
- **Linux**: `packaging/linux/install-desktop.sh` registers an app entry.
- **Electron app (all platforms)**: see `packaging/README.md` —
  `npm install && npm run dist` builds NSIS / DMG / AppImage installers.
- **macOS auto-start**: copy `launchd/com.aitzaz.voice.plist` and
  `launchd/com.aitzaz.dashboard.plist` to `~/Library/LaunchAgents/`, edit the
  placeholders, `launchctl bootstrap gui/$(id -u) ...`. Read the comments in
  the plists first — they encode TCC and FD-limit traps.

## 5. Phone (PWA install)

Open the HUD URL in your phone browser (trust the cert first — see above),
then **Add to Home Screen**. The HUD ships a web app manifest + service
worker, so it installs full-screen with the Aitzaz icon and keeps its shell
offline. Microphone permission is requested by the OS the first time Aitzaz
arms the mic — same consent flow as any app.

## 6. GPU STT worker (optional)

See `worker/stt_server.py` and `worker/run-stt.example.bat`. Point
`stt.remote.url` at the worker; the server falls back to local Whisper
automatically when it's off.

## 7. Verification

```bash
.venv/bin/python tests/test_vad.py               # VAD segmentation test
.venv/bin/python tests/test_ws_continuous.py     # conversation-loop e2e test
scripts/aitzaz-smoke.sh                          # live smoke: speaks "confirmed"
```
