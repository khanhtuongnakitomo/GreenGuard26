"""Minimal public UI: workflow phase/result only."""
from __future__ import annotations

import cv2


def render(view, controller_connected: bool, width: int, height: int):
    canvas = __import__("numpy").zeros((height, width, 3), dtype="uint8")
    canvas[:] = (24, 30, 38)
    cv2.putText(canvas, view.title, (70, 180), cv2.FONT_HERSHEY_SIMPLEX, 1.5, view.color, 3, cv2.LINE_AA)
    cv2.putText(canvas, view.subtitle, (70, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (220, 225, 230), 2, cv2.LINE_AA)
    status = "SERIAL CONNECTED" if controller_connected else "CAMERA-ONLY / SERIAL DISABLED"
    cv2.putText(canvas, status, (70, height - 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (180, 190, 200), 2, cv2.LINE_AA)
    return canvas
