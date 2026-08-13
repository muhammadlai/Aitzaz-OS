# Aitzaz AI Pro

**A personal desktop & mobile AI assistant. Always listening — no Listen button.**

Aitzaz AI Pro is an installable, self-hosted voice assistant: you launch it,
it arms the microphone by itself, and you just talk. It detects speech with
on-device voice activity detection, transcribes locally (Whisper), thinks with
a real agent brain (Hermes Agent — terminal access, web search, files, memory),
and answers aloud through a holographic animated avatar. Then it goes back to
listening. Again and again — the full conversation loop, hands-free.

```
 Launch Aitzaz ──► boot & avatar ──► READY ──► LISTEN ──► speech detected
      ▲                                                     │
      │                                            speech → text (local STT)
      │                                                     │
      └── avatar speaking ◄── text → voice ◄── AI brain (Hermes Agent)
```

Everything runs on **your own hardware**; the only cloud calls are your LLM
provider (via Hermes Agent) and ElevenLabs for the voice.

> This project is a continuation/rebranding of
> [jarvis_ai](https://github.com/eadmin2/jarvis_ai) (MIT © Chris Lassiter),
> built on [Hermes Agent](https://github.com/NousResearch/hermes-agent) by
> Nous Research. The original architecture, voice pipeline, HUD and tools are
> preserved and extended — see [NOTICE.md](NOTICE.md).

---

## What it does

- **Automatic continuous listening** — no "click to listen", no wake-word
  gymnastics. On startup Aitzaz initializes, shows a ready state, and enters
  LISTEN by itself. Server-side Silero VAD (with a dependency-free energy
  fallback) detects when you begin and stop speaking; background noise is
  ignored. After every answer it returns to LISTEN automatically.
- **Real conversation loop** — speech → text → agent → voice → avatar
  speaking → back to listening, until you explicitly pause or stop it.
- **Live avatar** — a holographic avatar that stays visible while Aitzaz is
  active and animates through every state: idle, listening (mic-level aware),
  speech detected, thinking/processing, speaking (voice-synced mouth), plus
  paused / mic-off / error. Swap-in your own avatar via a documented contract
  (`server/hud/avatar/README.md`).
- **A real agent brain** — Hermes Agent does things: reads/writes files, runs
  commands (with ALLOW/DENY approval cards), searches the web, remembers you
  across sessions. Typed chat and voice share one persistent conversation.
- **Holographic media panels** — say *"show me how arc reactors work, on
  screen"* and the agent summons a video panel on the HUD (Hermes plugin).
- **Full HUD control center** — live tool activity, STOP, approval cards,
  usage meters, machines panel, pop-up dashboards, cinematic boot.
- **Privacy-first mic handling** — mic audio is processed in RAM only: a short
  pre-roll ring buffer (≈350 ms) while armed, the current utterance while
  transcribing, then discarded. Nothing is recorded, stored or uploaded.
  Always-visible state indicator: **LISTENING / SPEECH / PROCESSING /
  SPEAKING / PAUSED / MIC OFF**, plus PAUSE and MIC OFF buttons and the OS's
  own microphone permission flow.
- **Installable** — desktop app via Electron/NSIS/AppImage/DMG or the Python
  client; on your phone the HUD installs as a full-screen PWA
  (Add to Home Screen). One server core serves every platform.

## Screens / layout

The HUD is the arc-reactor control center from the original project with the
Aitzaz avatar at its core: left column (voice link + listening state, agent
activity, turn metrics, views, session), center (avatar, transcript feed,
chat), right column (models loadout, machines, skills, diagnostics,
automations).

## Architecture

```
 Browser HUD / desktop app / PWA (any LAN device)
 ── wss/https :8766 ───────┐
                           ├──► voice pipeline server (this repo)
 Python desktop client     │      STT: faster-whisper (local)      ┌─────────────────┐
 ── ws :8765 ──────────────┘      VAD: silero (local, continuous)  ├──► Hermes Agent │
                                  TTS: ElevenLabs Flash (streaming)│    API :8642     │
                                  HUD + auth + dashboard TLS proxy └─────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full WebSocket
protocol (including the continuous-listening extensions), endpoints, and
platform abstraction notes.

## Repository layout

```
server/            FastAPI voice pipeline + HUD (the core; unchanged parts kept from jarvis_ai)
  server.py          pipeline server — sessions, stop, approvals, partials + continuous listening
  vad.py             always-on voice activity detection (silero / energy engines)
  hud/               single-file HUD (vanilla JS) + avatar system + PWA (installable on phones)
  config/            server.example.yaml (vad:, listening:, assistant: sections)
  scripts/           aitzaz-*.sh start/stop/health/smoke + cert & boot-audio generators
core/              platform-agnostic assistant core (identity, states, protocol constants)
client/            desktop voice client (continuous mode by default; wake-word & PTT kept)
worker/            optional GPU sidecars (big-model STT + machines panel stats)
hermes-plugin/     Hermes tool plugin — the agent summons/dismisses HUD media panels
launchd/           macOS auto-start templates (hard-won TCC + FD-limit notes)
packaging/         desktop packaging: Electron app, Windows install.bat, Linux desktop entry
docs/              SETUP, ARCHITECTURE (protocols), MOBILE, plus the original guides
tests/             VAD unit tests + end-to-end continuous-listening protocol test
```

## Requirements

- **Server machine** (macOS tested; Linux fine — launchd → systemd): Python 3.11+,
  [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) installed with an
  LLM provider, and an [ElevenLabs](https://elevenlabs.io) API key.
- **Desktop**: any modern OS — Electron app, or Python client.
- **Phone**: any modern browser (PWA install).

## Installation

Full walkthrough in [docs/SETUP.md](docs/SETUP.md). Short version:

```bash
# 1. Enable the Hermes Agent API server
cat >> ~/.hermes/.env <<EOF
API_SERVER_ENABLED=true
API_SERVER_KEY=$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')
AITZAZ_HUD_TOKEN=$(python3 -c 'print("aitzaz-"+secrets.token_hex(3))')
ELEVENLABS_API_KEY=your-key-here
EOF
hermes gateway   # or set up its LaunchAgent / service

# 2. This repo
git clone <this-repo-url> aitzaz-ai-pro && cd aitzaz-ai-pro/server
python3 -m venv .venv
.venv/bin/pip install -r ../requirements-server.txt
cp config/server.example.yaml config/server.yaml   # edit: your ElevenLabs voice_id etc.
scripts/make-certs.sh                              # self-signed TLS (browser mic needs it)
scripts/make-boot-audio.sh YourName                # one-time boot greeting synthesis

# 3. Run
.venv/bin/python server.py
# open https://YOUR_HOST/hud/ → accept cert → enter your AITZAZ_HUD_TOKEN
# Aitzaz boots, arms the mic, and starts listening — just talk.
```

**Desktop app**: `packaging/windows/install.bat` (Windows),
`packaging/linux/install-desktop.sh` (Linux), or build the Electron app
(`packaging/desktop`, see `packaging/README.md`). macOS auto-start:
`launchd/com.aitzaz.voice.plist`.

**Phone**: open the HUD URL, *Add to Home Screen* — the HUD is a PWA
(manifest + service worker) and installs full-screen with the Aitzaz icon.

## Using Aitzaz

| Action | How |
|---|---|
| Talk | Just speak — Aitzaz is already listening (no button) |
| Pause / resume listening | PAUSE button, Space, or tap the core |
| Disable the microphone | MIC OFF button (OS mic permission stays with the browser) |
| Stop the agent | red ■ STOP button or Esc |
| Barge in | speak while Aitzaz is talking (interrupt-aware) |
| Typed chat | input bar at the bottom (same conversation as voice) |
| Cinematic boot | press `B` |
| Kanban / dashboards | VIEWS panel → animated pop-up viewers |

## Privacy model

- Microphone access goes through the OS's normal permission mechanism
  (browser mic prompt / OS mic indicator).
- No audio is recorded or stored: RAM-only, per-utterance, then discarded.
- Nothing is uploaded except what a turn needs: the transcript text goes to
  your LLM provider (via Hermes) and reply text to ElevenLabs — secrets are
  redacted first. Voice commands never leave your LAN otherwise.
- Visible listening state at all times (`LISTENING / PROCESSING / SPEAKING /
  PAUSED / MIC OFF`) + a live `GET /api/status` privacy endpoint.
- LAN-only by design — do not port-forward this to the internet.

## Tests

```bash
.venv/bin/python tests/test_vad.py              # VAD segmentation (real speech in noise)
.venv/bin/python tests/test_ws_continuous.py    # full continuous-listening protocol e2e
```

## Credits & license

- Base project: [jarvis_ai](https://github.com/eadmin2/jarvis_ai) by
  Chris Lassiter — voice pipeline, HUD design, Hermes integration.
- Brain: [Hermes Agent](https://github.com/NousResearch/hermes-agent), Nous Research.
- HUD aesthetics inspired by
  [jarvis-dashboard](https://github.com/AndrewKochulab/jarvis-dashboard).
- STT: [faster-whisper](https://github.com/SYSTRAN/faster-whisper) /
  [RealtimeSTT](https://github.com/KoljaB/RealtimeSTT). VAD:
  [silero-vad](https://github.com/snakers4/silero-vad). Voice:
  [ElevenLabs](https://elevenlabs.io).

MIT — see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). Aitzaz AI Pro is a
modification of the original jarvis_ai codebase; the original code was not
written from scratch for this project, and original attribution is preserved.
