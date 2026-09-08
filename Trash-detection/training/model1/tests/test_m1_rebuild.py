"""Deterministic tests for the Model 1 rebuild data contract."""
from pathlib import Path
import sys

import numpy as np
import pytest

SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from m1_rebuild import (  # noqa: E402
    CLASS_NAMES,
    augment_image,
    class_metadata_valid,
    fixed_stress_transform,
    group_key,
    load_rejected_hashes,
    normalized_hbb,
    parse_label,
    score_predictions,
    source_mapping,
    split_groups,
    CappedBalancedGroupSampler,
    machine_fixed_split,
)


def test_model1_has_exact_two_classes():
    assert CLASS_NAMES == {0: "metal_can", 1: "pet_bottle"}


def test_obb_whole_object_is_converted_to_enclosing_hbb():
    record = {"field_count": 9, "values": [0.2, 0.3, 0.8, 0.3, 0.8, 0.7, 0.2, 0.7]}
    assert normalized_hbb(record) == pytest.approx((0.5, 0.5, 0.6, 0.4))


def test_invalid_and_clipped_boxes_are_quarantined():
    assert normalized_hbb({"field_count": 5, "values": [0.5, 0.5, 1.2, 0.2]}) is None
    assert normalized_hbb({"field_count": 5, "values": [0.5, 0.5, 0.0, 0.2]}) is None


def test_part_only_sources_have_no_supervised_mapping():
    mapping, _, _ = source_mapping("model1", "live-machine-dataset", {0: "cap", 1: "label", 2: "ring", 3: "can"})
    assert mapping == {}


def test_dataset1_maps_only_documented_can_classes():
    mapping, excluded, explanation = source_mapping("model1", "dataset-1", {0: "0", 1: "1", 2: "2", 3: "can", 4: "cans"})
    assert mapping == {3: 0, 4: 0}
    assert excluded == {0, 1, 2}
    assert "visual" in explanation


def test_dataset6_metal_is_not_automatically_admitted():
    mapping, excluded, explanation = source_mapping("model1", "dataset-6", {0: "PET", 1: "metal", 2: "null"})
    assert mapping == {0: 1}
    assert excluded == {1, 2}
    assert "review" in explanation


def test_candidate_metadata_and_rejected_v7_hash_guard():
    assert class_metadata_valid({0: "metal_can", 1: "pet_bottle"}, ["metal_can", "pet_bottle"])
    assert not class_metadata_valid({0: "pet_bottle", 1: "metal_can"}, ["metal_can", "pet_bottle"])
    rejected = load_rejected_hashes(Path(__file__).resolve().parents[3] / "validation" / "contracts" / "rejected_models.json")
    assert "6f519367def2ef7d78ba7e77c947f18f7c5df795a743f5df1800a2123f6e66db" in rejected


def test_augmentation_is_deterministic_and_keeps_shape():
    image = np.full((32, 48, 3), 128, dtype=np.uint8)
    one = augment_image(image, "bright", 42, {})
    two = augment_image(image, "bright", 42, {})
    assert np.array_equal(one, two)
    assert one.shape == image.shape


def test_group_split_keeps_each_group_together():
    records = [
        {"group": "can-a", "labels": [{"class_id": 0}]},
        {"group": "can-b", "labels": [{"class_id": 0}]},
        {"group": "can-c", "labels": [{"class_id": 0}]},
        {"group": "pet-a", "labels": [{"class_id": 1}]},
        {"group": "pet-b", "labels": [{"class_id": 1}]},
        {"group": "pet-c", "labels": [{"class_id": 1}]},
    ]
    cfg = {"data": {"train_fraction": 0.5, "validation_fraction": 0.25, "holdout_fraction": 0.25, "require_class_in_each_split": True}}
    assignments = split_groups(records, cfg, 42)
    assert set(assignments) == {"can-a", "can-b", "can-c", "pet-a", "pet-b", "pet-c"}
    assert set(assignments.values()) == {"train", "val", "holdout"}


def test_machine_capture_groups_are_atomic_and_reserved_for_holdout():
    live_a = Path("WIN_20260827_17_47_06_Pro.jpg")
    live_b = Path("WIN_20260827_17_47_55_Pro.jpg")
    negative_a = Path("WIN_20260828_14_17_40_Pro.jpg")
    negative_b = Path("WIN_20260828_14_17_47_Pro.jpg")
    assert group_key("dataset-live", live_a) == group_key("dataset-live", live_b)
    assert group_key("true-negative", negative_a) == group_key("true-negative", negative_b)

    records = [
        {"source": "dataset-live", "group": group_key("dataset-live", live_a), "fixed_split": "train", "labels": [{"class_id": 0}]},
        {"source": "dataset-live", "group": group_key("dataset-live", live_b), "fixed_split": "train", "labels": [{"class_id": 0}]},
        {"source": "true-negative", "group": group_key("true-negative", negative_a), "fixed_split": "holdout", "labels": []},
        {"source": "true-negative", "group": group_key("true-negative", negative_b), "fixed_split": "holdout", "labels": []},
        {"source": "other", "group": "pet-a", "labels": [{"class_id": 1}]},
        {"source": "other", "group": "pet-b", "labels": [{"class_id": 1}]},
        {"source": "other", "group": "pet-c", "labels": [{"class_id": 1}]},
        {"source": "other", "group": "can-a", "labels": [{"class_id": 0}]},
        {"source": "other", "group": "can-b", "labels": [{"class_id": 0}]},
        {"source": "other", "group": "can-c", "labels": [{"class_id": 0}]},
    ]
    cfg = {"data": {"train_fraction": 0.5, "validation_fraction": 0.25, "holdout_fraction": 0.25, "require_class_in_each_split": True}}
    assignments = split_groups(records, cfg, 42)
    assert assignments[group_key("dataset-live", live_a)] == "train"
    assert assignments[group_key("true-negative", negative_a)] == "holdout"


