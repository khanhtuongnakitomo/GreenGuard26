from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
import pytest

SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from audit_m1_rvm import audit  # noqa: E402
from evaluate_m1_rvm import apply_gates  # noqa: E402
from m1_rvm_common import load_config, parse_label_line, validate_hbb_record  # noqa: E402
from prepare_m1_rvm import _adjust_image, _read_review_manifest, _split_groups  # noqa: E402


def test_model1_contract_rejects_model2_obb_rows() -> None:
    row = parse_label_line("3 0.1 0.1 0.2 0.1 0.2 0.2 0.1 0.2")
    assert row["field_count"] == 9
    assert validate_hbb_record(row) == "expected exactly 5 YOLO HBB fields"


def test_review_manifest_requires_labeled_boxes() -> None:
    with tempfile.TemporaryDirectory(dir=Path.cwd()) as directory:
        path = Path(directory) / "review.jsonl"
        path.write_text('{"image":"x.jpg","class_id":0,"bbox":[0.5,0.5,0.2,0.3],"source_group":"g1","lighting":"bright","sequence_id":"s1"}\n', encoding="utf-8")
        records = _read_review_manifest(path)
        assert records[0]["class_id"] == 0
        path.write_text('{"image":"x.jpg","class_id":0,"bbox":[0.5,0.5,2.0,0.3],"source_group":"g1","lighting":"bright","sequence_id":"s1"}\n', encoding="utf-8")
        with pytest.raises(ValueError, match=r"in \[0, 1\]"):
            _read_review_manifest(path)


def test_grouped_split_never_splits_a_source_group() -> None:
    records = [{"source_group": f"g{i}"} for i in range(9)]
    split = _split_groups(records, seed=42, fractions=(0.7, 0.15, 0.15))
    assert set(split) == {f"g{i}" for i in range(9)}
    assert len(set(split.values())) == 3


def test_photometric_augmentation_is_deterministic_and_keeps_shape() -> None:
    image = np.full((48, 64, 3), 128, dtype=np.uint8)
    first = _adjust_image(image, variant=4, seed=42)
    second = _adjust_image(image, variant=4, seed=42)
    assert np.array_equal(first, second)
    assert first.shape == image.shape
    assert not np.array_equal(first, image)


def test_audit_current_live_source_stops_before_training() -> None:
    config = load_config()
    report = audit(config, "pytest_m1_rvm_audit")
    assert report["status"] == "NEEDS_DATA"
    assert report["images_with_valid_hbb_labels"] == 0
    assert "obb_yolo_9" in report["format_counts"]


def test_evaluation_is_fail_closed_without_all_rvm_gates() -> None:
    config = load_config()
    baseline = {
        "per_class": {name: {"precision": 0.90, "recall": 0.90} for name in ("metal_can", "pet_bottle", "pp_cup")},
        "macro": {"f1": 0.90},
    }
    candidate = {
        "per_class": {name: {"precision": 0.96, "recall": 0.96} for name in ("metal_can", "pet_bottle", "pp_cup")},
        "macro": {"f1": 0.96},
        "gates": {},
    }
    report = apply_gates(config, baseline, candidate)
    assert report["status"] == "FAIL"
    assert any("cross_confusion" in failure for failure in report["failures"])
