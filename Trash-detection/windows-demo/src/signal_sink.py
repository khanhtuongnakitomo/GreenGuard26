"""Strict one-line stdout output for completed detections."""
from __future__ import annotations


class SignalSink:
    """Write exactly one ASCII result line and flush it immediately."""

    ALLOWED = frozenset({0, 1, 2})

    def __init__(self, stream):
        self.stream = stream

    def emit(self, value: int) -> None:
        if type(value) is not int or value not in self.ALLOWED:
            raise ValueError(f"invalid detection signal: {value!r}")
        self.stream.write(f"{value}\n")
        self.stream.flush()
