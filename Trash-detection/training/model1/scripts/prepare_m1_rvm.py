"""Prepare a grouped, immutable-source Model 1 RVM dataset.

Preparation requires a reviewer-created JSONL manifest. This prevents the
existing Model 2 OBB part labels from being accidentally promoted to Model 1
whole-object labels.
"""

from __future__ import annotations

import argparse
import json
import shutil
from collections import defaultdict
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from m1_rvm_common import (
    CLASS_NAMES,
    atomic_json_dump,
    atomic_text_dump,
    image_size,
    load_config,
    model_root,
    run_id,
    seed_everything,
    validate_hbb_record,
)


def _read_review_manifest(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid JSONL at line {line_number}: {exc}") from exc
        required = {"image", "class_id", "bbox", "source_group", "lighting", "sequence_id"}
        missing = required - record.keys()
        if missing:
            raise ValueError(f"line {line_number} missing fields: {sorted(missing)}")
        bbox = record["bbox"]
        if not isinstance(bbox, list) or len(bbox) != 4:
            raise ValueError(f"line {line_number} bbox must be [cx, cy, w, h]")
        normalized = {"class_id": record["class_id"], "values": bbox, "field_count": 5}
        error = validate_hbb_record(normalized)
        if error:
            raise ValueError(f"line {line_number}: {error}")
        records.append(record)
    return records


def _split_groups(records: list[dict[str, Any]], seed: int, fractions: tuple[float, float, float]) -> dict[str, str]:
    groups = sorted({str(record["source_group"]) for record in records})
    if len(groups) < 3:
        raise ValueError("at least three independent source groups are required for grouped train/val/test")
    rng = seed_everything(seed)
    rng.shuffle(groups)
    train_fraction, val_fraction, _ = fractions
    train_count = max(1, int(round(len(groups) * train_fraction)))
    val_count = max(1, int(round(len(groups) * val_fraction)))
    if train_count + val_count >= len(groups):
        val_count = 1
        train_count = len(groups) - 2
    result = {}
    for group in groups[:train_count]:
        result[group] = "train"
    for group in groups[train_count:train_count + val_count]:
        result[group] = "val"
    for group in groups[train_count + val_count:]:
        result[group] = "test"
    return result


def _adjust_image(image: np.ndarray, variant: int, seed: int) -> np.ndarray:
    """Deterministic photometric augmentation; geometry and labels remain exact."""
    rng = np.random.default_rng(seed + variant * 7919)
    result = image.astype(np.float32)
    mode = variant % 6
    if mode == 0:
        result = result * 0.80
    elif mode == 1:
        result = np.clip((result - 128.0) * 1.20 + 128.0, 0, 255)
    elif mode == 2:
        result = np.power(np.clip(result / 255.0, 0, 1), 0.75) * 255.0
    elif mode == 3:
        result = np.power(np.clip(result / 255.0, 0, 1), 1.25) * 255.0
    elif mode == 4:
        glare = np.zeros(result.shape[:2], dtype=np.float32)
        height, width = glare.shape
        center_x = int(rng.integers(max(1, width // 4), max(2, 3 * width // 4)))
        center_y = int(rng.integers(max(1, height // 4), max(2, 3 * height // 4)))
        radius = max(8, min(height, width) // 4)
        cv2.circle(glare, (center_x, center_y), radius, 55.0, -1)
        glare = cv2.GaussianBlur(glare, (0, 0), radius / 2)
        result = result + glare[:, :, None]
    else:
        shadow = np.zeros(result.shape[:2], dtype=np.float32)
        height, width = shadow.shape
        cv2.rectangle(shadow, (0, 0), (width, max(1, height // 2)), 45.0, -1)
        shadow = cv2.GaussianBlur(shadow, (0, 0), max(3, min(height, width) // 8))
        result = result - shadow[:, :, None]
    if variant == 5:
        result = cv2.GaussianBlur(result, (3, 3), 0)
    if variant == 6:
        result += rng.normal(0, 3.0, result.shape)
    return np.clip(result, 0, 255).astype(np.uint8)


def _write_sample(out_root: Path, split: str, stem: str, image_path: Path, labels: list[dict], variant: int, seed: int) -> None:
    image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"unable to decode {image_path}")
    if variant:
        image = _adjust_image(image, variant, seed)
    image_out = out_root / "images" / split / f"{stem}.jpg"
    label_out = out_root / "labels" / split / f"{stem}.txt"
    image_out.parent.mkdir(parents=True, exist_ok=True)
    label_out.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(image_out), image, [int(cv2.IMWRITE_JPEG_QUALITY), 95]):
        raise OSError(f"failed to write {image_out}")
    lines = [f"{record['class_id']} " + " ".join(f"{float(value):.8f}" for value in record["bbox"]) for record in labels]
    atomic_text_dump(label_out, "\n".join(lines) + "\n")


def prepare(config: dict, run_name: str) -> dict[str, Any]:
    root = model_root()
    manifest_path = root / config["source"]["reviewed_annotations"]
    output_root = root / config["data"]["generated_root"] / run_name
    report_root = root / "logs" / "rvm" / run_name
    report_root.mkdir(parents=True, exist_ok=True)
    report: dict[str, Any] = {"schema": "m1-rvm-prepare-v1", "run_id": run_name, "status": "NEEDS_DATA"}
    records = _read_review_manifest(manifest_path)
    if not records:
        report["blocking_reasons"] = [
            f"Reviewer manifest is missing or empty: {manifest_path}",
            "Do not infer whole-object boxes from Model 2 cap/label/ring/can OBB labels.",
        ]
        atomic_json_dump(report_root / "prepare_report.json", report)
        return report

    class_groups = defaultdict(set)
    for record in records:
        class_groups[int(record["class_id"])].add(str(record["source_group"]))
    min_groups = int(config["data"]["minimum_independent_groups_per_class"])
    underrepresented = {CLASS_NAMES[class_id]: len(groups) for class_id, groups in class_groups.items() if len(groups) < min_groups}
    if underrepresented:
        report["blocking_reasons"] = [f"independent group minimum not met: {underrepresented}"]
        atomic_json_dump(report_root / "prepare_report.json", report)
        return report

    try:
        group_split = _split_groups(records, int(config["run"]["seed"]), (
            float(config["data"]["train_fraction"]),
            float(config["data"]["validation_fraction"]),
            float(config["data"]["test_fraction"]),
        ))
    except ValueError as exc:
        report["blocking_reasons"] = [str(exc)]
        atomic_json_dump(report_root / "prepare_report.json", report)
        return report

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[str(record["image"])].append(record)
    if output_root.exists():
        raise RuntimeError(f"refusing to overwrite existing generated dataset: {output_root}")
    output_root.mkdir(parents=True)
    max_variants = int(config["data"]["max_direct_variants_per_original"])
    counts = {"train": 0, "val": 0, "test": 0}
    for index, (image_rel, labels) in enumerate(sorted(grouped.items())):
        image_path = (root / image_rel).resolve()
        if not image_path.exists():
            raise FileNotFoundError(image_path)
        split = group_split[str(labels[0]["source_group"])]
        stem = f"{index:06d}_{image_path.stem}"
        _write_sample(output_root, split, stem, image_path, labels, 0, int(config["run"]["seed"]))
        counts[split] += 1
        if split == "train":
            for variant in range(1, max_variants + 1):
                _write_sample(output_root, split, f"{stem}_aug{variant:02d}", image_path, labels, variant, int(config["augmentation"]["seed"]))
                counts[split] += 1

    data_yaml = {
        "path": str(output_root.resolve()),
        "train": "images/train",
        "val": "images/val",
        "test": "images/test",
        "names": CLASS_NAMES,
    }
    atomic_text_dump(output_root / "dataset.yaml", __import__("yaml").safe_dump(data_yaml, sort_keys=False))
    report.update({
        "status": "READY",
        "reviewed_manifest": str(manifest_path),
        "group_split": group_split,
        "image_counts": counts,
        "class_counts": {CLASS_NAMES[class_id]: len(items) for class_id, items in class_groups.items()},
        "generated_root": str(output_root),
        "augmentation_policy": "photometric-only, direct variants only, no val/test augmentation",
    })
    atomic_json_dump(report_root / "prepare_report.json", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path)
    parser.add_argument("--run-id")
    args = parser.parse_args()
    config = load_config(args.config)
    name = args.run_id or run_id(config)
    report = prepare(config, name)
    print(f"PREPARE_STATUS={report['status']}")
    print(f"PREPARE_REPORT={model_root() / 'logs' / 'rvm' / name / 'prepare_report.json'}")
    return 0 if report["status"] == "READY" else 3


if __name__ == "__main__":
    raise SystemExit(main())
