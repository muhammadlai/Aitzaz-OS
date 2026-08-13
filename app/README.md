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