def test_observed_machine_sessions_have_frozen_roles():
    assert machine_fixed_split("dataset-live", "dataset-live:machine-capture-sequence") == "train"
    assert machine_fixed_split("live-machine-dataset", "live-machine:GG1:can_1240_1241") == "selection"
    assert machine_fixed_split("live-machine-dataset", "live-machine:GG1:can_1242_1243") == "holdout"
    assert machine_fixed_split("live-machine-dataset", "live-machine:GG2:pet_1555") == "calibration"


def test_group_sampler_is_deterministic_balanced_and_capped():
    class_indices = {0: list(range(6)), 1: list(range(6, 12))}
    groups = {index: f"g{index}" for index in range(12)}
    first = list(CappedBalancedGroupSampler(class_indices, groups, 42, draws_per_epoch=12, per_image_cap=1, per_group_cap=1))
    second = list(CappedBalancedGroupSampler(class_indices, groups, 42, draws_per_epoch=12, per_image_cap=1, per_group_cap=1))
    assert first == second
    assert len(first) == 12
    assert sum(index < 6 for index in first) == 6
    assert len(set(first)) == 12


def test_group_sampler_uses_explicit_cap_when_pool_is_small():
    sampler = CappedBalancedGroupSampler({0: [0], 1: [1]}, {0: "can", 1: "pet"}, 42, draws_per_epoch=4, per_image_cap=1, per_group_cap=2)
    draws = list(sampler)
    assert len(draws) == 4
    assert draws.count(0) <= 2
    assert draws.count(1) <= 2


def test_group_sampler_includes_each_training_negative_once_per_epoch():
    sampler = CappedBalancedGroupSampler(
        {0: [0, 1], 1: [2, 3]},
        {0: "can-a", 1: "can-b", 2: "pet-a", 3: "pet-b", 4: "negative"},
        42,
        draws_per_epoch=4,
        per_image_cap=1,
        per_group_cap=1,
        negative_indices=[4],
    )
    draws = list(sampler)
    assert len(draws) == 5
    assert draws.count(4) == 1


def test_missing_and_empty_labels_are_distinct_audit_inputs():
    missing, missing_errors = parse_label(None)
    empty_path = Path(__file__).with_name("_tmp_empty_label.txt")
    try:
        empty_path.write_text("\n# reviewed empty\n", encoding="utf-8")
        empty, empty_errors = parse_label(empty_path)
    finally:
        empty_path.unlink(missing_ok=True)
    assert missing == [] and missing_errors == ["missing_label"]
    assert empty == [] and empty_errors == []


def test_score_reports_empty_scene_false_positive_and_wrong_class():
    collected = [
        {
            "generated_image": "can.jpg",
            "source_name": "dataset-live",
            "negative": False,
            "width": 100,
            "height": 100,
            "truths": [{"class_id": 0, "box": [10, 10, 90, 90]}],
            "predictions": [
                {"class_id": 1, "confidence": 0.90, "box": [10, 10, 90, 90]},
                {"class_id": 0, "confidence": 0.80, "box": [10, 10, 90, 90]},
            ],
        },
        {
            "generated_image": "empty.jpg",
            "source_name": "true-negative",
            "negative": True,
            "width": 100,
            "height": 100,
            "truths": [],
            "predictions": [{"class_id": 1, "confidence": 0.70, "box": [10, 10, 90, 90]}],
        },
    ]
    result = score_predictions(collected, 0.65, 0.50, min_area_frac=0.02)
    assert result["classes"]["metal_can"]["tp"] == 1
    assert result["classes"]["pet_bottle"]["fp"] == 2
    assert result["empty_machine"]["accepted_detections"] == 1
    assert result["wrong_class_confusions"] == 1


def test_fixed_exposure_stress_is_deterministic_and_bounded():
    image = np.full((20, 30, 3), 200, dtype=np.uint8)
    transform = fixed_stress_transform(0.25)
    one = transform(image, 0, {})
    two = transform(image, 0, {})
    assert np.array_equal(one, two)
    assert one.max() == 50
    assert one.shape == image.shape
