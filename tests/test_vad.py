"""Unit test for server/vad.py — feeds real speech embedded in noise into
both VAD engines and verifies speech onset/offset segmentation.

Requires a real 16 kHz mono speech WAV at tests/assets/jfk.wav
(JFK sample from the whisper.cpp repo, CC0/public domain recording).

Run:  .venv/bin/python tests/test_vad.py
"""

import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from vad import SileroVAD, EnergyVAD, FRAME  # noqa: E402

SR = 16000
TEST_WAV = Path(__file__).resolve().parent / "assets" / "jfk.wav"


def make_signal():
    """Real speech embedded in noise: 1.2s noise -> speech -> 1.2s noise ->
    speech -> 1.2s noise. Mirrors a real two-utterance session."""
    speech, sr = sf.read(str(TEST_WAV))
    assert sr == 16000, f"test wav must be 16 kHz (got {sr})"
    speech = (speech.astype(np.float32) * 0.9)[: int(SR * 2.5)]  # ~2.5s of speech
    rng = np.random.default_rng(42)
    noise1 = (rng.standard_normal(int(SR * 1.2)) * 0.008).astype(np.float32)
    noise2 = (rng.standard_normal(int(SR * 1.2)) * 0.008).astype(np.float32)
    noise3 = (rng.standard_normal(int(SR * 1.2)) * 0.008).astype(np.float32)
    return np.concatenate([noise1, speech, noise2, speech, noise3])


def run_engine(engine_name, make_engine):
    starts, ends, lengths = [], [], []
    frame_no = [0]

    def on_start():
        starts.append(frame_no[0])

    def on_end(pcm: bytes):
        assert starts, "speech end without start"
        lengths.append(len(pcm))
        ends.append(frame_no[0])

    vad = make_engine(on_start, on_end)
    signal = make_signal()
    for i in range(0, len(signal) - FRAME, FRAME):
        frame_no[0] = i // FRAME
        vad.feed(signal[i:i + FRAME])
    print(f"[{engine_name}] speech segments detected: {len(starts)}")
    for idx, (s, e, ln) in enumerate(zip(starts, ends, lengths)):
        print(f"  segment {idx}: start={s * FRAME / SR:.2f}s end={e * FRAME / SR:.2f}s "
              f"audio_ms={ln / 2 / (SR / 1000):.0f}")
    assert len(starts) == 2, f"{engine_name}: expected 2 segments, got {len(starts)}"
    # each utterance carries roughly the speech duration (+ pre-roll)
    for ln in lengths:
        ms = ln / 2 / (SR / 1000)
        assert 600 < ms < 4500, f"{engine_name}: implausible utterance length {ms:.0f} ms"
    # starts must lie inside the speech regions (speech blocks at 1.2–3.7s
    # and 4.9–7.4s)
    assert 0.8 * SR / FRAME < starts[0] < 3.0 * SR / FRAME, f"{engine_name}: seg0 start off ({starts[0]})"
    assert 3.2 * SR / FRAME < starts[1] < 7.2 * SR / FRAME, f"{engine_name}: seg1 start off ({starts[1]})"
    print(f"[{engine_name}] PASS\n")


def main():
    run_engine("silero", lambda s, e: SileroVAD(on_speech_start=s, on_speech_end=e,
                                               start_frames=2, end_frames=20))
    run_engine("energy", lambda s, e: EnergyVAD(on_speech_start=s, on_speech_end=e,
                                                start_frames=3, end_frames=20))
    print("ALL VAD TESTS PASSED")


if __name__ == "__main__":
    main()
