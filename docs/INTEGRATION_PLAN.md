# Aitzaz AI Pro — Phase 1: Analysis & Integration Plan

**Date:** 2026-08-13
**Scope:** Merge the strongest features of `P9rsOn_Oi` (Zara AI) into `Aitzaz-OS`
to produce **Aitzaz AI Pro** without breaking Aitzaz-OS's existing architecture.

> Phase 1 = analysis only. No code was modified. This document is the plan.

---

## 1. Executive summary

Both repositories are complete, working, but **architecturally very different**
apps. The headline finding:

| | Aitzaz-OS | Zara AI (P9rsOn_Oi) |
|---|---|---|
| **Backend** | Python 3 / FastAPI (`server.py`, 1241 LOC) | Go (`backend/`) + Node/Electron main |
| **Desktop UI** | Thin Electron shell wrapping a **vanilla-JS HUD** (`server/hud/index.html`, 47 KB, single file) | Full **Vue 3 + Vite + Tailwind** app (Pinia stores, dozens of components) |
| **Agent engine** | **Hermes Agent** (external, API :8642) | Built-in OpenAI-style **function calling** |
| **Voice** | Python `RealtimeSTT` + faster-whisper + ElevenLabs | Web VAD + Whisper.cpp + Piper/OpenAI/Google TTS |
| **Distinctive strengths** | Hermes agent integration, cinematic HUD, holographic media panels, LAN browser access, GPU sidecars | Multilingual (EN/UR/Roman-Urdu/HI), wake word, memory+vector RAG, vision/screenshots, computer-use tools, Gmail, Calendar, scheduler, MCP, provider router, avatar, permissions |

