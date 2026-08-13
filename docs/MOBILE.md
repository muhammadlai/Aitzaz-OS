# Aitzaz AI Pro — Mobile (Android / iOS)

## What ships today

The HUD is a full **PWA**: it ships a web app manifest, a service worker and
maskable icons, so on both Android and iOS it installs from the browser
(**Add to Home Screen** / **Install app**) as a full-screen app with the
Aitzaz icon, and it keeps its shell offline. Everything else — continuous
listening, avatar, voice replies, approvals — is identical to the desktop
experience because all intelligence lives in the voice pipeline server.

## Setup on the phone

1. The server must be reachable over your LAN with TLS (browser mic requires
   a secure context): run `server/scripts/make-certs.sh` on the server.
2. On the phone, install the cert once:
   - **iOS**: browse to `https://<server>:8766/hud/aitzaz.cer`, install the
     profile, then enable it under Settings → General → About → Certificate
     Trust Settings.
   - **Android**: download `cert.pem` and install as a CA certificate
     (Settings → Security → Install a certificate).
3. Open `https://<server>/hud/` (or `https://aitzaz.local/hud/`), enter your
   `AITZAZ_HUD_TOKEN`, then **Add to Home Screen**.
4. Launch it: Aitzaz boots, arms the mic (the OS shows its normal microphone
   permission prompt the first time), and enters LISTENING. PAUSE / MIC OFF
   controls are on the VOICE LINK panel; the OS mic indicator is always
   visible while the mic is armed.

Known browser notes: iOS Safari requires the PWA to be foregrounded for
audio; the status-bar mic indicator shows while the mic is open. If the
screen locks, listening pauses — relaunch to re-arm.

## A native mobile client (future)

The platform abstraction already exists — see `docs/ARCHITECTURE.md` for the
WebSocket protocol and `core/` for shared constants. A native client is a
thin implementation of:

1. mic capture at 16 kHz mono PCM (OS permission flow),
2. WebSocket to `/ws`:
   - `{"type":"mode","mode":"continuous"}`
   - `{"type":"audio_stream_start"}`
   - stream PCM, render `listen_state`/`speech_*`/`agent_status` events,
   - render the avatar (a canvas implementation lives in
     `server/hud/avatar/aitzaz-avatar.js` and ports directly),
   - play binary PCM replies through the device speaker.
3. Buttons for PAUSE / MIC OFF / STOP (privacy controls).

No server changes are required — the server treats all clients identically.
