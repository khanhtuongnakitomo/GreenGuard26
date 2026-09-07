"""Minimal public UI: workflow phase/result only."""
from __future__ import annotations

import cv2


def render(view, controller_connected: bool, width: int, height: int):
    # ``controller_connected`` remains an adapter-compatible argument, but
    # serial/COM diagnostics are deliberately not part of the public kiosk
    # surface.  Operators can inspect the separate self-check/diagnostic logs.
    del controller_connected
    canvas = __import__("numpy").zeros((height, width, 3), dtype="uint8")
    canvas[:] = (24, 30, 38)
    cv2.putText(canvas, view.title, (70, 180), cv2.FONT_HERSHEY_SIMPLEX, 1.5, view.color, 3, cv2.LINE_AA)
    cv2.putText(canvas, view.subtitle, (70, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (220, 225, 230), 2, cv2.LINE_AA)
    if view.result:
        cv2.putText(canvas, view.result, (70, 310), cv2.FONT_HERSHEY_SIMPLEX, 1.0, view.color, 2, cv2.LINE_AA)
    return canvas
