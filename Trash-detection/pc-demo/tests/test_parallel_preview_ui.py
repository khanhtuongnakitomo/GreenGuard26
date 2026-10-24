from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import ui  # noqa: E402


def test_preview_panel_has_one_model1_row_and_three_model2_rows(monkeypatch):
    captured = []
    original = ui.cv2.putText

    def record(image, text, *args):
        captured.append(str(text))
        return original(image, text, *args)

    monkeypatch.setattr(ui.cv2, "putText", record)
    ui.draw_preview_confidence_panel(
        np.zeros((480, 640, 3), dtype=np.uint8),
        "MODEL 1 ACTIVE",
        "PET",
        0.823,
        True,
        {"cap": 0.51, "label": 0.0, "ring": 0.672},
        3,
    )
    rows = [text for text in captured if text.startswith("MODEL 1  ") or text.startswith("MODEL 2  ")]
    assert len(rows) == 4
    assert rows[0].startswith("MODEL 1")
    assert [row.split()[2] for row in rows[1:]] == ["CAP", "LABEL", "RING"]
    assert "VOTING 3/4" in captured


def test_preview_result_is_large_and_explicitly_unsent(monkeypatch):
    captured = []
    original = ui.cv2.putText

    def record(image, text, *args):
        captured.append(str(text))
        return original(image, text, *args)

    monkeypatch.setattr(ui.cv2, "putText", record)
    ui.draw_preview_result(np.zeros((480, 640, 3), dtype=np.uint8), "BAD PET", 2)
    assert "BAD PET" in captured
    assert "SIGNAL 2 — NOT SENT" in captured


def test_preview_result_can_identify_dashboard_only_delivery(monkeypatch):
    captured = []
    original = ui.cv2.putText

    def record(image, text, *args):
        captured.append(str(text))
        return original(image, text, *args)

    monkeypatch.setattr(ui.cv2, "putText", record)
    ui.draw_preview_result(
        np.zeros((480, 640, 3), dtype=np.uint8),
        "GOOD PET",
        1,
        status="DASHBOARD ONLY",
    )
    assert "SIGNAL 1 — DASHBOARD ONLY" in captured
