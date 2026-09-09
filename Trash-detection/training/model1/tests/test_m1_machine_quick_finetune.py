"""CPU-only contract tests for the bounded machine fine-tune runner."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
import pytest


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

import m1_machine_quick_finetune as quick  # noqa: E402


def config():
    return quick.load_config(Path(__file__).resolve().parents[1] / "config" / "m1_machine_quick_finetune.yaml")


def test_config_is_two_class_and_uses_explicit_r4_checkpoint():
    cfg = config()
    assert cfg["classes"]["names"] in ({0: "metal_can", 1: "pet_bottle"}, {"0": "metal_can", "1": "pet_bottle"})
    assert cfg["new_data"]["raw_to_canonical"] == {0: 1, 1: 0}
    assert cfg["sources"]["source_checkpoint_sha256"] == "af2b6d2b11565f42d0c5c33cde8a0ef8236a1f8f46896df5aa251f0aa80597e7"
    assert cfg["training"]["resume"] is False


@pytest.mark.parametrize(
    ("filename", "parent", "group", "split", "role"),
    [
        ("WIN_20260909_13_58_50_Pro.jpg", "Images", "new-data:can_1358_1359", "train", "new_can"),
        ("WIN_20260909_14_00_17_Pro.jpg", "Images", "new-data:pet_clear_1400_1401", "train", "new_pet"),
        ("WIN_20260909_14_02_30_Pro.jpg", "Images", "new-data:pet_green_1401_1402", "train", "new_pet"),
        ("WIN_20260909_14_02_45_Pro.jpg", "Images", "new-data:pet_white_1402_1403", "holdout", "new_pet_holdout"),
        ("WIN_20260909_14_03_26_Pro.jpg", "true-negative", "new-data:negative_1403", "train", "negative"),
    ],
)
def test_new_capture_groups_are_atomic(filename, parent, group, split, role):
    info = quick.new_data_group(Path(parent) / filename)
    assert info == {"group": group, "split": split, "role": role}


def test_raw_new_data_mapping_and_obb_conversion():
    cfg = config()
    assert quick.canonical_new_class(0, cfg) == 1
    assert quick.canonical_new_class(1, cfg) == 0
    with pytest.raises(ValueError):
        quick.canonical_new_class(7, cfg)
    labels, errors = quick.parse_yolo_label(None)
    assert labels == [] and errors == ["missing_label"]


def test_parser_accepts_hbb_and_obb_and_rejects_invalid(tmp_path):
    path = tmp_path / "labels.txt"
    path.write_text("0 0.5 0.5 0.2 0.4\n1 0.4 0.3 0.6 0.3 0.6 0.7 0.4 0.7\n2 0.5 0.5 1.5 0.2\n", encoding="utf-8")
    records, errors = quick.parse_yolo_label(path)
    assert len(records) == 2
    assert records[1]["bbox"] == pytest.approx([0.5, 0.5, 0.2, 0.4])
    assert errors == ["line_3_out_of_bounds_or_non_positive"]


def test_audit_distinguishes_empty_negative_from_missing_label(tmp_path, monkeypatch):
    monkeypatch.setattr(quick, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(quick, "MODEL_ROOT", tmp_path)
    root = tmp_path / "New-data"
    (root / "Images").mkdir(parents=True)
    (root / "labels" / "train").mkdir(parents=True)
    (root / "true-negative").mkdir()
    image = np.full((20, 30, 3), 100, dtype=np.uint8)
    can = root / "Images" / "WIN_20260909_13_58_50_Pro.jpg"
    pet = root / "Images" / "WIN_20260909_14_00_17_Pro.jpg"
    negative = root / "true-negative" / "WIN_20260909_14_03_26_Pro.jpg"
    missing = root / "Images" / "WIN_20260909_13_59_02_Pro.jpg"
    for path in (can, pet, negative, missing):
        assert cv2.imwrite(str(path), image)
    (root / "labels" / "train" / f"{can.stem}.txt").write_text("1 0.5 0.5 0.2 0.4\n", encoding="utf-8")
    (root / "labels" / "train" / f"{pet.stem}.txt").write_text("0 0.5 0.5 0.2 0.4\n", encoding="utf-8")
    cfg = config()
    cfg["_config_path"] = str(tmp_path / "config.yaml")
    Path(cfg["_config_path"]).write_text("test", encoding="utf-8")
    cfg["sources"]["new_data_root"] = str(root)
    cfg["sources"]["previous_manifest"] = str(tmp_path / "old.json")
    (tmp_path / "old.json").write_text(json.dumps({"records": []}), encoding="utf-8")
    result = quick.audit_new_data(cfg, "unit_audit")
    rows = {Path(row["source"]).name: row for row in result["records"]}
    assert rows[negative.name]["disposition"] == "eligible"
    assert rows[can.name]["labels"][0]["class_id"] == 0
    assert rows[pet.name]["labels"][0]["class_id"] == 1
    assert rows[missing.name]["disposition"] == "quarantine"


def _sampler_config():
    cfg = config()
    cfg["replay"]["quotas"] = {"new_can": 4, "new_pet": 4, "old_machine_can": 4, "old_machine_pet": 4, "generic_can": 4, "generic_pet": 4, "negative": 2}
    return cfg


def test_sampler_is_deterministic_balanced_and_respects_caps(tmp_path):
    cfg = _sampler_config()
    records = []
    role_specs = {
        "new_can": (4, "can-new", 2),
        "new_pet": (4, "pet-new", 2),
        "old_machine_can": (4, "can-old", 2),
        "old_machine_pet": (4, "pet-old", 2),
        "generic_can": (4, "can-generic", 4),
        "generic_pet": (4, "pet-generic", 4),
        "negative": (2, "negative", 1),
    }
    for role, (count, prefix, groups) in role_specs.items():
        for index in range(count):
            records.append({"source": f"{prefix}-{index}.jpg", "group": f"{prefix}-{index % groups}", "role": role, "labels": [] if role == "negative" else [{"class_id": 0 if "can" in role else 1}], "class_ids": [] if role == "negative" else [0 if "can" in role else 1]})
    trace = tmp_path / "draws.jsonl"
    first_sampler = quick.MachineReplaySampler(records, cfg, trace_path=trace)
    first = list(first_sampler)
    second = list(quick.MachineReplaySampler(records, cfg))
    assert first == second
    assert len(first) == sum(cfg["replay"]["quotas"].values())
    assert {records[index]["role"] for index in first} == set(role_specs)
    assert trace.read_text(encoding="utf-8").count("\n") == 1
    epoch_one = quick.MachineReplaySampler(records, cfg).draw_epoch(1)
    assert epoch_one != first


def test_sampler_preserves_exact_768_quota_shape():
    cfg = config()
    assert sum(int(value) for value in cfg["replay"]["quotas"].values()) == 768
    assert cfg["replay"]["quotas"]["new_can"] == 64
    assert cfg["replay"]["quotas"]["negative"] == 32


def test_real_new_pet_group_sizes_can_supply_full_quota():
    cfg = config()
    records = []
    for index in range(13):
        records.append({"source": f"clear-{index}.jpg", "group": "clear", "role": "new_pet", "labels": [{"class_id": 1}], "class_ids": [1]})
    for index in range(8):
        records.append({"source": f"green-{index}.jpg", "group": "green", "role": "new_pet", "labels": [{"class_id": 1}], "class_ids": [1]})
    cfg["replay"]["quotas"] = {role: (96 if role == "new_pet" else 0) for role in quick.ROLE_QUOTAS}
    draws = quick.MachineReplaySampler(records, cfg).draw_epoch(0)
    assert len(draws) == 96
    assert max(draws.count(index) for index in range(len(records))) <= 6


def test_no_split_leakage_detects_group_and_hash_collisions():
    rows = [{"group": "same-session", "partition": "train", "source_sha256": "abc"}, {"group": "same-session", "partition": "holdout", "source_sha256": "def"}, {"group": "other", "partition": "selection", "source_sha256": "abc"}]
    violations = quick.validate_no_split_leakage(rows)
    assert "group:same-session" in violations
    assert "hash:abc" in violations


def test_train_arguments_are_fresh_weights_and_resume_false():
    cfg = config()
    args_a = quick.train_args(cfg, weights=Path("best.pt"), data=Path("dataset.yaml"), project=Path("runs"), run_name_value="a", phase="freeze-head", batch=16, epochs=4, patience=4)
    args_b = quick.train_args(cfg, weights=Path("phase-a.pt"), data=Path("dataset.yaml"), project=Path("runs"), run_name_value="b", phase="full-finetune", batch=8, epochs=16, patience=5)
    assert args_a["resume"] is False and args_b["resume"] is False
    assert args_a["pretrained"] is True and args_b["pretrained"] is True
    assert args_a["freeze"] == 10
    assert "freeze" not in args_b
    assert args_a["batch"] == 16 and args_b["batch"] == 8


def test_deadline_is_hard_and_testable():
    now = [100.0]
    deadline = quick.WallClockDeadline(1.0, started=100.0, clock=lambda: now[0])
    assert deadline.remaining_seconds() == pytest.approx(60.0)
    deadline.require("smoke")
    now[0] = 160.0
    assert deadline.expired()
    with pytest.raises(quick.DeadlineExceeded):
        deadline.require("export")


def test_reserved_training_deadline_preserves_verification_tail():
    now = [100.0]
    deadline = quick.WallClockDeadline(90.0, started=100.0, clock=lambda: now[0])
    training = deadline.with_reserved_tail(32 * 60)
    assert training.remaining_seconds() == pytest.approx(58 * 60)
    now[0] += 58 * 60
    assert training.expired()
    assert not deadline.expired()
    assert deadline.remaining_seconds() == pytest.approx(32 * 60)


def test_smoke_subset_is_wrapped_in_ultralytics_dataset_yaml(tmp_path, monkeypatch):
    monkeypatch.setattr(quick, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(quick, "MODEL_ROOT", tmp_path)
    cfg = config()
    cfg["run"]["generated_root"] = "generated"
    cfg["run"]["report_root"] = "reports"
    cfg["training"]["smoke_images"] = 2
    run_id = "smoke-unit"
    generated = quick.generated_root(cfg, run_id)
    (generated / "images" / "selection").mkdir(parents=True)
    rows = [
        {"partition": "train", "generated_image": "can.jpg", "labels": [{"class_id": 0}], "class_ids": [0]},
        {"partition": "train", "generated_image": "pet.jpg", "labels": [{"class_id": 1}], "class_ids": [1]},
    ]
    (generated / "manifest.json").write_text(json.dumps({"records": rows}), encoding="utf-8")
    path = quick._smoke_data(cfg, run_id)
    contents = quick.yaml.safe_load(path.read_text(encoding="utf-8"))
    assert path.name == "smoke_dataset.yaml"
    assert Path(contents["train"]).name == "smoke_train.txt"
    assert contents["names"] == {0: "metal_can", 1: "pet_bottle"}


def test_export_metadata_contract_and_activation_is_not_implicit():
    cfg = config()
    assert cfg["export"]["expected_output"] == [1, 6, 8400]
    assert cfg["export"]["nms"] is False
    assert cfg["publication"]["always_replace"] is True
    assert cfg["publication"]["git_handled_by_caller"] is True
    assert "--activate" not in quick.train_args(cfg, weights=Path("x"), data=Path("y"), project=Path("z"), run_name_value="r", phase="full-finetune", batch=4, epochs=1, patience=1)
