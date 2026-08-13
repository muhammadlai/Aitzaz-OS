"""Aitzaz AI Pro — shared assistant core.

Platform-agnostic constants, state model and event vocabulary used by every
frontend (browser HUD, desktop client, future mobile clients) so that all
platforms speak the same language to the voice pipeline server.

This module intentionally has NO third-party dependencies and no I/O: it is
the contract between platforms.
"""

from core.assistant import (
    ASSISTANT_NAME,
    ASSISTANT_TITLE,
    VERSION,
    AssistantState,
    EVENT_TYPES,
    ListeningMode,
)

__all__ = [
    "ASSISTANT_NAME",
    "ASSISTANT_TITLE",
    "VERSION",
    "AssistantState",
    "EVENT_TYPES",
    "ListeningMode",
]
