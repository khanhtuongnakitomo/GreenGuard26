"""Redacted fixed-camera machine UI: live frame, state/result, Run/Pause."""
from __future__ import annotations

import cv2
import numpy as np


BTN_H, BTN_W, BTN_GAP, BTN_MARGIN = 48, 150, 16, 18


def button_rects(frame_w: int, frame_h: int):
    y2 = frame_h - BTN_MARGIN
    y1 = y2 - BTN_H
    pause = (frame_w - BTN_MARGIN - BTN_W, y1, frame_w - BTN_MARGIN, y2)
    run = (pause[0] - BTN_GAP - BTN_W, y1, pause[0] - BTN_GAP, y2)
    return run, pause


def hit_button(x: int, y: int, rect) -> bool:
    x1, y1, x2, y2 = rect
    return x1 <= x <= x2 and y1 <= y <= y2


def _button(frame, rect, label: str, active: bool):
    x1, y1, x2, y2 = rect
    fill = (0, 125, 0) if active else (45, 45, 45)
    border = (0, 220, 0) if active else (210, 210, 210)
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), fill, -1)
    cv2.addWeighted(overlay, 0.78, frame, 0.22, 0, frame)
    cv2.rectangle(frame, (x1, y1), (x2, y2), border, 2)
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.75, 2)
    cv2.putText(
        frame,
        label,
        (x1 + (x2 - x1 - tw) // 2, y1 + (y2 - y1 + th) // 2),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )


def render(frame: np.ndarray, state: str, result: str, running: bool) -> np.ndarray:
    """Return only the camera image with operator state and Run/Pause."""
    canvas = frame.copy()
    color = (0, 210, 0) if result in {"CANS", "GOOD"} else (0, 0, 255) if result == "BAD" else (0, 200, 255)
    text = state
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1.0, 2)
    x = max(12, (canvas.shape[1] - tw) // 2)
    cv2.rectangle(canvas, (x - 12, 12), (x + tw + 12, 24 + th + 12), (0, 0, 0), -1)
    cv2.putText(canvas, text, (x, 24 + th), cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 2, cv2.LINE_AA)
    if result and state != result:
        cv2.putText(canvas, result, (18, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2, cv2.LINE_AA)
    run_rect, pause_rect = button_rects(canvas.shape[1], canvas.shape[0])
    _button(canvas, run_rect, "RUN", running)
    _button(canvas, pause_rect, "PAUSE", not running)
    return canvas
