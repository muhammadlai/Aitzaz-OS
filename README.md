# Aitzaz AI Pro — Voice + HUD for Hermes Agent

A self-hosted, futuristic AI voice assistant and command center built on top of
[Hermes Agent](https://github.com/NousResearch/hermes-agent) (NousResearch's
open-source autonomous agent). Talk to a *real* agent — one with persistent
memory, terminal access, web search, file tools, and 80+ skills — through a
glowing AI-core HUD in any browser on your LAN, or a push-to-talk client.

**Everything runs on your own hardware.** The only cloud calls are your LLM
provider (via Hermes) and ElevenLabs for the voice. Speech-to-text is fully
local (Whisper on CPU).

## Demo

[![Watch the Aitzaz AI Pro demo](https://img.youtube.com/vi/YNI9pm3h6x8/hqdefault.jpg)](https://youtu.be/YNI9pm3h6x8)

▶ **[Watch the demo on YouTube](https://youtu.be/YNI9pm3h6x8)** — live transcription, agent tool calls, holographic media panels, and the cinematic boot, all in real time.

## Desktop app (download & install)

Don't want to keep a browser tab open? A native **desktop app** wraps the HUD
in its own window and connects to your server over the LAN — Windows, macOS,
Linux, and **Chromebook** (via the built-in Linux environment / Crostini).

- **Download installers** from the
  [Releases](https://github.com/muhammadlai/Aitzaz-OS/releases) page:
  `Aitzaz-AI-Pro-Windows-<ver>-Setup.exe`, `Aitzaz-AI-Pro-Mac-<ver>.dmg`,
  `Aitzaz-AI-Pro-Linux-<ver>-<arch>.deb` / `.AppImage`.
- **Chromebook, install, and build-from-source steps:** see
  [docs/DESKTOP.md](docs/DESKTOP.md).

The app lives in [`desktop/`](desktop/) (Electron) and is packaged with
electron-builder. A ready-made GitHub Actions workflow ships in
[`docs/workflows/build-desktop.yml`](docs/workflows/build-desktop.yml) — copy it
to `.github/workflows/` and it builds installers for every platform on each
`v*` tag and attaches them to a GitHub Release.

## What it does


Just start speaking — Aitzaz listens automatically. Your words transcribe
**live on screen** while you talk. The transcript goes to Hermes Agent, which actually *does things* — reads
and writes files, runs commands, searches the web, remembers you across
sessions — and the reply streams back as speech, sentence by sentence, while
the rest is still being generated. Typical round trip: 3–5 seconds.

The HUD around the ring is a real control center:

- **Live agent activity** — watch tool calls happen with command previews
- **STOP button** — halt a runaway agent turn mid-tool-call (Esc works too)
- **Approval cards** — dangerous commands pause for your ALLOW/DENY
- **Interrupt-aware barge-in** — cut it off mid-sentence; it knows exactly
  what you heard and what you didn't
- **Embedded dashboards** — Hermes' kanban board and session browser pop up
  in animated viewers, fully interactive
- **Holographic media panels** — say *"show me a video of how arc reactors
  work, on screen"* and a panel swoops in from Z-depth, traces its frame,
  materializes through a scanline, and plays the video. The agent drives it
  through a bundled Hermes plugin (`hud_display`); panels can fly into
  left/right thirds, and "clear the screen" sweeps them away
- **Usage tracking** — tokens/day, turns, ElevenLabs quota bar
- **Machines panel** — live CPU/GPU stats for the host and remote workers
- **Cinematic boot** — press `B`: panels flicker in, ring spins up,
  "Systems online. Good morning."
- **Privacy filter** — secret-shaped strings are redacted before any text
  reaches cloud TTS
- **Optional GPU ears** — point it at any NVIDIA machine on your LAN running
  the included sidecar and transcription jumps to `large-v3-turbo` at ~0.2 s,
  with automatic fallback to local Whisper when that machine is off
- **Mobile-ready** — responsive layout + Add to Home Screen = full-screen
  Aitzaz app on your phone

## Architecture

```
 Browser HUD (any LAN device)          Host machine (tested on macOS / Apple Silicon)
 ── https/wss :443 ──────────┐   ┌──────────────────────────────────────┐
   mic · speaker · panels    ├──►│ voice pipeline server (this repo)    │
                             │   │  STT: faster-whisper (local, free)   │   ┌─────────────────┐
 Push-to-talk client         │   │  TTS: ElevenLabs Flash (streaming)   ├──►│ Hermes Agent     │
 ── ws :8765 ────────────────┘   │  HUD + auth + dashboard TLS proxy    │   │  API :8642 (lo)  │
                                 └──────────────────────────────────────┘   │  memory · tools  │
                                                                             │  skills · cron   │
                                                                             └─────────────────┘
```

One brain, many faces: voice and typed chat share a single persistent Hermes
session, so each knows what you said to the other — and memory survives every
restart.

## Requirements

- A machine for the server (tested: Mac mini, Apple Silicon). Linux should
  work with minor changes (launchd → systemd).
- [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) installed and
  configured with an LLM provider
- Python 3.11+
- An [ElevenLabs](https://elevenlabs.io) API key (free tier works; ~0.5
  credits/char on Flash)
- Any modern browser on the LAN

## Install

**macOS — one command does everything** (venv, config, certs, secrets,
launchd auto-start, health check):

```bash
git clone https://github.com/muhammadlai/Aitzaz-OS.git
cd Aitzaz-OS/server
scripts/jarvis-setup.sh                       # answers/creates everything
scripts/jarvis-setup.sh --elevenlabs-key KEY  # add your ElevenLabs key later
```

Then open `https://YOUR_HOST/hud/` and talk. The default voice (ElevenLabs
premade "Adam") works out of the box; change `voice.voice_id` in
`config/server.yaml` to use any voice from your Voice Library. The server
also self-heals on first run: if `config/server.yaml` or the TLS certs are
missing, it creates them automatically.

Full walkthrough in [docs/SETUP.md](docs/SETUP.md). Manual install, short
version:

```bash
# 1. Enable the Hermes Agent API server
cat >> ~/.hermes/.env <<EOF
API_SERVER_ENABLED=true
API_SERVER_KEY=$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')
JARVIS_HUD_TOKEN=$(python3 -c 'import secrets;print("aitzaz-"+secrets.token_hex(3))')
ELEVENLABS_API_KEY=your-key-here
EOF
hermes gateway   # or set up its LaunchAgent / service

# 2. This repo
cd Aitzaz-OS/server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp config/server.example.yaml config/server.yaml   # default voice works already
scripts/make-certs.sh                              # self-signed TLS (browser mic needs it)

# 3. Run
.venv/bin/python server.py
# open https://YOUR_HOST/hud/ → accept cert → enter your JARVIS_HUD_TOKEN → talk
```

**Urdu / Roman Urdu — ek nazar mein:**

- **Awaaz nahi aa rahi?** Mac par chalao: `cd server && scripts/jarvis-doctor.sh`
  — jo line FAIL dikhe usko theek karo, phir dobara chalao.
- **Sab kuch khud set karna hai?** `scripts/jarvis-setup.sh` — venv, config,
  certs, keys aur launchd sab khud bana deta hai.
- **Voice (TTS) band?** `ELEVENLABS_API_KEY` `~/.hermes/.env` mein hona
  chahiye (elevenlabs.io → Profile → API Keys). Default awaaz "Adam" pehle se
  set hai — `server.yaml` mein `voice_id` badal kar koi bhi awaaz chun lo.
- **Mic band?** Browser/desktop app ko microphone permission do (System
  Settings → Privacy & Security → Microphone), aur cert trusted hona chahiye
  (setup script khud trust kar deta hai).

For auto-start on boot, see [launchd/](launchd/) (macOS) — the plists document
two non-obvious macOS traps (external-drive TCC and log paths) that cost us an
evening.

## Usage

| Action | How |
|---|---|
| Talk | Just speak — Aitzaz listens automatically |
| Stop the agent | red ■ STOP button or Esc |
| Barge in | click the ring while it's speaking |
| Typed chat | input bar at the bottom (same conversation as voice) |
| Cinematic boot | press `B` |
| Kanban / dashboards | VIEWS panel → animated pop-up viewers |
| Phone | open the HUD → Add to Home Screen |

## Repo layout

```
server/          FastAPI voice pipeline + HUD host (the core of this project)
server/hud/      single-file HUD (vanilla JS, no build step)
server/scripts/  start/stop/health/doctor/smoke + cert & boot-audio generators
app/             Aitzaz AI Pro — full desktop AI companion (Electron + Vue 3 + Go).
                 Multilingual, wake word, memory/RAG, vision, computer-use tools,
                 Gmail/Calendar, MCP, avatar, permissions (formerly Zara AI).
desktop/         Thin Electron shell for the LAN HUD (Windows/macOS/Linux + Chromebook installers)
client/          optional Windows/Linux push-to-talk Python client (wake word capable)
worker/          optional GPU sidecars: big-model STT server + stats agent for the Machines panel
hermes-plugin/   Hermes tool plugin: lets the agent summon/dismiss HUD media panels
launchd/         macOS auto-start templates with hard-won TCC + FD-limit notes
docs/            SETUP, ARCHITECTURE, INTEGRATION_PLAN, TROUBLESHOOTING
```

## Security model

- The Hermes API key never reaches the browser: the HUD talks through a
  strict allowlist proxy on the voice server.
- All HUD endpoints + dashboard proxy + browser WebSockets are gated by a
  token (cookie, entered once per device).
- Hermes' API binds to loopback only; the dashboard binds to loopback only.
- Secret-shaped strings are redacted before text leaves for cloud TTS.
- LAN-only by design — do not port-forward this to the internet.

## Credits & license

Built on [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous
Research. HUD aesthetics inspired by
[jarvis-dashboard](https://github.com/AndrewKochulab/jarvis-dashboard).
STT by [faster-whisper](https://github.com/SYSTRAN/faster-whisper) /
[RealtimeSTT](https://github.com/KoljaB/RealtimeSTT). Voice by
[ElevenLabs](https://elevenlabs.io).

MIT — see [LICENSE](LICENSE). Use it, fork it, build your own Aitzaz.
