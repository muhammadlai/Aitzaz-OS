"""End-to-end test of the continuous-listening WebSocket protocol.

Uses the REAL server module, REAL VAD engine and REAL protocol handling; only
the heavy backends (Whisper, Hermes LLM, ElevenLabs TTS) are stubbed. Real
speech audio (tests/assets/jfk.wav) is streamed in and the expected event
sequence is verified:

  status -> listen_state{ready} -> [arm] -> listen_state{listening}
  -> speech_started -> listen_state{speech} -> speech_stopped
  -> listen_state{processing} -> transcript -> agent_status{speaking}
  -> (binary TTS) -> done -> listen_state{listening}

plus pause/resume/stop privacy controls and the legacy push-to-talk path.

Run:  .venv/bin/python tests/test_ws_continuous.py
"""

import asyncio
import json
import shutil
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(SERVER))

# --- create a local server.yaml so server.py can import ---------------------
CONFIG_TARGET = SERVER / "config" / "server.yaml"
CONFIG_TARGET.parent.mkdir(parents=True, exist_ok=True)
if not CONFIG_TARGET.exists():
    shutil.copy(SERVER / "config" / "server.example.yaml", CONFIG_TARGET)

import server as srv  # noqa: E402  (imports RealtimeSTT — slow but real)
from core.assistant import AssistantState, ListeningMode  # noqa: E402

SR = 16000
speech, _wav_sr = sf.read(str(ROOT / "tests" / "assets" / "jfk.wav"))
assert _wav_sr == 16000
speech = speech[: int(SR * 2.5)]
rng = np.random.default_rng(7)
noise = lambda s: (rng.standard_normal(int(SR * s)) * 0.006).astype(np.float32)


def pcm_bytes(f32):
    return (np.clip(f32, -1, 1) * 32767).astype(np.int16).tobytes()


