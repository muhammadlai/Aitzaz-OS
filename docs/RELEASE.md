# Aitzaz AI Pro — Release Guide

Two ways to produce installers + a GitHub Release:

1. **GitHub Actions (recommended)** — automatic on a `v*` tag, but requires the
   workflow file in `.github/workflows/` (needs `Workflows` permission).
2. **Manual `scripts/make-release.sh`** — build on your own machine and upload,
   no CI / no workflow permission needed. **Use this if you can't grant the
   GitHub App `Workflows` permission.**

---

## Option 1 — GitHub Actions (automatic)

1. Make sure `.github/workflows/build-app.yml` is in the repo (it currently
   needs `Workflows` permission to be pushed — see below).
2. Grant the GitHub App `Workflows` permission, or add the file via web UI
   (content is a copy of `docs/workflows/build-app.yml`).
3. Push a tag:
   ```bash
   git tag v1.0.0 && git push origin v1.0.0
   ```
   The workflow builds Linux `.deb`/`.AppImage`, Windows `.exe`, macOS `.dmg`
   and attaches them to a GitHub Release.

---

## Option 2 — Manual build on your machine

On a machine with **Node ≥ 22**, **Go ≥ 1.24**, and the **gh CLI** logged in:

```bash
# clone / pull latest
git clone https://github.com/muhammadlai/Aitzaz-OS.git
cd Aitzaz-OS
git pull origin main

# build + create release v1.0.0
chmod +x scripts/make-release.sh
./scripts/make-release.sh 1.0.0
```

The script will:
- create + push the tag `v1.0.0`
- `npm ci` + rebuild native modules + build the Go backend + electron-builder
- collect installers from `app/release/`
- create the GitHub Release and upload the installers to it

Result: https://github.com/muhammadlai/Aitzaz-OS/releases

> **Note:** Gmail/Calendar need real Google OAuth creds. The build uses an
> empty `app/app-config.json`; put real credentials there before rebuilding if
> you want those integrations pre-configured. At runtime you can also add them
> via the app's Settings → Integrations.

---

## Permission note (why GitHub Actions can't be enabled by the bot)

A GitHub **App** cannot create or update files under `.github/workflows/`
unless it has the **`Workflows`** permission (a GitHub platform rule). The
session bot does not have it, so the workflow files cannot be pushed by the
bot. Choose one:

- **Grant the app `Workflows` write permission** in the repo settings
  (Settings → Actions → General), then the bot (or you) can commit
  `.github/workflows/build-app.yml`, **or**
- **Add `.github/workflows/build-app.yml` yourself** via the GitHub web UI
  (copy of `docs/workflows/build-app.yml`), **or**
- **Use Option 2 (manual script)** — no workflow file needed at all.

---

## Downloads by platform

| Platform | File |
|---|---|
| Windows x64 | `Aitzaz-AI-Pro-Windows-<ver>-Setup.exe` |
| macOS arm64 | `Aitzaz-AI-Pro-Mac-<ver>-arm64.dmg` |
| macOS x64 | `Aitzaz-AI-Pro-Mac-<ver>-x64.dmg` |
| Linux x64 | `Aitzaz-AI-Pro-Linux-<ver>-x64.AppImage` / `.deb` |
| Linux arm64 (Chromebook ARM) | `Aitzaz-AI-Pro-Linux-<ver>-arm64.AppImage` / `.deb` |
