"""Aitzaz AI Pro — assistant identity, state machine and event vocabulary.

Every frontend (browser HUD, desktop client, future Android/iOS clients) uses
these values so that the assistant behaves identically across platforms.
"""

from __future__ import annotations

# ------------------------------------------------------------------ identity
ASSISTANT_NAME = "Aitzaz"
ASSISTANT_TITLE = "Aitzaz AI Pro"
VERSION = "1.0.0"

# -------------------------------------------------------------------- states
# The conversation loop: READY -> LISTENING -> SPEECH -> PROCESSING ->
# SPEAKING -> back to LISTENING. PAUSED / MIC_OFF / STOPPED are user-driven.
class AssistantState:
    BOOTING = "booting"        # initializing modules, loading avatar
    READY = "ready"            # initialized, waiting to enter listening
    LISTENING = "listening"    # mic armed, VAD waiting for speech
    SPEECH = "speech"          # user speech detected, capturing utterance
    PROCESSING = "processing"  # STT + AI brain working
    SPEAKING = "speaking"      # streaming voice reply
    PAUSED = "paused"          # listening suspended by the user
    MIC_OFF = "mic_off"        # microphone disabled by the user
    STOPPED = "stopped"        # assistant stopped

    LISTENING_STATES = {"listening", "speech"}
    BUSY_STATES = {"processing", "speaking"}

    # user-facing labels
    LABELS = {
        BOOTING: "INITIALIZING",
        READY: "READY",
        LISTENING: "LISTENING",
        SPEECH: "SPEECH DETECTED",
        PROCESSING: "PROCESSING",
        SPEAKING: "SPEAKING",
        PAUSED: "PAUSED",
        MIC_OFF: "MIC OFF",
        STOPPED: "STOPPED",
    }


class ListeningMode:
    """How the microphone is driven for a voice session."""

    CONTINUOUS = "continuous"      # mic stays armed; VAD segments utterances
    PUSH_TO_TALK = "push_to_talk"  # classic click/Enter to start & stop
    WAKE_WORD = "wake_word"        # client-side wake word gates the stream


# ------------------------------------------------------------------- events
# WebSocket JSON event vocabulary (server -> client) plus control messages
# (client -> server). Backward compatible with the original jarvis_ai
# protocol; the `mode` / `audio_stream_*` / `speech_*` / `listen_state`
# messages are additive.
EVENT_TYPES = {
    # client -> server
    "START": "start",                              # manual turn begin (barge-in capable)
    "STOP": "stop",                                # manual turn end
    "STOP_RUN": "stop_run",                        # halt the running agent turn
    "APPROVAL_DECISION": "approval_decision",
    "MODE": "mode",                                # set ListeningMode
    "STREAM_START": "audio_stream_start",          # continuous: begin streaming mic
    "STREAM_PAUSE": "audio_stream_pause",          # continuous: suspend stream
    "STREAM_RESUME": "audio_stream_resume",
    "STREAM_STOP": "audio_stream_stop",            # continuous: stop + release mic
    # server -> client
    "STATUS": "status",
    "LISTEN_STATE": "listen_state",                # {state: AssistantState}
    "SPEECH_STARTED": "speech_started",
    "SPEECH_STOPPED": "speech_stopped",
    "PARTIAL_TRANSCRIPT": "partial_transcript",
    "TRANSCRIPT": "transcript",
    "RUN_STARTED": "run_started",
    "AGENT_STATUS": "agent_status",
    "APPROVAL_REQUEST": "approval_request",
    "ERROR": "error",
    "DONE": "done",
}
