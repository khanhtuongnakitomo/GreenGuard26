"""Record the current Nano B01 confidence behavior without loading a device backend.

This intentionally differs from the PC's 0.65 decision floor. Changing these
expectations requires a separate runtime-alignment decision and device validation.
"""
import os
import sys
from types import SimpleNamespace

import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))
from pipeline import M1Pipeline  # noqa: E402


@pytest.mark.parametrize("confidence, visible", [(0.01, False), (0.60, True), (0.80, True)])
def test_current_jetson_candidate_floor(confidence, visible):
    output = np.zeros((1, 7, 2), dtype=np.float32)
    output[0, :4, 0] = [208, 208, 160, 240]
    output[0, 5, 0] = confidence
    # A stronger PP cup must still be ignored before selecting the PET object.
    output[0, :4, 1] = [208, 208, 160, 240]
    output[0, 6, 1] = 0.99
    pipeline = M1Pipeline.__new__(M1Pipeline)
    pipeline.det = SimpleNamespace(
        imgsz=416,
        labels=["metal_can", "pet_bottle", "pp_cup"],
        backend=SimpleNamespace(run=lambda blob: output),
    )
    pipeline.det_conf = 0.05
    pipeline.min_area_frac = 0.02
    pipeline.visible_ids = {0, 1}
    result = pipeline.run(np.zeros((416, 416, 3), dtype=np.uint8))
    assert (result.poly is not None) is visible
    if visible:
        assert result.is_pet
