from __future__ import annotations

import sys
from pathlib import Path

import yaml

MODEL2_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = MODEL2_ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from evaluate_m2_edge_finetune import non_regression_gate  # noqa: E402
from live_finetune_common import load_config  # noqa: E402


def test_edge_config_keeps_canonical_and_runtime_contract():
    cfg = load_config(MODEL2_ROOT / "config" / "m2_edge_finetune.yaml", "test_edge_contract")
    assert cfg["canonical_names"] == ["cap", "label", "ring"]
    assert cfg["dataset"]["raw_class_to_canonical"] == {0: 0, 1: 1, 2: 2}
    assert cfg["runtime_contract"]["vote_window"] == 7
    assert cfg["training"]["baseline_sha256"] == "B0C423306DB044A935718DCFD083211C6A605834975309428FEE2F59718DDC30"


def test_edge_source_mappings_match_modified_source_manifests():
    payload = yaml.safe_load((MODEL2_ROOT / "config" / "m2_edge_finetune.yaml").read_text(encoding="utf-8"))
    sources = {item["name"]: item for item in payload["edge_sources"]}
    assert sources["GG1"]["raw_class_to_canonical"] == {0: 0, 1: 1, 2: 2}
    assert sources["GG2"]["raw_class_to_canonical"] == {0: 1, 1: 0, 2: 2}


def test_edge_training_disables_geometry_breaking_augmentations():
    payload = yaml.safe_load((MODEL2_ROOT / "config" / "m2_edge_finetune.yaml").read_text(encoding="utf-8"))
    assert payload["augmentation"]["fliplr"] == 0.0
    assert payload["augmentation"]["flipud"] == 0.0
    assert payload["augmentation"]["mosaic"] == 0.0
    assert payload["augmentation"]["mixup"] == 0.0


def test_non_regression_gate_rejects_locked_class_drop():
    baseline = {"classes": {"cap": {"mAP50": 0.80}, "label": {"mAP50": 0.80}, "ring": {"mAP50": 0.60}}}
    candidate = {"classes": {"cap": {"mAP50": 0.79}, "label": {"mAP50": 0.75}, "ring": {"mAP50": 0.60}}}
    passed, deltas = non_regression_gate(baseline, candidate, ["cap", "label", "ring"], 0.02, "mAP50")
    assert not passed
    assert deltas["label"] == -0.05


def test_non_regression_gate_accepts_small_differences():
    baseline = {"classes": {"cap": {"recall": 0.80}, "label": {"recall": 0.90}, "ring": {"recall": 0.60}}}
    candidate = {"classes": {"cap": {"recall": 0.79}, "label": {"recall": 0.90}, "ring": {"recall": 0.61}}}
    passed, deltas = non_regression_gate(baseline, candidate, ["cap", "label", "ring"], 0.02, "recall")
    assert passed
    assert deltas["ring"] == 0.01
