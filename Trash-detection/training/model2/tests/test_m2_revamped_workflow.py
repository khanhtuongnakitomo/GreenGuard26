from __future__ import annotations

import random
import sys
from pathlib import Path

import cv2
import numpy as np

MODEL2_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = MODEL2_ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from live_finetune_common import load_config  # noqa: E402
from evaluate_m2_revamped import acceptance_summary  # noqa: E402
from prepare_live_finetune import (  # noqa: E402
    apply_legacy_machine_style,
    assign_balanced_splits,
    live_variant_count,
)


def test_class_aware_variant_count_prioritizes_cap_and_label():
    cfg = load_config(MODEL2_ROOT / "config" / "m2_revamped.yaml", "test_revamped_variants")
    assert live_variant_count(cfg, {"class_presence": {"cap": 1, "label": 0, "ring": 0}}) == 4
    assert live_variant_count(cfg, {"class_presence": {"cap": 0, "label": 1, "ring": 0}}) == 3
    assert live_variant_count(cfg, {"class_presence": {"cap": 0, "label": 0, "ring": 1}}) == 2


def test_balanced_split_keeps_groups_intact_and_covers_scarce_features():
    cfg = load_config(MODEL2_ROOT / "config" / "m2_revamped.yaml", "test_revamped_splits")
    groups = []
    features = [
        ("cap", "dark"), ("label", "normal"), ("ring", "bright"),
        ("cap", "normal"), ("label", "dark"), ("ring", "bright"),
        ("cap", "bright"), ("label", "normal"), ("ring", "dark"),
    ]
    for index, (class_name, lighting) in enumerate(features):
        groups.append({
            "group_id": f"seq_{index:03d}",
            "image_count": 1,
            "features": {
                "class_presence": {class_name: 1},
                "lighting": {lighting: 1},
                "highlight": {"low": 1},
                "orientation": {"vertical": 1},
                "pose": {"tilted_neutral": 1},
            },
            "negative_count": 0,
        })
    assignment = assign_balanced_splits(cfg, groups, {"train": 0.70, "val": 0.15, "holdout": 0.15}, len(groups))
    assert set(assignment) == {group["group_id"] for group in groups}
    assert len(set(assignment.values())) == 3


def test_legacy_machine_style_is_deterministic_and_preserves_shape():
    image = np.full((48, 64, 3), 128, dtype=np.uint8)
    first, first_meta = apply_legacy_machine_style(image, random.Random("same-seed"))
    second, second_meta = apply_legacy_machine_style(image, random.Random("same-seed"))
    assert first.shape == image.shape
    assert np.array_equal(first, second)
    assert first_meta == second_meta


def test_legacy_machine_style_changes_appearance_without_geometry():
    image = np.zeros((32, 32, 3), dtype=np.uint8)
    image[8:24, 12:20] = (80, 120, 180)
    output, _ = apply_legacy_machine_style(image, random.Random("appearance"))
    assert output.shape == image.shape
    assert not np.array_equal(output, image)


def test_staged_config_preserves_three_class_contract():
    cfg = load_config(MODEL2_ROOT / "config" / "m2_revamped.yaml", "test_revamped_contract")
    assert cfg["canonical_names"] == ["cap", "label", "ring"]
    assert cfg["dataset"]["raw_class_to_canonical"] == {0: 1, 1: 0, 2: 2}
    assert cfg["runtime_contract"]["vote_window"] == 7
    assert cfg["runtime_contract"]["vote_need"] == 4


def test_manual_acceptance_is_explicit_and_preserves_failed_gates():
    summary = acceptance_summary({"cap_recall": False, "label_recall": True}, True, "operator trial")
    assert summary["production_ready"] is True
    assert summary["automated_gates_passed"] is False
    assert summary["production_blockers"] == ["cap_recall"]
    assert summary["manual_acceptance_reason"] == "operator trial"
    assert summary["promotion"] == "manual_machine_specific_acceptance_candidate_only"
