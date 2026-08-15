# Aitzaz AI Pro — Desktop App

The desktop companion application for **Aitzaz AI Pro**. This is the full
feature-rich desktop experience (formerly the Zara AI app) that was integrated
into the Aitzaz-OS monorepo in Phase 2 of the Aitzaz AI Pro plan.

**Assistant name:** Aitzaz
**Tech:** Electron + Vue 3 + Vite + Tailwind + Pinia (frontend) · Go (local
STT/TTS/embeddings backend) · SQLite + HNSW vector store for memory/RAG.

> **Attribution:** This app is a modified fork of the open-source
> [Alice](https://github.com/pmbstyle/Alice) project by Slava Trofimov, and its
> Zara AI derivative. Original MIT license is preserved in `LICENSE` and
> attribution in `NOTICE.md`.

## Features (at a glance)

- 🌏 **Multilingual** — English, Urdu, Roman Urdu, Hindi (code-switching aware)
- 🗣️ **Voice** — VAD, wake word ("Hey Aitzaz"), streaming STT/TTS, interrupt
- 🧠 **Memory + RAG** — SQLite long-term memory, HNSW vector store, chat with documents
- 🎨 **Vision** — screenshot / image understanding
- 🖥️ **Computer-use tools** — files, terminal, apps, clipboard, scheduler
- 📧 **Gmail & Google Calendar** integrations
- 🔌 **MCP** support + custom tools (JSON + scripts)
- 🎭 **Animated avatar** states (standby / speaking / thinking / listening…)
- 🛡️ **Permissions & approvals** — one-time / session / permanent
- ⚙️ **Full Settings** system with secure key storage
- 👤 **Local accounts** — sign up / sign in / sign out with encrypted
  session persistence across restarts
- 🔊 **Automatic voice responses** — every reply is spoken automatically,
  with play/pause, stop, replay, volume and speed controls

## Accounts, sessions & secure keys

Aitzaz AI Pro uses a local account system implemented in the Electron main
process (no external auth service is required):

- **Sign up / Sign in / Sign out** with email + password before the assistant
  opens. Passwords are hashed with `scrypt` + per-user salt and are never
  stored or logged in plain text.
- **Session persistence:** with "Keep me signed in" enabled, the session token
  is encrypted with Electron `safeStorage` (Windows DPAPI, macOS Keychain,
  Linux libsecret/KWallet) and restored automatically on the next launch.
- **Provider configuration is remembered:** AI provider, model, voice and TTS
  settings are persisted after setup, so the API key is entered **once**.
  API keys are stored in the OS credential store via `safeStorage`
  (`alice-secrets.bin`), never in plain JSON, and are only ever shown masked
  (`••••••••••••1234`) in the UI.

## Voice output (TTS)

- Responses are spoken automatically (configurable: *Voice Response* ON/OFF in
  Settings → Core). The speaker icon reflects the state:
  💤 Idle · 🎙 Listening · 🧠 Thinking · 🔊 Speaking.
- Playback controls appear while speech plays: **Play/Pause**, **Stop**,
  **Replay**. Volume and speech speed are adjustable in Settings.
- The TTS engine is provider-agnostic and fault tolerant: if the configured
  provider (OpenAI / Google) fails, synthesis automatically falls back to the
  bundled local Piper voices (Go backend), so the assistant keeps speaking.

## Getting started (development)

```bash
# 1. Install dependencies
npm ci

# 2. (first run) download local models
npm run setup:embeddings     # multilingual embedding model (ONNX)
npm run setup:dependencies   # local STT/TTS models if you want fully-local

# 3. Set up your .env (see .env-example): at least one LLM API key

# 4. Compile the Go backend (requires the Go toolchain)
npm run build:go

# 5. Run the dev app
npm run dev
```

## Production build

```bash
npm run build          # build:go + vite build + electron-builder
# output in release/<version>/
```

> Requires: **Node ≥ 22**, and for the Go backend the **Go toolchain**
> (`go version`). Google/Gmail/Calendar need OAuth client credentials in
> `app-config.json` (see `docs/setupInstructions.md`).
