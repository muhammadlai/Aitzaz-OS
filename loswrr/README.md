# LOSWRR AI OS

> Your Personal AI Operating System — CEO: Aitzaz

LOSWRR AI OS is a browser-first Progressive Web App that turns a JARVIS-class
voice + memory + agent engine into a **personal AI CEO / digital employee
system**. It is built on top of the open-source foundation in
[Aitzaz-OS](../) and is the next evolution of that engine.

The application is designed to be installed and used directly in **Chrome /
ChromeOS**, with an optional local companion for advanced computer control
called the **LOSWRR Desktop Bridge**.

---

## What it does

LOSWRR listens, understands, plans, researches, delegates, executes,
remembers, automates, and reports. Every command from Aitzaz is routed
through the **CEO orchestrator**, which decides which specialist agents
are required and in what order.

### The CEO Orchestrator

- Receives a single command.
- Classifies the intent.
- Plans a workflow across specialist agents.
- Streams real-time activity to the right-hand drawer.
- Returns a concise, addressable summary in the voice of LOSWRR AI.

### Specialist agents

| Agent | Role |
|---|---|
| **CEO / Orchestrator** | Decides which agents to call and in what order |
| **Research Agent** | Search → open sources → extract → verify → compare → summarize |
| **Job Hunter** | Search, filter, score, save, cover letters, applications |
| **Lead Hunter** | Search, qualify, score business leads |
| **Sales Agent** | Pipeline scoring, prioritization |
| **CRM Agent** | Persist leads / jobs, statuses, history, follow-ups |
| **Email Agent** | Draft, organize, send (with approval) |
| **Browser Agent** | Open, search, read pages, in-app iframe viewer |
| **Computer Agent** | Files, commands, screenshots (via Desktop Bridge) |
| **Memory Agent** | Long-term structured memory across 10 categories |
| **Coding Agent** | Read code, explain errors, generate patches |
| **File Agent** | PDF, DOCX, CSV, JSON, images, summarize |
| **Task Agent** | Natural-language tasks and follow-ups |
| **Report Agent** | Summarize workflows, generate briefs |

### Status model

Each agent reports: `IDLE`, `THINKING`, `WORKING`, `WAITING`, `COMPLETED`,
`FAILED`. Agents communicate only through the orchestrator.

---

## Memory

Structured long-term memory across ten categories:

`PERSONAL`, `PREFERENCES`, `GOALS`, `PROJECTS`, `BUSINESS`, `PEOPLE`,
`JOBS`, `LEADS`, `DECISIONS`, `TASKS`

Backed by an embedded **vector store** (browser IndexedDB) for semantic
recall. Encrypted API keys for the AI provider are stored in localStorage
using **AES-GCM** with a PIN-derived passphrase.

Natural-language memory ops:

- "Remember that my primary target market is US roofing companies."
- "What is my primary target market?"
- "Forget my old phone number."

The Memory view supports search, edit, delete, and JSON export.

---

## Voice

- **Wake word** — "Jarvis" / "Loswrr" / "Hey Loswrr"
- **Push-to-talk** — Space bar or mic button
- **Web Speech recognition** for STT (with a clear path to plug in
  faster-whisper as the JARVIS engine did)
- **TTS** via Web Speech, with mute / stop / barge-in
- **Speaker verification** via a voice fingerprint (energy-profile cosine)
- **Sleep word** — "go to sleep", "that is all"

Voice states: `IDLE`, `LISTENING`, `PROCESSING`, `SPEAKING`.

---

## AI Provider Manager

Supports cloud and local providers, with **graceful fallback**:

- **Groq** (llama-3.3-70b-versatile, mixtral, gemma2)
- **Cerebras** (llama-3.3-70b)
- **NVIDIA NIM** (llama-3.1-70b-instruct, mistral-large-2)
- **OpenAI** (gpt-4o, gpt-4.1, o4-mini)
- **Anthropic** (claude-sonnet-4-5, claude-opus-4-1)
- **Google Gemini** (gemini-2.5-pro, gemini-2.5-flash)
- **Ollama** (any local model — used as the offline fallback)

