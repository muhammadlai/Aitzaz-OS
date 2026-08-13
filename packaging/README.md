# Aitzaz AI Pro — desktop packaging

The desktop app is the same HUD that runs in the browser, wrapped in an
installable window. **The assistant is not a website**: the brain (Hermes
Agent), local Whisper STT, VAD and the ElevenLabs voice all run through the
voice pipeline server (`server/server.py`) on the user's machine. This
folder only packages the *face* of the assistant as a native desktop app.

## Option A — Electron app (Windows / macOS / Linux)

Requires Node.js 18+.

```bash
cd packaging/desktop
npm install                 # pulls electron + electron-builder
AITZAZ_HUD_URL=http://127.0.0.1:8765/hud/ npm start      # run dev
npm run dist                # build installers
```

`electron-builder` produces:

- **Windows**: NSIS installer (`Aitzaz AI Pro Setup 1.0.0.exe`)
- **macOS**: DMG (`Aitzaz AI Pro-1.0.0.dmg`)
- **Linux**: AppImage + deb

The app connects to the local voice pipeline server. Point `AITZAZ_HUD_URL`
elsewhere only if the server runs on a custom port/host. Audio capture uses
the Chromium engine's normal OS permission flow (microphone consent the first
time the HUD arms the mic), exactly like the browser version.

## Option B — Python desktop client (no Electron)

The terminal voice client (continuous listening by default):

```bash
# from the repo root
python3 -m venv .venv-client
.venv-client/bin/pip install -r client/requirements-client.txt
.venv-client/bin/python client/client.py --server ws://127.0.0.1:8765/ws
```

Windows one-shot installer: `packaging/windows/install.bat`
(creates venv + desktop shortcuts; edit the server IP inside first).

## Option C — Linux desktop entry

```bash
packaging/linux/install-desktop.sh   # registers "Aitzaz AI Pro" app entry
```

## What ships where

| Platform | Installable face | Assistant brain |
|---|---|---|
| Windows | Electron NSIS / Python client + install.bat | voice pipeline server (same LAN or localhost) |
| Linux | Electron AppImage/deb / desktop entry / Python client | same |
| macOS | Electron DMG / launchd auto-start (launchd/) | same |
| Android / iOS | HUD as PWA (Add to Home Screen) | same — see docs/MOBILE.md |

The server core (`server/`, `core/`, `client/`, `worker/`, `hermes-plugin/`)
is platform-agnostic and shared by every frontend — a native mobile client
only has to implement the documented WebSocket protocol (docs/ARCHITECTURE.md).
