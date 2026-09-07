"""Model 1 visibility and PP suppression tests."""
import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))

from config_loader import load_config  # noqa: E402
from pipeline import M1Pipeline, pick_top1_detector  # noqa: E402


def test_pp_cup_is_ignored_before_top1():
    polys = np.asarray(
        [
            [[10, 10], [90, 10], [90, 90], [10, 90]],
            [[20, 20], [80, 20], [80, 80], [20, 80]],
        ],
        dtype=np.float32,
    )
    poly, confidence, index = pick_top1_detector(
        polys,
        np.asarray([2, 1]),
        np.asarray([0.99, 0.80]),
        min_area_frac=0.01,
        frame_area=10000,
        allowed_ids={0, 1},
    )
    assert index == 1
    assert confidence == pytest.approx(0.80)
    assert np.array_equal(poly, polys[1])


def test_only_pp_cup_returns_no_detection():
    poly, confidence, index = pick_top1_detector(
        np.asarray([[[10, 10], [90, 10], [90, 90], [10, 90]]], dtype=np.float32),
        np.asarray([2]),
        np.asarray([0.99]),
        min_area_frac=0.01,
        frame_area=10000,
        allowed_ids={0, 1},
    )
    assert poly is None
    assert confidence == 0.0
    assert index == -1


def test_low_confidence_candidate_is_rejected_by_decision_floor():
    fixture = Path(__file__).resolve().parents[2] / "validation" / "fixtures" / "blank.jpg"
    image = cv2.imread(str(fixture))
    assert image is not None

    result = M1Pipeline(load_config("default")).run(image)

    assert result.poly is None
