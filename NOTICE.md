# Aitzaz AI Pro — Notices & Attribution

Aitzaz AI Pro is a modification (fork/rebranding) of the open-source project
**jarvis_ai** (https://github.com/eadmin2/jarvis_ai), Copyright (c) 2026
Chris Lassiter, licensed under the MIT License.

The original project's architecture and functionality — the FastAPI voice
pipeline server, the holographic HUD, the Hermes Agent integration, the
push-to-talk/wake-word desktop client, the GPU STT worker, the
`hud_display` Hermes plugin, and the launchd templates — are preserved and
extended in this repository. The original code was **not** written from
scratch for Aitzaz AI Pro, and this notice is kept so that attribution
remains accurate.

## What Aitzaz AI Pro adds on top of jarvis_ai

- Continuous, always-on listening: server-side VAD (`server/vad.py`) with
  silero and energy engines, pre-roll, hysteresis, and utterance capping —
  no Listen button anywhere.
- Continuous-listening WebSocket protocol extensions
  (`mode`, `audio_stream_*`, `speech_started/speech_stopped`,
  `listen_state`) — fully backward-compatible with the original protocol.
- An animated holographic avatar system (`server/hud/avatar/`) driven by the
  live pipeline states, with a documented swap-in contract.
- PWA installability (manifest + service worker + icons) for phone installs.
- Desktop packaging (Electron app, Windows install.bat, Linux desktop entry).
- Aitzaz branding (name, identity, config defaults) and a privacy-visible
  listening state (LISTENING / PROCESSING / SPEAKING / PAUSED / MIC OFF).
- End-to-end tests for the continuous conversation loop.

## Third-party components

| Component | License | Purpose |
|---|---|---|
| [jarvis_ai](https://github.com/eadmin2/jarvis_ai) © Chris Lassiter | MIT | base voice pipeline + HUD |
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) © Nous Research | Apache-2.0 | agent brain (external, not bundled) |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | MIT | local speech-to-text |
| [RealtimeSTT](https://github.com/KoljaB/RealtimeSTT) © Kolja Beigel | MIT | realtime STT engine |
| [silero-vad](https://github.com/snakers4/silero-vad) | MIT | voice activity detection |
| [ElevenLabs](https://elevenlabs.io) | service | text-to-speech (external API) |
| HUD aesthetics inspired by [jarvis-dashboard](https://github.com/AndrewKochulab/jarvis-dashboard) | — | visual inspiration |
| test audio `tests/assets/jfk.wav` | public-domain recording (whisper.cpp sample) | VAD tests |

## License

MIT — see [LICENSE](LICENSE). The MIT license text below is the original
project's license, retained in full:

```
MIT License

Copyright (c) 2026 Chris Lassiter

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
