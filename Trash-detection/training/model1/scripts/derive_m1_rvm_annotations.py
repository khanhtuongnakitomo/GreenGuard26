"""Build a provenance-preserving two-class HBB manifest from existing sources.

The live RVM labels describe parts (cap/label/ring) and cans as OBBs.  This
script does not edit those labels.  It derives conservative whole-object HBB
boxes, records exactly how each box was obtained, and supplements uncertain
single-part frames with high-confidence predictions from the existing
two-class OBB checkpoint.  The resulting manifest is a candidate training
input, not ground-truth evidence; evaluation remains fail-closed.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import yaml

from m1_rvm_common import (
    atomic_json_dump,
    image_files,
    inspect_label_file,
    label_for_image,
    load_config,
    model_root,
    relative_to_model,
    run_id,
    seed_everything,
    sha256_file,
)


def _obb_to_hbb(values: list[float]) -> list[float]:
    if len(values) != 8:
        raise ValueError("OBB row must contain eight normalized coordinates")
    xs = values[0::2]
    ys = values[1::2]
    x1, x2 = max(0.0, min(xs)), min(1.0, max(xs))
    y1, y2 = max(0.0, min(ys)), min(1.0, max(ys))
    width, height = x2 - x1, y2 - y1
    if width <= 0 or height <= 0:
        raise ValueError("OBB row has no positive HBB extent")
    return [(x1 + x2) / 2, (y1 + y2) / 2, width, height]


def _union_hbb(boxes: list[list[float]]) -> list[float]:
    x1 = min(box[0] - box[2] / 2 for box in boxes)
    y1 = min(box[1] - box[3] / 2 for box in boxes)
    x2 = max(box[0] + box[2] / 2 for box in boxes)
    y2 = max(box[1] + box[3] / 2 for box in boxes)
    return [(x1 + x2) / 2, (y1 + y2) / 2, x2 - x1, y2 - y1]


def _lighting(image_path: Path) -> str:
    image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        return "unknown"
    mean = float(image.mean())
    p95 = float(np.percentile(image, 95))
    if p95 >= 245 or mean >= 155:
        return "bright_shiny"
    if mean <= 90:
        return "dim_reflective"
    return "mixed_reflective"


def _sequence_id(group: str, image_path: Path) -> str:
    return f"{group}:{image_path.stem}"


def _model_predictions(images: list[Path], checkpoint: Path, confidence: float) -> dict[str, list[dict[str, Any]]]:
    try:
        from ultralytics import YOLO
    except Exception as exc:  # pragma: no cover - environment diagnostic
        raise RuntimeError("Ultralytics is required for conservative fallback labeling") from exc
    model = YOLO(str(checkpoint))
    predictions: dict[str, list[dict[str, Any]]] = {}
    for image_path, result in zip(images, model.predict([str(path) for path in images], imgsz=640, conf=confidence, device="cpu", verbose=False, stream=True)):
        rows: list[dict[str, Any]] = []
        if result.obb is not None:
            polys = result.obb.xyxyxyxy.cpu().numpy()
            classes = result.obb.cls.cpu().numpy().astype(int)
            confidences = result.obb.conf.cpu().numpy()
            for polygon, class_id, conf in zip(polys, classes, confidences):
                values = polygon.reshape(-1).astype(float).tolist()
                x1, y1 = polygon[:, 0].min(), polygon[:, 1].min()
                x2, y2 = polygon[:, 0].max(), polygon[:, 1].max()
                width, height = result.orig_shape[1], result.orig_shape[0]
                rows.append({
                    "class_id": 1 if int(class_id) == 0 else 0,
                    "bbox": [(float(x1 + x2) / 2) / width, (float(y1 + y2) / 2) / height, float(x2 - x1) / width, float(y2 - y1) / height],
                    "confidence": float(conf),
                    "raw_class": int(class_id),
                    "raw_polygon": values,
                })
        predictions[str(image_path.resolve())] = rows
    return predictions


def _legacy_source_map(root: Path) -> dict[str, str]:
    mapping: dict[str, str] = {}
    path = root / "dataset" / "sources.csv"
    if not path.exists():
        return mapping
    with path.open("r", newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            image = row.get("image") or row.get("filename")
            source = row.get("source") or "legacy"
            if image:
                mapping[Path(image).name] = source
    return mapping


def _legacy_records(root: Path, maximum_images: int, seed: int) -> list[dict[str, Any]]:
    images_root = root / "dataset" / "normalized" / "images"
    labels_root = root / "dataset" / "normalized" / "labels"
    source_map = _legacy_source_map(root)
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for image_path in image_files(images_root):
        label_path = labels_root / f"{image_path.stem}.txt"
        if not label_path.exists():
            continue
        rows = inspect_label_file(label_path)["records"]
        objects: list[dict[str, Any]] = []
        for row in rows:
            # The normalized legacy tree still carries its historical four
            # class IDs: 0=bottle, 1=cap, 2=wrapper, 3=aluminum. Only the
            # whole-object IDs are admitted into the two-class candidate.
            if row["field_count"] != 9 or row["class_id"] not in (0, 3):
                continue
            objects.append({"class_id": 1 if row["class_id"] == 0 else 0, "bbox": _obb_to_hbb(row["values"])})
        if not objects:
            continue
        source = source_map.get(image_path.name, "legacy")
        group = f"legacy_{source}"
        grouped[group].append({
            "image": relative_to_model(image_path),
            "objects": objects,
            "source_group": group,
            "lighting": "legacy_replay",
            "sequence_id": f"legacy:{image_path.stem}",
            "dataset_kind": "legacy",
            "derivation_method": "legacy_obb_to_hbb",
            "source_label": relative_to_model(label_path),
            "source_label_sha256": sha256_file(label_path),
        })
    rng = seed_everything(seed)
    selected: list[dict[str, Any]] = []
    groups = sorted(grouped)
    for group in groups:
        items = grouped[group]
        rng.shuffle(items)
        selected.extend(items)
    rng.shuffle(selected)
    selected = selected[:maximum_images]
    records: list[dict[str, Any]] = []
    for item in selected:
        for obj in item.pop("objects"):
            records.append({**item, **obj})
    return records


def derive(config: dict[str, Any], run_name: str) -> dict[str, Any]:
    root = model_root()
    live_root = root / config["source"]["live_root"]
    output_manifest = root / config["source"]["auto_derived_manifest"]
    report_root = root / "logs" / "rvm" / run_name
    report_root.mkdir(parents=True, exist_ok=True)
    images = image_files(live_root)
    live_sessions: dict[str, str] = {}
    by_group: defaultdict[str, list[Path]] = defaultdict(list)
    for image_path in images:
        try:
            relative = image_path.resolve().relative_to(live_root.resolve())
            group = relative.parts[0]
        except (ValueError, IndexError):
            group = image_path.parent.name
        by_group[group].append(image_path)
    for group, group_images in by_group.items():
        for index, image_path in enumerate(sorted(group_images)):
            live_sessions[str(image_path.resolve())] = f"live_{group}_s{index // 20}"
    checkpoint = root / "runs" / "seed42_n640" / "weights" / "best.pt"
    predictions = _model_predictions(images, checkpoint, confidence=0.35) if checkpoint.exists() else {}
    records: list[dict[str, Any]] = []
    methods: defaultdict[str, int] = defaultdict(int)
    skipped = 0
    for image_path in images:
        try:
            relative = image_path.resolve().relative_to(live_root.resolve())
            group = relative.parts[0]
        except (ValueError, IndexError):
            group = image_path.parent.name
        data_yaml = live_root / group / "data.yaml"
        names = {int(key): str(value).lower() for key, value in (yaml.safe_load(data_yaml.read_text(encoding="utf-8")).get("names", {}) if data_yaml.exists() else {}).items()}
        label_path = label_for_image(image_path)
        source_records = inspect_label_file(label_path)["records"] if label_path.exists() else []
        by_name: defaultdict[str, list[list[float]]] = defaultdict(list)
        for row in source_records:
            if row["field_count"] == 9 and row["class_id"] in names:
                try:
                    by_name[names[row["class_id"]]].append(_obb_to_hbb(row["values"]))
                except ValueError:
                    continue
        objects: list[tuple[int, list[float], str, float | None]] = []
        for box in by_name.get("can", []):
            objects.append((0, box, "live_can_obb_to_hbb", None))
        parts = by_name.get("cap", []) + by_name.get("label", []) + by_name.get("ring", [])
        if len(parts) >= 2 or by_name.get("label"):
            objects.append((1, _union_hbb(parts), "live_parts_union_to_hbb", None))
        if not objects:
            fallback = [row for row in predictions.get(str(image_path.resolve()), []) if row["class_id"] == 1 and row["confidence"] >= 0.35]
            if fallback:
                best = max(fallback, key=lambda row: row["confidence"])
                objects.append((1, best["bbox"], "legacy_model_pseudo_hbb", best["confidence"]))
        if not objects:
            skipped += 1
            continue
        for class_id, bbox, method, confidence in objects:
            records.append({
                "image": relative_to_model(image_path),
                "class_id": class_id,
                "bbox": bbox,
                "source_group": live_sessions.get(str(image_path.resolve()), f"live_{group}"),
                "lighting": _lighting(image_path),
                "sequence_id": _sequence_id(group, image_path),
                "dataset_kind": "machine",
                "derivation_method": method,
                "source_label": relative_to_model(label_path) if label_path.exists() else None,
                "source_label_sha256": sha256_file(label_path) if label_path.exists() else None,
                "confidence": confidence,
            })
            methods[method] += 1

    records.extend(_legacy_records(root, int(config["data"].get("max_legacy_images", 600)), int(config["run"]["seed"])))
    output_manifest.parent.mkdir(parents=True, exist_ok=True)
    output_manifest.write_text("".join(json.dumps(record, sort_keys=True) + "\n" for record in records), encoding="utf-8")
    report = {
        "schema": "m1-rvm-derived-v2",
        "run_id": run_name,
        "status": "READY" if records else "NEEDS_DATA",
        "target_classes": {"0": "metal_can", "1": "pet_bottle"},
        "live_images": len(images),
        "live_records": sum(1 for record in records if record["dataset_kind"] == "machine"),
        "legacy_records": sum(1 for record in records if record["dataset_kind"] == "legacy"),
        "live_images_without_conservative_box": skipped,
        "methods": dict(methods),
        "manifest": str(output_manifest),
        "source_is_immutable": True,
        "quality_warning": "Live boxes are derived from OBB parts or a prior detector and require holdout/manual review before promotion.",
    }
    atomic_json_dump(report_root / "derived_report.json", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path)
    parser.add_argument("--run-id")
    args = parser.parse_args()
    config = load_config(args.config)
    report = derive(config, args.run_id or run_id(config))
    print(f"DERIVE_STATUS={report['status']}")
    print(f"DERIVE_MACHINE_RECORDS={report['live_records']}")
    print(f"DERIVE_LEGACY_RECORDS={report['legacy_records']}")
    return 0 if report["status"] == "READY" else 3


if __name__ == "__main__":
    raise SystemExit(main())