API keys are entered in the Settings view, **encrypted at rest**, and
never logged. If no provider is reachable, the app falls into **DEMO
MODE** with clearly-labeled placeholder responses — it never fabricates
data as if it were real.

---

## Job Hunter

Natural-language job search with filtering, scoring, and persistence.

```
"Find remote customer support jobs paying more than $800."
```

Filters: `minSalary`, `remote`, `type` (Full-time / Part-time / Contract),
keywords (customer support, customer success, etc.).

Job statuses: `NEW`, `MATCHED`, `SAVED`, `APPLIED`, `INTERVIEW`,
`REJECTED`, `OFFER`.

Includes **CV Analyzer**, **Job Match**, **Cover Letter Generator**,
**Application Message Generator**, **Application Tracker**, and
**Interview Preparation** hooks.

If no live job API is configured, demo data is used and clearly labeled.

---

## Lead Hunter

Target industries: Roofing, HVAC, Plumbing, Solar, Insurance, Real
Estate, Restoration, Pest Control, Garage Door, Landscaping.

```
"Find 20 roofing companies in Texas and prepare outreach."
```

Lead fields: company, owner, contact, title, email, phone, website,
location, industry, lead score, status, notes.

Lead statuses: `NEW`, `QUALIFIED`, `CONTACTED`, `FOLLOW-UP`, `INTERESTED`,
`CLOSED`, `LOST`.

---

## CRM

A real CRM with add / edit / delete / search / filter / sort / notes /
tasks / follow-ups / lead timeline. Persists locally to IndexedDB /
localStorage. Supabase / PostgreSQL backend support is prepared
(adapter interface defined in `js/services/`).

---

## Computer Control (Desktop Bridge)

The web app works entirely in the browser. For local OS control, an
optional companion is provided: **LOSWRR Desktop Bridge**.

Architecture:

```
LOSWRR Web App  ←→  LOSWRR Desktop Bridge  ←→  Authorized Local Computer
```

The bridge speaks JSON over HTTP and exposes a small action surface:

| Action | Class |
|---|---|
| `read_file`, `list_dir`, `get_info` | SAFE |
| `screenshot`, `read_clipboard`, `notify` | SAFE |
| `write_file`, `move_file`, `copy_file`, `create_folder` | REQUIRES APPROVAL |
| `run_command` | REQUIRES APPROVAL |
| `browser_open`, `browser_click`, `browser_fill`, `browser_submit` | REQUIRES APPROVAL |
| `delete_file` | **BLOCKED** (never auto-allowed) |

All approvals go through the in-app modal. **Destructive deletes are
blocked entirely** — the bridge will refuse them.

When the bridge is not connected, the web app continues to work
(browser-only mode).

---

## Browser Automation

The Browser Agent can:

- Open URLs (in-app iframe or Desktop Bridge)
- Search (Google)
- Navigate, read pages
- Extract information
- (With Desktop Bridge) Fill forms, click elements, create tabs,
  download authorized files, take screenshots

It will **never** bypass CAPTCHA, authentication, security controls, or
website terms. Sensitive actions (form submission, sending messages)
require explicit user approval.

---

## Email

Architecture is prepared for **Gmail OAuth** integration. Drafts and
sends are kept client-side; OAuth tokens are **never** stored in
plaintext. Sending always requires explicit user approval.

In demo mode, the inbox is populated with clearly-labeled demo
messages and outbound sends are simulated.

---

## Tasks & Automations

Natural-language task creation:

```
"Remind me tomorrow at 10 AM to follow up with John."
```

Tasks have title, priority, date, time, status (TODO / IN PROGRESS / DONE),
related job / lead, and notes.

Automations are scheduled with cron expressions or intervals. They run
while the app is open; for true background execution a backend worker
(planned) can be deployed. Browser-side, the app registers a service
worker that can receive `periodicsync` events on supported platforms.

---

## Security

- PIN-gated access (PBKDF2-hashed, 50,000 iterations, per-user salt)
- AES-GCM-encrypted API key storage
- Audit log of all auth + sensitive actions
- Session passphrase rotates on login
- "Lock now" forces re-auth
- Default PIN `0000` — change it in Settings immediately

