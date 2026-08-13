"""Aitzaz AI Pro — always-on voice activity detection (continuous listening).

This module turns the voice pipeline into an always-armed microphone loop:

    armed mic stream ──► VAD ──► speech detected ──► capture utterance
                        └─► silence ──► hand the utterance to the normal
                            STT → brain → TTS pipeline ──► back to armed

Two engines are provided:

* ``silero`` (default) — the Silero VAD model (already a dependency of the
  original RealtimeSTT stack). Robust to background noise.
* ``energy`` — a dependency-free adaptive RMS threshold. A lightweight
  fallback for machines where torch is unavailable.

Privacy: audio is processed in RAM only. While armed, samples live in a short
pre-roll ring buffer so speech onset is not clipped; everything except the
current utterance is discarded frame by frame. The final utterance bytes are
kept only long enough to be transcribed, then dropped. Nothing is ever
written to disk.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

import numpy as np

SAMPLE_RATE = 16000
FRAME = 512  # 32 ms @ 16 kHz (Silero VAD native frame size)


@dataclass
class VADEvent:
    pass


class BaseVAD:
    """Interface implemented by every VAD engine."""

    def __init__(self, on_speech_start=None, on_speech_end=None):
        self.on_speech_start = on_speech_start
        self.on_speech_end = on_speech_end

    def feed(self, samples: np.ndarray) -> None:  # pragma: no cover - interface
        raise NotImplementedError

    def reset(self) -> None:
        raise NotImplementedError


class SileroVAD(BaseVAD):
    """Silero-model VAD with hysteresis, pre-roll and utterance capping."""

    def __init__(
        self,
        threshold: float = 0.5,
        start_frames: int = 3,          # consecutive speech frames to start
        end_frames: int = 25,           # consecutive silence frames to end (~0.8s)
        pre_roll_ms: int = 350,         # audio kept before speech onset
        max_utterance_s: float = 20.0,  # hard cap on one utterance
        on_speech_start=None,
        on_speech_end=None,
    ):
        super().__init__(on_speech_start, on_speech_end)
        self.threshold = threshold
        self.start_frames = start_frames
        self.end_frames = end_frames
        self.pre_roll_frames = max(1, int(SAMPLE_RATE * pre_roll_ms / 1000 / FRAME))
        self.max_frames = int(SAMPLE_RATE * max_utterance_s / FRAME)

        # lazy torch import: keeps `energy` engine dependency-free
        try:
            from silero_vad import load_silero_vad
        except Exception as exc:  # pragma: no cover - env dependent
            raise RuntimeError(
                "Silero VAD requested but 'silero-vad' is not installed. "
                "Install it, or set vad.engine: energy in server.yaml."
            ) from exc
        self._model = load_silero_vad()
        self._model.eval()

        self._pending = np.empty(0, dtype=np.float32)   # partial frame buffer
        self._pre_roll = []                              # frames before speech
        self._utterance: list[np.ndarray] = []
        self._in_speech = False
        self._speech_streak = 0
        self._silence_streak = 0
        self._frames = 0
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ feed
    def feed(self, samples: np.ndarray) -> None:
        """Consume float32 mono 16 kHz samples of any length."""
        if samples.dtype != np.float32:
            samples = samples.astype(np.float32)
        with self._lock:
            self._pending = np.concatenate([self._pending, samples.ravel()])
            while self._pending.size >= FRAME:
                frame = self._pending[:FRAME]
                self._pending = self._pending[FRAME:]
                self._process_frame(frame)

    def _process_frame(self, frame: np.ndarray) -> None:
        speech = self._is_speech(frame)
        if not self._in_speech:
            self._pre_roll.append(frame)
            if len(self._pre_roll) > self.pre_roll_frames:
                self._pre_roll.pop(0)
            if speech:
                self._speech_streak += 1
                self._silence_streak = 0
                if self._speech_streak >= self.start_frames:
                    self._enter_speech()
            else:
                self._speech_streak = 0
        else:
            self._utterance.append(frame)
            self._frames += 1
            if not speech:
                self._silence_streak += 1
                if self._silence_streak >= self.end_frames:
                    self._exit_speech()
            else:
                self._silence_streak = 0
            if self._frames >= self.max_frames:
                # Long monologue: finalize what we have instead of waiting
                self._exit_speech()

    def _is_speech(self, frame: np.ndarray) -> bool:
        try:
            with torch_no_grad():
                prob = self._model(torch_from_numpy(frame), SAMPLE_RATE).item()
            return prob >= self.threshold
        except Exception:
            # Never let a VAD hiccup kill the listen loop; treat as silence
            return False

    # ------------------------------------------------------------- lifecycle
    def _enter_speech(self) -> None:
        self._in_speech = True
        self._utterance = list(self._pre_roll)  # keep onset context
        self._pre_roll.clear()
        self._frames = len(self._utterance)
        self._speech_streak = 0
        self._silence_streak = 0
        if self.on_speech_start:
            try:
                self.on_speech_start()
            except Exception:
                pass

    def _exit_speech(self) -> None:
        self._in_speech = False
        self._speech_streak = 0
        self._silence_streak = 0
        frames = self._utterance
        self._utterance = []
        self._frames = 0
        if self.on_speech_end:
            try:
                pcm = np.concatenate(frames) if frames else np.empty(0, dtype=np.float32)
                self.on_speech_end(float32_to_int16(pcm))
            except Exception:
                pass

    def reset(self) -> None:
        with self._lock:
            self._pending = np.empty(0, dtype=np.float32)
            self._pre_roll = []
            self._utterance = []
            self._in_speech = False
            self._speech_streak = 0
            self._silence_streak = 0
            self._frames = 0


class EnergyVAD(BaseVAD):
    """Dependency-free adaptive-energy VAD (fallback engine).

    Tracks a slow noise floor and triggers when the RMS level exceeds it for
    several consecutive frames. Tuned for desktop/browser mics.
    """

    def __init__(
        self,
        ratio: float = 2.6,
        start_frames: int = 4,
        end_frames: int = 28,
        pre_roll_ms: int = 350,
        max_utterance_s: float = 20.0,
        abs_min_rms: float = 0.01,   # hard floor: quieter than this is never speech
        warmup_ms: int = 600,        # fast floor learning at startup
        on_speech_start=None,
        on_speech_end=None,
    ):
        super().__init__(on_speech_start, on_speech_end)
        self.ratio = ratio
        self.start_frames = start_frames
        self.end_frames = end_frames
        self.pre_roll_frames = max(1, int(SAMPLE_RATE * pre_roll_ms / 1000 / FRAME))
        self.max_frames = int(SAMPLE_RATE * max_utterance_s / FRAME)
        self.abs_min_rms = abs_min_rms
        self._warmup_frames = max(0, int(SAMPLE_RATE * warmup_ms / 1000 / FRAME))
        self._noise_floor = 1e-4
        self._pending = np.empty(0, dtype=np.float32)
        self._pre_roll: list[np.ndarray] = []
        self._utterance: list[np.ndarray] = []
        self._in_speech = False
        self._speech_streak = 0
        self._silence_streak = 0
        self._frames = 0
        self._lock = threading.Lock()

    def feed(self, samples: np.ndarray) -> None:
        if samples.dtype != np.float32:
            samples = samples.astype(np.float32)
        with self._lock:
            self._pending = np.concatenate([self._pending, samples.ravel()])
            while self._pending.size >= FRAME:
                frame = self._pending[:FRAME]
                self._pending = self._pending[FRAME:]
                self._process_frame(frame)

    def _is_speech(self, rms: float) -> bool:
        return rms > max(self._noise_floor * self.ratio, self.abs_min_rms)

    def _process_frame(self, frame: np.ndarray) -> None:
        rms = float(np.sqrt(np.mean(np.square(frame))) + 1e-9)
        speech = self._is_speech(rms)
        if not self._in_speech:
            self._pre_roll.append(frame)
            if len(self._pre_roll) > self.pre_roll_frames:
                self._pre_roll.pop(0)
            if speech:
                self._speech_streak += 1
                if self._speech_streak >= self.start_frames:
                    self._enter_speech()
            else:
                self._speech_streak = 0
                # adapt toward the ambient noise level (fast at warm-up, slow after)
                if self._warmup_frames > 0:
                    self._warmup_frames -= 1
                    self._noise_floor = 0.90 * self._noise_floor + 0.10 * rms
                else:
                    self._noise_floor = 0.98 * self._noise_floor + 0.02 * rms
        else:
            self._utterance.append(frame)
            self._frames += 1
            if not speech:
                self._silence_streak += 1
                if self._silence_streak >= self.end_frames:
                    self._exit_speech()
            else:
                self._silence_streak = 0
            if self._frames >= self.max_frames:
                self._exit_speech()

    def _enter_speech(self) -> None:
        self._in_speech = True
        self._utterance = list(self._pre_roll)
        self._pre_roll.clear()
        self._frames = len(self._utterance)
        self._speech_streak = 0
        self._silence_streak = 0
        if self.on_speech_start:
            try:
                self.on_speech_start()
            except Exception:
                pass

    def _exit_speech(self) -> None:
        self._in_speech = False
        self._speech_streak = 0
        self._silence_streak = 0
        frames = self._utterance
        self._utterance = []
        self._frames = 0
        if self.on_speech_end:
            try:
                pcm = np.concatenate(frames) if frames else np.empty(0, dtype=np.float32)
                self.on_speech_end(float32_to_int16(pcm))
            except Exception:
                pass

    def reset(self) -> None:
        with self._lock:
            self._pending = np.empty(0, dtype=np.float32)
            self._pre_roll = []
            self._utterance = []
            self._in_speech = False
            self._speech_streak = 0
            self._silence_streak = 0
            self._frames = 0


# ------------------------------------------------------------- torch helpers
_torch = None


def _get_torch():
    global _torch
    if _torch is None:
        import torch

        _torch = torch
    return _torch


def torch_from_numpy(frame: np.ndarray):
    return _get_torch().from_numpy(frame)


def torch_no_grad():
    return _get_torch().no_grad()


def float32_to_int16(samples: np.ndarray) -> bytes:
    pcm = np.clip(samples, -1.0, 1.0) * 32767.0
    return pcm.astype(np.int16).tobytes()


def make_vad(cfg: dict, on_speech_start=None, on_speech_end=None) -> BaseVAD:
    """Build the configured VAD engine from the ``vad:`` config section."""
    vad_cfg = cfg.get("vad") or {}
    engine = (vad_cfg.get("engine") or "silero").lower()
    kwargs = dict(
        on_speech_start=on_speech_start,
        on_speech_end=on_speech_end,
    )
    if engine == "silero":
        return SileroVAD(
            threshold=float(vad_cfg.get("threshold", 0.5)),
            start_frames=int(vad_cfg.get("start_frames", 3)),
            end_frames=int(vad_cfg.get("end_frames", 25)),
            pre_roll_ms=int(vad_cfg.get("pre_roll_ms", 350)),
            max_utterance_s=float(vad_cfg.get("max_utterance_seconds", 20.0)),
            **kwargs,
        )
    if engine == "energy":
        return EnergyVAD(
            ratio=float(vad_cfg.get("ratio", 2.6)),
            start_frames=int(vad_cfg.get("start_frames", 4)),
            end_frames=int(vad_cfg.get("end_frames", 28)),
            pre_roll_ms=int(vad_cfg.get("pre_roll_ms", 350)),
            max_utterance_s=float(vad_cfg.get("max_utterance_seconds", 20.0)),
            abs_min_rms=float(vad_cfg.get("abs_min_rms", 0.01)),
            warmup_ms=int(vad_cfg.get("warmup_ms", 600)),
            **kwargs,
        )
    raise ValueError(f"Unknown vad.engine: {engine!r} (use 'silero' or 'energy')")
