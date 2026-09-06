"""Fail-closed M1 confidence, class and diagnostic-contract tests."""
import json
import sys
from pathlib import Path

import numpy as np
import pytest

SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))

from analyze_m1_rvm import evaluate_threshold, select_threshold, threshold_grid  # noqa: E402
from diagnose_m1 import parse_args, trace_to_dict  # noqa: E402
from pipeline import M1DetectionTrace, M1Pipeline  # noqa: E402


class _Tensor:
    def __init__(self, value): self.value = np.asarray(value)
    def cpu(self): return self
    def numpy(self): return self.value


class _Boxes:
    xyxy = _Tensor([[10, 10, 90, 90]])
    cls = _Tensor([0])
    conf = _Tensor([0.60])
    def __len__(self): return 1


class _Result:
    boxes = _Boxes()


class _Detector:
    def predict(self, *args, **kwargs): return [_Result()]


def fake_pipeline():
    pipeline = object.__new__(M1Pipeline)
    pipeline.infer_conf = 0.05
    pipeline.decision_conf = 0.65
    pipeline.min_area_frac = 0.02
    pipeline.allowed_ids = {0, 1}
    pipeline.det_imgsz = 640
    pipeline.det = _Detector()
    pipeline.det_path = Path("models/m1_detect_640.onnx")
    return pipeline


def test_decision_confidence_is_separate_from_inference_floor():
    result = fake_pipeline().run(np.zeros((100, 100, 3), dtype=np.uint8))
    assert result.poly is None


def test_trace_keeps_raw_low_confidence_candidate_and_reason():
    trace = fake_pipeline().trace(np.zeros((100, 100, 3), dtype=np.uint8))
    assert trace.reason == "BELOW_DECISION_CONF"
    assert trace.raw_detections[0]["class_name"] == "metal_can"
    assert trace.raw_detections[0]["confidence"] == pytest.approx(0.60)


def test_diagnostic_launcher_rejects_serial():
    with pytest.raises(SystemExit):
        parse_args(["--source", "0", "--session-id", "s", "--label", "empty", "--item-id", "i", "--lighting", "normal", "--enable-serial"])


def test_trace_serializes_public_acceptance():
    trace = M1DetectionTrace(
        reason="ACCEPTED_PET_BOTTLE", raw_detections=(), selected={"class_name": "pet_bottle", "confidence": 0.8},
        model_path="m.onnx", decision_conf=0.65, min_area_frac=0.02, frame_shape=(100, 120), inference_ms=2.0,
    )
    row = trace_to_dict(trace, session_id="s", trial_id="t", frame_index=1, timestamp="now", label="pet_bottle", item_id="i", lighting="bright", original_frame=(120, 100), model_hash="m", config_hash="c")
    assert row["model2_would_be_invoked"] is True
    assert row["serial_enabled"] is False
    json.dumps(row)


def _record(label, cls, confidence, frame_index):
    selected = None if cls is None else {"class_name": cls, "confidence": confidence, "area_frac": 0.20}
    return {"session_id": "s", "trial_id": "t", "frame_index": frame_index, "_report_label": label,
            "best_visible_candidate": selected, "final_reason": "NO_DETECTION" if selected is None else "ACCEPTED_METAL_CAN"}


def test_threshold_grid_and_selection_are_deterministic():
    assert threshold_grid()[0] == 0.2
    assert threshold_grid()[-1] == 0.8
    rows = [_record("metal_can", "metal_can", 0.90, 1), _record("pet_bottle", "pet_bottle", 0.90, 2), _record("empty", "metal_can", 0.10, 3)]
    results = [evaluate_threshold(rows, t) for t in threshold_grid()]
    assert select_threshold(results)["decision_conf"] == 0.8
    assert all(r["pp_false_positives"] == 0 for r in results)