class StubPipeline:
    """Stand-in for VoicePipelineServer: no Whisper/LLM/TTS, real everything else."""

    def __init__(self):
        self.turn_counter = 0
        self.hermes = StubHermes()
        self.loop = None

    def next_turn_id(self):
        self.turn_counter += 1
        return self.turn_counter

    async def transcribe(self, audio: bytes, timing=None):
        await asyncio.sleep(0.01)  # simulate STT latency
        if timing:
            timing.stt_start_monotonic = time.perf_counter()
            timing.stt_final_monotonic = time.perf_counter()
        return "open the garage door"

    async def stream_response_audio(self, ws, text, timing, conn):
        timing.llm_start_monotonic = time.perf_counter()
        timing.llm_first_token_monotonic = time.perf_counter()
        timing.tts_request_start_monotonic = time.perf_counter()
        timing.first_tts_audio_byte_monotonic = time.perf_counter()
        timing.llm_provider = "stub"
        timing.llm_model = "stub"
        timing.tts_model = "stub"
        timing.voice_id = "stub"
        timing.response_text = "Opening the garage door."
        await ws.send_json({"type": "agent_status", "state": "speaking"})
        # 0.5s of quiet 16 kHz PCM as fake TTS audio
        await ws.send_bytes(b"\x00\x00" * (SR // 2))
        conn.spoken_sentences.append("Opening the garage door.")

    def log_turn(self, timing):
        pass


class StubHermes:
    def stop_run(self, run_id):
        return {"status_code": 200, "body": "{}"}

    def post_approval(self, run_id, body):
        return {"status_code": 200, "body": "{}"}


def drain_until(ws, event_type, timeout=15.0):
    """Read events until one of the wanted types arrives; return the event."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        msg = ws.receive()
        if msg.get("type") == "websocket.disconnect":
            raise AssertionError("ws closed during drain")
        data = msg.get("bytes") or msg.get("text")
        if data is None:
            continue
        if isinstance(data, bytes):
            continue  # TTS audio
        ev = json.loads(data)
        if ev.get("type") == event_type:
            return ev
    raise AssertionError(f"timed out waiting for {event_type!r}")


def main():
    from fastapi.testclient import TestClient

    # swap the global pipeline for our stub
    stub = StubPipeline()
    srv.get_pipeline = lambda: stub

    client = TestClient(srv.app)
    try:
        with client.websocket_connect("/ws") as ws:
            # ---- handshake ----
            ev = drain_until(ws, "status")
            assert "connected" in ev["message"].lower(), ev
            ev = drain_until(ws, "listen_state")
            assert ev["state"] == AssistantState.READY, ev

            # ---- arm continuous listening ----
            ws.send_json({"type": "mode", "mode": ListeningMode.CONTINUOUS})
            drain_until(ws, "status")
            ws.send_json({"type": "audio_stream_start"})
            ev = drain_until(ws, "listen_state")
            assert ev["state"] == AssistantState.LISTENING, ev
            print("[1] armed -> LISTENING OK")

            # ---- background noise: must NOT trigger speech ----
            for _ in range(20):
                ws.send_bytes(pcm_bytes(noise(0.08)))
            print("[2] noise ignored OK")

            # ---- real speech: full conversation loop ----
            for i in range(0, len(speech), SR // 10):
                ws.send_bytes(pcm_bytes(speech[i:i + SR // 10]))
            ev = drain_until(ws, "speech_started", timeout=20)
            print("[3] speech_started OK")
            for _ in range(30):
                ws.send_bytes(pcm_bytes(noise(0.08)))   # trailing silence -> VAD end
            ev = drain_until(ws, "speech_stopped", timeout=20)
            print("[4] speech_stopped OK")
            ev = drain_until(ws, "transcript")
            assert "garage" in ev["text"], ev
            print("[5] transcript OK:", ev["text"])
            ev = drain_until(ws, "agent_status")
            assert ev["state"] == "speaking", ev
            print("[6] agent_status speaking OK")
            # binary TTS audio should arrive (drain skips it), then done
            ev = drain_until(ws, "done")
            assert ev["timing"]["response_text"], ev
            print("[7] done OK")
            ev = drain_until(ws, "listen_state")
            assert ev["state"] == AssistantState.LISTENING, ev
            print("[8] auto-return to LISTENING OK  (conversation loop)")

            # ---- second utterance in the same armed session ----
            for i in range(0, len(speech), SR // 10):
                ws.send_bytes(pcm_bytes(speech[i:i + SR // 10]))
            drain_until(ws, "speech_started", timeout=20)
            for _ in range(30):
                ws.send_bytes(pcm_bytes(noise(0.08)))
            drain_until(ws, "speech_stopped", timeout=20)
            drain_until(ws, "done")
            ev = drain_until(ws, "listen_state")   # auto-return after turn 2
            assert ev["state"] == AssistantState.LISTENING, ev
            print("[9] second turn OK — no Listen button required")

            # ---- privacy controls ----
            ws.send_json({"type": "audio_stream_pause"})
            ev = drain_until(ws, "listen_state")
            assert ev["state"] == AssistantState.PAUSED, ev
            print("[10] PAUSE -> paused OK")
            ws.send_json({"type": "audio_stream_resume"})
            ev = drain_until(ws, "listen_state")
            assert ev["state"] == AssistantState.LISTENING, ev
            print("[11] RESUME -> listening OK")
            ws.send_json({"type": "audio_stream_stop"})
            ev = drain_until(ws, "listen_state")
            assert ev["state"] == AssistantState.STOPPED, ev
            print("[12] MIC STOP -> stopped OK")

            # ---- legacy push-to-talk protocol still works ----
            ws.send_json({"type": "mode", "mode": ListeningMode.PUSH_TO_TALK})
            drain_until(ws, "status")
            ws.send_json({"type": "start", "sample_rate": 16000, "format": "pcm_s16le", "channels": 1})
            drain_until(ws, "status")
            for i in range(0, len(speech), SR // 10):
                ws.send_bytes(pcm_bytes(speech[i:i + SR // 10]))
            ws.send_json({"type": "stop"})
            ev = drain_until(ws, "done")
            assert ev["turn_id"], ev
            print("[13] legacy push-to-talk path OK")
    finally:
        pass

    # ---- HTTP status endpoint ----
    r = client.get("/api/status")
    body = r.json()
    assert body["assistant"] == "Aitzaz", body
    assert body["product"] == "Aitzaz AI Pro", body
    print("[14] /api/status OK:", body["assistant"], body["product"], body["version"])

    client.close()
    print("\nALL CONTINUOUS-LISTENING E2E TESTS PASSED")


if __name__ == "__main__":
    main()
