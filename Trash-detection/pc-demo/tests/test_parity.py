"""PC runtime parity against validation baseline."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
VALIDATION = ROOT.parent / "validation"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from config_loader import load_config, load_manifest, validate_manifest  # noqa: E402
from pipeline import M1Pipeline, M2Pipeline  # noqa: E402

CONF_TOL = 1e-4


def poly_iou(a: np.ndarray, b: np.ndarray) -> float:
    from cv2 import contourArea, intersectConvexConvex

    a1 = contourArea(a.astype(np.float32))
    a2 = contourArea(b.astype(np.float32))
    ret, inter = intersectConvexConvex(a.astype(np.float32), b.astype(np.float32))
    if ret <= 0 or inter is None:
        return 0.0
    inter_area = contourArea(inter.astype(np.float32))
    return float(inter_area / (a1 + a2 - inter_area + 1e-6))


@pytest.fixture(scope="module")
def baseline():
    path = VALIDATION / "contracts" / "baseline.json"
    if not path.is_file():
        path = VALIDATION / "contracts" / "main.json"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def pipelines():
    validate_manifest(load_manifest())
    cfg = load_config("default")
    return M1Pipeline(cfg), M2Pipeline(cfg)


@pytest.mark.parametrize("fixture_name", ["m1_reference.jpg", "blank.jpg", "can_sample.jpg", "pet_sample.jpg"])
def test_m1_parity(fixture_name, baseline, pipelines):
    if baseline.get("m1_contract") != "hbb_dt3":
        pytest.skip("legacy OBB/classifier baseline is not valid for imported HBB Model 1")
    if fixture_name not in baseline.get("fixtures", {}):
        pytest.skip("fixture not in baseline")
    m1_pipe, _ = pipelines
    img = cv2.imread(str(VALIDATION / "fixtures" / fixture_name))
    assert img is not None
    expected = baseline["fixtures"][fixture_name]["m1"]
    result = m1_pipe.run(img)
    if expected.get("detections", 0) == 0:
        assert result.poly is None
        return
    assert result.poly is not None
    exp_poly = np.array(expected["polygon"], dtype=np.float32)
    assert poly_iou(result.poly.astype(np.float32), exp_poly) >= 0.90
