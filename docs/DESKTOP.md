# Aitzaz AI Pro — Desktop App (Download & Install)

Yeh desktop app ek **thin shell** hai: ye aap ke self-hosted Aitzaz server
(`server/server.py`) se connect hota hai aur poori AI-core HUD ko ek native
window mein dikhata hai. Ismein koi AI/voice processing nahi hoti — sab kuch
server par hota hai, aur app sirf connect hota hai (isi liye halka aur fast).

> **Zaroori:** App chalane se pehle aap ka Aitzaz server pehle se chal raha
> hona chahiye aur dono devices ek hi network (Wi-Fi/LAN) par hon.
> Server setup ke liye dekho [docs/SETUP.md](SETUP.md).

---

## 📥 Installers download karna

Installers do tareeqon se milte hain:

1. **GitHub Releases** — repo ke
   [Releases](https://github.com/muhammadlai/Aitzaz-OS/releases) page par
   (jab bhi `v*` tag push hota hai, CI workflow sab platforms ke liye
   installers bana kar release par upload kar deta hai — see "CI" niche).
2. **Khud build karo** — niche "Build from source" dekho.

Har platform ki file:

| Platform | File | Note |
| --- | --- | --- |
| Windows | `Aitzaz-AI-Pro-Windows-<ver>-Setup.exe` | NSIS installer |
| macOS | `Aitzaz-AI-Pro-Mac-<ver>.dmg` | unsigned (see note) |
| Linux | `Aitzaz-AI-Pro-Linux-<ver>-<arch>.deb` / `.AppImage` | x64 + arm64 |
| **Chromebook** | Linux `.deb` (Crostini ke andar) | see below |

---

## 💻 Chromebook par chalana (Crostini / Linux)

Chromebook (ChromeOS) native desktop apps **directly** nahi chalata, lekin
har modern Chromebook mein built-in **Linux environment (Crostini)** hota hai —
uske andar Linux apps (jaise ye Electron app) chalte hain. Steps:

1. **Linux on karo:**
   Settings → **About ChromeOS** → **Developers** → **Linux development
   environment** → **Turn on**. (Pehli baar 5–10 minute lagte hain.)

2. **`.deb` file download karo** Releases page se (x64 Chromebook ke liye
   `x64`, ARM Chromebook ke liye `arm64` file). File `Downloads` folder mein
   save hoti hai jo Linux container ke saath share hoti hai
   (`/mnt/chromeos/MyFiles/Downloads`).

3. **Install karo** — Linux terminal kholo (app drawer mein "Terminal"):

   ```bash
   cd /mnt/chromeos/MyFiles/Downloads
   sudo apt install ./Aitzaz-AI-Pro-Linux-*-x64.deb
   ```

   (ARM Chromebook par `-arm64.deb` wali file.)

4. **Launch karo** — app drawer ke **Linux apps** folder mein
   **"Aitzaz AI Pro"** nazar aayega. Kholo.

5. **Mic allow karo:**
   - Pehli baar mic use karne par ChromeOS poochega — **Allow** karo.
   - Agar nahi puchta: Settings → **About ChromeOS → Developers → Linux** →
     **Microphone** → on.

6. **Connect karo** — app mein server ka address likho, e.g.
   `https://192.168.1.20` (server wali machine ka LAN IP). Done ✅

> **Note:** Low-end Chromebooks par local Whisper/STT (server par chalta hai)
> normal hai, lekin server ki baat hai — Chromebook sirf HUD display karta hai,
> is liye performance achi rahegi. Server aur Chromebook ek hi Wi-Fi par hon.

---

## 🪟 Windows

1. `Aitzaz-AI-Pro-Windows-<ver>-Setup.exe` download karo, run karo.
2. SmartScreen warning aaye to **More info → Run anyway** (app unsigned hai).
3. Launch karo, server address likho, connect.

Mic work karega directly — koi extra certificate trust ki zaroorat nahi
(Electron self-signed cert ko sirf aap ke configured host ke liye accept karta
hai).

## 🍎 macOS

1. `Aitzaz-AI-Pro-Mac-<ver>.dmg` kholo, app ko **Applications** mein drag karo.
2. Pehli baar kholne par: **System Settings → Privacy & Security → Open Anyway**
   (app unsigned hai — ye warning expected hai).
3. Mic permission allow karo jab prompt aaye.

## 🐧 Linux

```bash
# Debian/Ubuntu
sudo apt install ./Aitzaz-AI-Pro-Linux-<ver>-x64.deb

# ya kisi bhi distro par AppImage
chmod +x Aitzaz-AI-Pro-Linux-<ver>-x64.AppImage
./Aitzaz-AI-Pro-Linux-<ver>-x64.AppImage
```

---

## ⚙️ App kaise kaam karta hai

- **First run:** app poochta hai *"Server address"* — wahan aap apne Aitzaz
  server ka address likho (e.g. `https://192.168.1.20`, `https://jarvis.local`,
  ya port ke saath `https://192.168.1.20:8766`). App khud `/hud/` laga deta hai.
- Address **save** rehta hai (`config.json` userData folder mein); agla launch
  seedha HUD par khulta hai.
- HUD ka **PIN/token gate** waise hi kaam karta hai — ek baar token daalne ke
  baad cookie **persist** rehti hai (app restart par dobara nahi maangta).
- Server ka **self-signed TLS cert** sirf aap ke configured host ke liye accept
  hota hai (baaki sab block).
- `Ctrl/Cmd + ,` = settings (server address badalna), `F11` = full screen,
  `Ctrl/Cmd + R` = reload.
- Agar server unreachable ho to app **"SERVER NAHIN MILA"** screen dikhata hai
  jahan se Retry ya Settings khol sakte ho.

---

## 🔨 Build from source

```bash
cd desktop
npm install
npm run build:linux     # .deb + .AppImage (x64 + arm64)
npm run build:win       # Windows NSIS setup (Windows par chalao, ya CI se)
npm run build:mac       # macOS dmg (macOS par chalao, ya CI se)
```

Output `desktop/release/<version>/` mein milta hai.

**CI se sab platforms ek saath:** repo mein ready-made workflow
[`docs/workflows/build-desktop.yml`](workflows/build-desktop.yml) hai. Isay enable
karne ke liye:

```bash
mkdir -p .github/workflows
cp docs/workflows/build-desktop.yml .github/workflows/build-desktop.yml
git add .github/workflows && git commit -m "Enable desktop installer CI" && git push
```

Uske baad `v1.0.0` jaisa tag push karo (ya Actions tab se `workflow_dispatch`
chalao) — Windows/Mac/Linux sab installers GitHub Release par ban kar aa jayenge:

```bash
git tag v1.0.0 && git push origin v1.0.0
```
