"""OpenCV UI helpers for the PC demo."""
from __future__ import annotations

import json
from datetime import datetime, timezone

import cv2
import numpy as np

BTN_H, BTN_W, BTN_GAP, BTN_MARGIN = 44, 130, 12, 16
CAM_BTN_W = 100
M2_COLORS = {0: (0, 0, 255), 1: (0, 255, 255), 2: (255, 0, 255)}



def scale_for_display(frame: np.ndarray, scale: float) -> np.ndarray:
    h, w = frame.shape[:2]
    return cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LINEAR)


def button_rects(frame_w: int, frame_h: int):
    y2 = frame_h - BTN_MARGIN
    y1 = y2 - BTN_H
    pause = (frame_w - BTN_MARGIN - BTN_W, y1, frame_w - BTN_MARGIN, y2)
    start = (pause[0] - BTN_GAP - BTN_W, y1, pause[0] - BTN_GAP, y2)
    cam = (start[0] - BTN_GAP - CAM_BTN_W, y1, start[0] - BTN_GAP, y2)
    return start, pause, cam


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


def draw_controls(frame, detecting: bool, cam_label: str = "CAM 0"):
    h, w = frame.shape[:2]
    start_r, pause_r, cam_r = button_rects(w, h)
    draw_button(frame, start_r, "RUN", active=detecting, enabled=not detecting)
    draw_button(frame, pause_r, "PAUSE", active=not detecting, enabled=detecting)
    draw_cam_button(frame, cam_r, cam_label)
    return start_r, pause_r, cam_r


