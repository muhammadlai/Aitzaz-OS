# Aitzaz AI Pro — avatar integration contract

This directory is the **avatar system mount point**. Any avatar system (2D
image, canvas animation, video sprite, WebGL/Live2D/VRM 3D model, …) plugs
into the HUD through one tiny contract — the pipeline never needs to change.

## Contract (what the HUD expects)

The HUD loads `avatar/aitzaz-avatar.js` and drives it with a global object
that exposes:

```js
AitzazAvatar.init(hostElement)          // mount the avatar into the host
AitzazAvatar.setState(state)            // "booting" | "idle" | "listening" |
                                        // "speech" | "thinking" | "speaking" |
                                        // "paused" | "mic_off" | "stopped" | "error"
AitzazAvatar.setMicLevel(0..1)          // live microphone level (optional)
AitzazAvatar.setSpeakLevel(0..1)        // live TTS output level (optional)
AitzazAvatar.destroy()                  // unmount
```

`setState` is called from the exact same event stream that drives speech
recognition and the voice reply, so the avatar reacts to the real assistant:

| Pipeline event                | Avatar state |
|-------------------------------|--------------|
| boot sequence                 | `booting`    |
| server ready                  | `idle`       |
| `listen_state: listening`     | `listening`  |
| `speech_started`              | `speech`     |
| `agent_status: thinking/tool` | `thinking`   |
| `agent_status: speaking`      | `speaking`   |
| `listen_state: paused`        | `paused`     |
| mic released by user          | `mic_off`    |
| `listen_state: stopped`       | `stopped`    |
| `error`                       | `error`      |

## Swapping in your own avatar files

1. Drop your avatar's assets (images, models, scripts, shaders…) into this
   folder.
2. Replace (or wrap) the implementation of `aitzaz-avatar.js` so the same
   five functions are still exposed — everything else in the HUD keeps
   working untouched. The built-in implementation is a good reference: it is
   pure canvas 2D with no build step, just like the rest of the HUD.
3. If your avatar needs assets beyond code, register them in the service
   worker cache list in `server/hud/sw.js` so they keep working offline /
   when installed as a PWA.

## Voice / animation behavior

The built-in avatar already satisfies the assistant requirements:

- stays visible while Aitzaz is active,
- animates while listening (attentive visor + live mic level),
- animates while thinking (scan sweep + fast orbits),
- animates while speaking (mouth waveform synced to TTS output level),
- idles with breathing glow + blinking,
- reacts naturally to voice (mic level and speech level feed the animation).

Preserve these behaviors in any replacement: the states above map 1:1 to the
conversation loop (`LISTEN → SPEECH → PROCESS → SPEAK → LISTEN`).