**Recommendation (read §6 before proceeding):** A true line-by-line merge is not
practical because the stacks do not overlap. The realistic, honest path is to
**treat Zara as the application foundation** (it already *is* 90% of the target
product) and **graft Aitzaz-OS's differentiators** (Hermes agent + HUD panels +
cinematic boot) onto it — while re-branding Zara → Aitzaz and preserving the
required MIT/Alice attribution. The alternative (making Aitzaz-OS the base and
porting Zara's Vue/Go modules into a vanilla-JS/Python shell) is a full rebuild
of the desktop app.

This document lays out both options and lets you decide before Phase 2.

---

## 2. Repository overviews

### 2.1 Aitzaz-OS (`server/`, `desktop/`, `client/`, `worker/`, `hermes-plugin/`)
- **server/server.py** — FastAPI voice pipeline: STT (`RealtimeSTT`/faster-whisper),
  streaming TTS (ElevenLabs), WebSocket audio, HUD + auth + dashboard TLS proxy,
  approval cards, interrupt-aware barge-in, usage tracking, machines panel.
- **server/hud/index.html** — single-file vanilla-JS HUD (no build step): ring,
  live transcription, tool-call previews, media panels, dashboards, cinematic boot.
- **desktop/** — thin Electron shell that loads the LAN HUD URL.
- **worker/** — GPU sidecars (big-model STT + stats).
- **hermes-plugin/** — `hud_display` plugin letting the agent drive HUD panels.
- **Agent backend** = external Hermes Agent (API key, allowlist proxy).

### 2.2 Zara AI (P9rsOn_Oi) — `src/`, `backend/`, `electron/`
- **src/** — Vue 3 + Vite + Tailwind + Pinia frontend.
  - `services/llmProviders/` — provider router: `openai`, `openrouter`, `deepseek`,
    `zai`, `minimax`, `ollama`, `lmStudio`, `openAICompatible`, `codex` (+ stream adapters).
  - `stores/` — `settingsStore` (43 KB), `conversationStore` (35 KB), `generalStore`,
    `customAvatarsStore`, `customToolsStore`.
  - `components/` — `Chat`, `Sidebar`, `Overlay`, `Actions`, `MemoryManager`,
    `CommandApprovalDialog`, full `Settings` system.
- **backend/** — Go server for local STT (Whisper), TTS (Piper), multilingual
  embeddings (minilm ONNX, 384-dim).
- **electron/main/** — managers: `googleGmailManager`, `googleCalendarManager`,
  `schedulerManager`, `memoryManager`, `ragDocumentStore`, `thoughtVectorStore`,
  `desktopManager` (computer-use), `customAvatarsManager`, `customToolsManager`,
  `hotkeyManager`, `updaterManager`, `authManager`, `securityBoundaries`, `windowManager`.

---

## 3. Dependency comparison

| Concern | Aitzaz-OS | Zara AI |
|---|---|---|
| Runtime | Python 3.11+, Node (Electron), external Hermes | Node ≥22, Go toolchain (build), Electron |
| Voice | `RealtimeSTT`, `faster-whisper`, `silero-vad`, ElevenLabs API | `@ricky0123/vad-web`, whisper.cpp (Go), Piper, OpenAI/Google TTS |
| AI | Anthropic SDK (`anthropic`) → Hermes | `openai` SDK + many provider adapters |
| Memory/DB | none (Hermes owns memory) | `better-sqlite3`, `hnswlib-node`, `onnxruntime-web` |
| UI | vanilla JS (no deps) | Vue 3, Vite, Pinia, Tailwind, daisyUI, Vue Router |
| Docs | PDF — | `pdfjs-dist`, `mammoth`, `turndown`, `cheerio`, `marked` |
| Google | — | `googleapis` |
| Scheduler | — | `node-cron` |

**Conflict:** Python/vanilla-JS vs Vue/Go — there is almost no shared code to
"merge"; it is a **feature-and-architecture transplant**, not a code merge.

---

## 4. Feature comparison matrix

Legend: ✅ present, 🔶 partial/limited, ❌ missing, ➕ to be added

| Feature | Aitzaz-OS | Zara | Target (Aitzaz Pro) | Source to use |
|---|---|---|---|---|
| Agent engine (Hermes) | ✅ | ❌ | ✅ (keep both) | Aitzaz-OS |
| Cinematic HUD + panels | ✅ | ❌ | ✅ | Aitzaz-OS |
| Live voice STT (local) | ✅ | ✅ | ✅ | both |
| Streaming TTS | ✅ | ✅ | ✅ | both |
| Wake word | 🔶 (client) | ✅ | ✅ | Zara |
| Multilingual EN/UR/HI/Roman-Urdu | ❌ | ✅ | ✅ | Zara |
| Interrupt / barge-in | ✅ | ✅ | ✅ | both |
| Provider router (OpenAI/OpenRouter/DeepSeek/Ollama/LM Studio) | ❌ | ✅ | ✅ | Zara |
| Long-term memory (SQLite) | ❌ | ✅ | ✅ | Zara |
| Vector memory + RAG (documents) | ❌ | ✅ | ✅ | Zara |
| Document parsing PDF/DOCX/TXT/MD | ❌ | ✅ | ✅ | Zara |
| Screenshot / image vision | ❌ | ✅ | ✅ | Zara |
| Desktop automation + file/terminal | 🔶 (tools) | ✅ | ✅ | Zara + Aitzaz |
| Gmail | ❌ | ✅ | ✅ | Zara |
| Google Calendar | ❌ | ✅ | ✅ | Zara |
| Scheduler / reminders | ❌ | ✅ | ✅ | Zara |
| MCP server registration | ❌ | ✅ | ✅ | Zara |
| Custom tools (JSON + scripts) | ❌ | ✅ | ✅ | Zara |
| Avatar (animated states) | 🔶 (static png) | ✅ (video) | ✅ | Zara |
| Tool approval / permissions | ✅ (allow/deny) | ✅ (granular) | ✅ | Zara (+Aitzaz cards) |
| Settings system | ❌ | ✅ (full) | ✅ | Zara |
| LLM keys stored securely | 🔶 | ✅ (encrypted) | ✅ | Zara |
| LAN browser HUD access | ✅ | ❌ | ✅ (keep) | Aitzaz-OS |
| GPU sidecar workers | ✅ | ❌ | ✅ (keep) | Aitzaz-OS |

**Conclusion:** Zara already delivers most "advanced" target features out of the
box. Aitzaz-OS's unique value = **Hermes agent + cinematic HUD + LAN access +
GPU workers + approval cards.** The integration is therefore about **retaining
Aitzaz-OS's differentiators** while **standardizing on Zara's product shell**.

---

## 5. Overlap / duplication to resolve

Where both apps implement the same thing, pick the stronger and remove dup:

| Duplicate | Stronger | Keep / remove |
|---|---|---|
| Local STT | Zara (multilingual whisper + VAD) | Zara (optionally keep Aitzaz faster-whisper behind a flag) |
| TTS | Zara (multilingual Piper + cloud) | Zara |
| Interrupt | Zara (streaming cancellation) | Zara (keep Aitzaz barge-in UX) |
| Approval | Zara (granular one-time/session/permanent) | Zara, rendered via Aitzaz-style cards |

---

## 6. Integration strategy (two honest options)

### Option A — RECOMMENDED: Zara shell + Aitzaz-OS differentiators
Use **Zara's Electron+Vue+Go app as the Aitzaz AI Pro foundation** (it already is
a polished, demoable desktop companion with voice, memory, RAG, vision, tools,
integrations, avatar, provider router). Then:
1. **Rebrand** Zara → **Aitzaz AI Pro** (assistant name "Aitzaz"), keep MIT/Alice attribution.
2. **Add Hermes agent as an additional provider/engine** behind the router (port
   Aitzaz's Hermes allowlist-proxy client into a provider adapter).
3. **Port the cinematic HUD + media panels** from Aitzaz's vanilla HUD into a Vue
   component (or embed the HUD iframe).
4. **Port LAN browser HUD access + approval cards + GPU sidecar client**.
5. Keep the full Zara Settings/memory/RAG/vision/integrations/permissions.

**Effort:** medium. **Risk:** low. **Result:** genuinely functional, demoable to a company/investor.

### Option B — Aitzaz-OS as base, port Zara into it
Keep `server/server.py` + vanilla HUD as the foundation and port Zara's Vue app,
Go backend, and Electron managers. This effectively **rebuilds the entire desktop
app** in a stack Aitzaz-OS does not currently use, and fights the existing
architecture — highest effort, highest risk of breaking Aitzaz-OS.

**Effort:** very high (near-full rebuild). **Risk:** high.

> **My recommendation is Option A.** The user's own README goal is a premium,
> demoable desktop assistant — which is exactly what Zara already is. We preserve
> Aitzaz-OS's working HUD/agent/Hermes strengths by porting them in, not by
> discarding Zara's superior product shell.

---

## 7. Phased roadmap (maps to your Phase 2–10)

- **Phase 2 — Core merge (Option A):** rebrand to Aitzaz AI Pro; keep Aitzaz-OS
  repo as server provider; add `hermes` provider adapter; set up CI build.
- **Phase 3 — Voice:** verify wake word + VAD + STT + streaming TTS + interrupt
  in the Zara shell; wire Aitzaz ElevenLabs option if desired.
- **Phase 4 — Memory + RAG:** keep Zara SQLite + vector store; add memory controls UI.
- **Phase 5 — Vision:** keep Zara screenshot/vision; add "Aitzaz, screen dekho…".
- **Phase 6 — Automation:** keep Zara computer-use tools; add Hermes tool passthrough.
- **Phase 7 — Integrations:** keep Zara Gmail/Calendar/scheduler/MCP; tie into Hermes.
- **Phase 8 — UI/Avatar:** port cinematic HUD/panels; rename avatar to Aitzaz states.
- **Phase 9 — Security:** keep Zara granular approvals; add Aitzaz approval cards.
- **Phase 10 — Testing:** startup, mic, wake word, STT, response, TTS, interrupt,
  tools, memory, RAG, screenshot, Gmail, Calendar, MCP, scheduler, permissions, UI.

---

## 8. What is NOT yet solvable in a single pass (honest note)

- **Gmail / Calendar / Google integrations** need OAuth client credentials
  (`app-config.json` / `VITE_GOOGLE_CLIENT_ID` + secret) — architecture will be
  complete, but end-to-end verification needs your Google Cloud OAuth setup.
- **Cloud LLM/TTS providers** need your API keys (OpenAI/OpenRouter/DeepSeek/ElevenLabs).
- **Local STT/TTS/embeddings** need model downloads (`npm run setup:*`) at first run.
- A full merge is **not a one-session task**; Phase 2 (Option A) is the correct
  first, verifiable milestone.

---

## 9. Deliverables expected at the end
Complete architecture, files changed/added, dependencies added, env vars required,
install/run/test commands, known limitations, and attribution/license notes.