def draw_cam_button(frame, rect, label: str):
    """Draw the camera-switch button with a distinctive cyan accent."""
    x1, y1, x2, y2 = rect
    fill, border, text = (60, 40, 10), (255, 200, 0), (255, 220, 80)
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), fill, -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
    cv2.rectangle(frame, (x1, y1), (x2, y2), border, 2)
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    cv2.putText(
        frame,
        label,
        (x1 + (x2 - x1 - tw) // 2, y1 + (y2 - y1 + th) // 2),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        text,
        2,
    )


def draw_paused_banner(frame: np.ndarray) -> None:
    banner = "PAUSED — click RUN or press S / Space"
    (tw, th), _ = cv2.getTextSize(banner, cv2.FONT_HERSHEY_SIMPLEX, 0.85, 2)
    cv2.rectangle(
        frame,
        (frame.shape[1] // 2 - tw // 2 - 10, 8),
        (frame.shape[1] // 2 + tw // 2 + 10, 8 + th + 18),
        (0, 0, 0),
        -1,
    )


def draw_session_panel(frame: np.ndarray, session: dict) -> None:
    """Show the active manual-session quantities and GreenPoint total."""
    items = session.get("items") or []
    quantities = {str(item.get("itemType")): int(item.get("quantity", 0)) for item in items if isinstance(item, dict)}
    rows = [
        ("PET tốt", quantities.get("pet_clean", 0), (0, 220, 170)),
        ("PET tệ", quantities.get("pet_bad", 0), (0, 120, 255)),
        ("Lon nhôm", quantities.get("aluminum", 0), (0, 220, 255)),
        ("TỔNG", int(session.get("totalItems", 0)), (255, 255, 255)),
        ("ĐIỂM", int(session.get("totalPoints", 0)), (180, 100, 255)),
    ]
    x, y, width = max(12, frame.shape[1] - 230), 12, 215
    height = 32 + len(rows) * 25
    overlay = frame.copy()
    cv2.rectangle(overlay, (x - 8, y - 6), (x + width, y + height), (18, 18, 18), -1)
    cv2.addWeighted(overlay, 0.82, frame, 0.18, 0, frame)
    cv2.putText(frame, "SESSION", (x, y + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 220, 80), 2)
    for index, (label, value, color) in enumerate(rows):
        cv2.putText(frame, f"{label:<9} {value}", (x, y + 40 + index * 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)


def draw_qr_screen(frame: np.ndarray, qr_payload: str | None, session: dict) -> None:
    """Render the latest signed GreenPoint QR without running camera inference."""
    frame[:] = (245, 245, 245)
    h, w = frame.shape[:2]
    title = "GREENPOINT CLAIM QR"
    (tw, th), _ = cv2.getTextSize(title, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
    cv2.putText(frame, title, ((w - tw) // 2, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (20, 20, 20), 2)
    if not qr_payload:
        msg = "NO QR YET — PRESS F TO FINALIZE"
        (mw, mh), _ = cv2.getTextSize(msg, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)
        cv2.putText(frame, msg, ((w - mw) // 2, h // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 190), 2)
        return
    try:
        encoder = cv2.QRCodeEncoder_create()
        matrix = encoder.encode(str(qr_payload))
        matrix = np.asarray(matrix)
        if matrix.ndim == 3:
            matrix = matrix[:, :, 0]
        matrix = (matrix > 0).astype(np.uint8) * 255
        side = min(w // 2, h - 115)
        qr = cv2.resize(matrix, (side, side), interpolation=cv2.INTER_NEAREST)
        x, y = 18, 55
        frame[y:y + side, x:x + side] = cv2.cvtColor(qr, cv2.COLOR_GRAY2BGR)
        cv2.rectangle(frame, (x - 2, y - 2), (x + side + 2, y + side + 2), (0, 0, 0), 2)
    except Exception as exc:
        cv2.putText(frame, f"QR RENDER ERROR: {exc}", (18, h // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 200), 2)
        return
    items = session.get("items") or []
    quantities = {str(item.get("itemType")): int(item.get("quantity", 0)) for item in items if isinstance(item, dict)}
    lines = [
        f"PET tốt: {quantities.get('pet_clean', 0)}",
        f"PET tệ: {quantities.get('pet_bad', 0)}",
        f"Lon nhôm: {quantities.get('aluminum', 0)}",
        f"TỔNG: {session.get('totalItems', 0)} items / {session.get('totalPoints', 0)} points",
        "Q — RETURN TO DETECTION",
    ]
    try:
        expires_at = json.loads(str(qr_payload)).get("expiresAt")
        expires = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
        if expires <= datetime.now(timezone.utc):
            lines.insert(-1, "EXPIRED")
    except (ValueError, TypeError, json.JSONDecodeError):
        pass
    x_text = min(w // 2 + 25, w - 300)
    for index, line in enumerate(lines):
        color = (0, 0, 180) if index == len(lines) - 1 else (20, 20, 20)
        cv2.putText(frame, line, (x_text, 105 + index * 36), cv2.FONT_HERSHEY_SIMPLEX, 0.62, color, 2)
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


def draw_preview_confidence_panel(
    frame: np.ndarray,
    model_label: str,
    m1_label: str,
    m1_confidence: float,
    m1_accepted: bool,
    m2_values: dict[str, float],
    progress: int,
    window_size: int = 4,
    thresholds: dict[str, float] | None = None,
    status_text: str | None = None,
) -> None:
    """Draw the fixed four-row confidence panel used by the parallel preview."""
    x, y, width, row_h = 12, 12, 360, 30
    thresholds = thresholds or {"cap": 0.5, "label": 0.5, "ring": 0.3}
    rows = [
        ("MODEL 1", f"{m1_label} / {'ACCEPTED' if m1_accepted else 'BELOW'}", m1_confidence, (0, 220, 0) if m1_accepted else (0, 180, 255)),
        ("MODEL 2", "CAP", m2_values.get("cap", 0.0), (0, 0, 255) if m2_values.get("cap", 0.0) >= thresholds.get("cap", 0.5) else (230, 230, 230)),
        ("MODEL 2", "LABEL", m2_values.get("label", 0.0), (0, 0, 255) if m2_values.get("label", 0.0) >= thresholds.get("label", 0.5) else (230, 230, 230)),
        ("MODEL 2", "RING", m2_values.get("ring", 0.0), (0, 0, 255) if m2_values.get("ring", 0.0) >= thresholds.get("ring", 0.3) else (230, 230, 230)),
    ]
    panel_h = 62 + len(rows) * row_h
    overlay = frame.copy()
    cv2.rectangle(overlay, (x - 6, y - 6), (x + width, y + panel_h), (18, 18, 18), -1)
    cv2.addWeighted(overlay, 0.78, frame, 0.22, 0, frame)
    cv2.putText(frame, model_label, (x, y + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (255, 220, 80), 2)
    for index, (group, name, confidence, color) in enumerate(rows):
        text = f"{group:<8} {name:<20} {confidence * 100:5.1f}%"
        cv2.putText(frame, text, (x, y + 42 + index * row_h), cv2.FONT_HERSHEY_SIMPLEX, 0.52, color, 2)
    footer = status_text or f"VOTING {min(progress, window_size)}/{window_size}"
    cv2.putText(frame, footer, (x, y + panel_h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (0, 220, 255), 2)


def draw_preview_result(frame: np.ndarray, result: str, signal: int, status: str = "NOT SENT") -> None:
    """Draw the frozen, preview-only result and explicitly unsent signal."""
    if not result:
        return
    color = {"ALUMINUM": (0, 235, 0), "GOOD PET": (0, 210, 0), "BAD PET": (0, 0, 255)}.get(result, (255, 255, 255))
    h, w = frame.shape[:2]
    (tw, th), _ = cv2.getTextSize(result, cv2.FONT_HERSHEY_SIMPLEX, 1.8, 4)
    cy = h // 2
    cv2.rectangle(frame, (w // 2 - tw // 2 - 22, cy - th - 48), (w // 2 + tw // 2 + 22, cy + 82), (0, 0, 0), -1)
    cv2.putText(frame, result, (w // 2 - tw // 2, cy), cv2.FONT_HERSHEY_SIMPLEX, 1.8, color, 4)
    signal_text = f"SIGNAL {signal} — {status}"
    (sw, sh), _ = cv2.getTextSize(signal_text, cv2.FONT_HERSHEY_SIMPLEX, 0.78, 2)
    cv2.putText(frame, signal_text, (w // 2 - sw // 2, cy + 48), cv2.FONT_HERSHEY_SIMPLEX, 0.78, (255, 255, 255), 2)
