"""OpenCV UI helpers for the PC demo."""
from __future__ import annotations

import cv2
import numpy as np

BTN_H, BTN_W, BTN_GAP, BTN_MARGIN = 44, 130, 12, 16
M2_COLORS = {0: (0, 0, 255), 1: (0, 255, 255), 2: (255, 0, 255)}


def scale_for_display(frame: np.ndarray, scale: float) -> np.ndarray:
    h, w = frame.shape[:2]
    return cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LINEAR)


def button_rects(frame_w: int, frame_h: int):
    y2 = frame_h - BTN_MARGIN
    y1 = y2 - BTN_H
    pause = (frame_w - BTN_MARGIN - BTN_W, y1, frame_w - BTN_MARGIN, y2)
    start = (pause[0] - BTN_GAP - BTN_W, y1, pause[0] - BTN_GAP, y2)
    return start, pause


def hit_button(x: int, y: int, rect) -> bool:
    x1, y1, x2, y2 = rect
    return x1 <= x <= x2 and y1 <= y <= y2


def draw_button(frame, rect, label: str, active: bool, enabled: bool = True):
    x1, y1, x2, y2 = rect
    if not enabled:
        fill, border, text = (50, 50, 50), (90, 90, 90), (140, 140, 140)
    elif active:
        fill, border, text = (0, 140, 0), (0, 220, 0), (255, 255, 255)
    else:
        fill, border, text = (40, 40, 40), (200, 200, 200), (230, 230, 230)
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), fill, -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
    cv2.rectangle(frame, (x1, y1), (x2, y2), border, 2)
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
    cv2.putText(
        frame,
        label,
        (x1 + (x2 - x1 - tw) // 2, y1 + (y2 - y1 + th) // 2),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        text,
        2,
    )


def draw_controls(frame, detecting: bool):
    h, w = frame.shape[:2]
    start_r, pause_r = button_rects(w, h)
    draw_button(frame, start_r, "START", active=detecting, enabled=not detecting)
    draw_button(frame, pause_r, "PAUSE", active=not detecting, enabled=detecting)
    return start_r, pause_r


def draw_paused_banner(frame: np.ndarray) -> None:
    banner = "PAUSED — click START or press S / Space"
    (tw, th), _ = cv2.getTextSize(banner, cv2.FONT_HERSHEY_SIMPLEX, 0.85, 2)
    cv2.rectangle(
        frame,
        (frame.shape[1] // 2 - tw // 2 - 10, 8),
        (frame.shape[1] // 2 + tw // 2 + 10, 8 + th + 18),
        (0, 0, 0),
        -1,
    )
    cv2.putText(
        frame,
        banner,
        (frame.shape[1] // 2 - tw // 2, 8 + th + 8),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.85,
        (0, 180, 255),
        2,
    )


def draw_verdict(frame: np.ndarray, verdict: str, color: tuple[int, int, int]) -> None:
    if not verdict:
        return
    (tw, th), _ = cv2.getTextSize(verdict, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
    cv2.rectangle(
        frame,
        (frame.shape[1] // 2 - tw // 2 - 8, 8),
        (frame.shape[1] // 2 + tw // 2 + 8, 8 + th + 16),
        (0, 0, 0),
        -1,
    )
    cv2.putText(
        frame,
        verdict,
        (frame.shape[1] // 2 - tw // 2, 8 + th + 6),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        color,
        2,
    )


def draw_legend(frame: np.ndarray, legend: list[tuple[str, tuple[int, int, int]]]) -> None:
    for i, (text, color) in enumerate(legend):
        cv2.putText(frame, text, (12, 30 + i * 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2)


def draw_m1_poly(frame: np.ndarray, poly: np.ndarray, color: tuple[int, int, int]) -> None:
    cv2.polylines(frame, [poly.astype(np.int32)], True, color, 2)


def draw_m2_hits(frame: np.ndarray, hits) -> None:
    for hit in hits:
        color = M2_COLORS.get(hit.class_id, (255, 255, 255))
        cv2.polylines(frame, [hit.polygon.astype(np.int32)], True, color, 2)