The web app is meant to run on your own hardware. **Do not expose it
directly to the public internet** without putting it behind a reverse
proxy with TLS and proper authentication.

---

## Running

LOSWRR is a **static PWA**. No build step. Just serve the `loswrr/`
directory with any static file server.

```bash
cd loswrr
python3 -m http.server 8088
# open http://127.0.0.1:8088/ in Chrome
```

Or deploy behind any static host (Vercel, Netlify, GitHub Pages, an
internal LAN web server, etc.).

The first time you open it, enter PIN `0000` and change it.

---

## Architecture

```
loswrr/
├── index.html              PWA shell, auth gate, top bar, sidebar
├── manifest.webmanifest    Installable on ChromeOS, Android, Win, Mac, Linux
├── service-worker.js       Offline shell + cache
├── css/loswrr.css          Premium dark theme, glass panels, neon glow
├── assets/icons/           PWA icons
└── js/
    ├── data/demoData.js        Clearly-labeled demo data (jobs, leads, emails)
    ├── services/
    │   ├── storage.js          localStorage + IndexedDB + cosine text vector
    │   ├── crypto.js           PBKDF2 PIN, AES-GCM secrets
    │   ├── providers.js        Groq, Cerebras, NVIDIA, Ollama, OpenAI, Anthropic, Gemini
    │   ├── voice.js            Wake word, push-to-talk, TTS, speaker verification
    │   ├── bridge.js           Desktop Bridge adapter (SAFE / REQUIRES_APPROVAL / BLOCKED)
    │   ├── memory.js           Structured 10-category memory
    │   ├── search.js           Multi-fallback web search
    │   ├── scheduler.js        Cron + interval automations
    │   ├── research.js         Search → extract → verify → compare → summarize
    │   ├── email.js            Draft + send (approval required)
    │   ├── browser.js          In-app iframe + Desktop Bridge browser actions
    │   ├── files.js            PDF / DOCX / CSV / JSON / image
    │   ├── security.js         PIN, audit, session
    │   ├── automation.js       NL task creation, automation list
    │   └── orchestrator.js     High-level run() / runWorkflow()
    ├── agents/                  14 specialist agents + CEO
    ├── views.js                 17 view renderers
    ├── router.js                Hash-based router
    └── app.js                   Main app glue
```

---

## Credits & license

LOSWRR AI OS is built on the open-source
[Aitzaz-OS](https://github.com/muhammadlai/Aitzaz-OS) foundation (MIT,
© 2026 Chris Lassiter) — itself inspired by the JARVIS-class voice,
memory, agent, and security systems in that ecosystem, plus Alice
desktop (MIT, Slava Trofimov), Hermes Agent, and the broader
JARVIS-style open-source lineage.

The LOSWRR AI OS additions — the CEO orchestrator, multi-agent system,
premium command-center UI, Job Hunter, Lead Hunter, CRM, Desktop Bridge
spec, voice interface, memory architecture, AI Provider Manager, and
the CEO/OWNER identity (Aitzaz) — are added on top of that foundation.

**MIT — see [LICENSE](../LICENSE).** The original Aitzaz-OS code is
preserved unchanged. Branded UI surfaces, marketing copy, and the
LOSWRR identity are added for this build.

---

## Quick start workflow

1. Open `loswrr/` in Chrome.
2. Enter PIN `0000`. The CEO greets you: "Good evening, Sir Aitzaz.
   How can I help?"
3. Type or speak a command, e.g. "Find remote customer support jobs
   paying more than $800."
4. The CEO delegates to the Job Hunter, the results stream in, and
   the activity drawer records every step.
5. "Save the best five." They are saved.
6. "Remember that remote work is my priority." It is stored in
   long-term memory.
7. "What is my job priority?" The CEO answers correctly.
8. "Create a follow-up task for tomorrow." A task is created.
9. "Open Chrome and search for my saved job." The Browser Agent
   performs the action.

That is LOSWRR AI OS. It is a real operating system around the JARVIS
engine, not a mockup.
