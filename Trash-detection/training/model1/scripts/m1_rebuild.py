"""Auditable two-class Model 1 rebuild workflow.

The workflow is intentionally candidate-only. It audits both Model 1 and the
whole-object portions of Model 2 data, never edits incoming data, keeps Model 2
outside the training path, and never writes the active PC runtime model.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import re
import shutil
import subprocess
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

import cv2
import numpy as np
import yaml


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
CLASS_NAMES = {0: "metal_can", 1: "pet_bottle"}
REPO_ROOT = Path(__file__).resolve().parents[4]
MODEL_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_ROOT = MODEL_ROOT.parents[1] / "pc-demo"
CONFIG_PATH = MODEL_ROOT / "config" / "m1_full_rebuild.yaml"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_config(path: Path = CONFIG_PATH) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        cfg = yaml.safe_load(handle) or {}
    if cfg.get("classes", {}).get("names", {}) not in ({0: "metal_can", 1: "pet_bottle"}, {"0": "metal_can", "1": "pet_bottle"}):
        raise ValueError("the rebuild requires exactly metal_can and pet_bottle")
    return cfg


def run_id(cfg: dict[str, Any], supplied: str | None = None) -> str:
    if supplied:
        return supplied
    return f"{cfg['run']['id_prefix']}_{datetime.now().strftime('%Y%m%d')}_seed{cfg['run']['seed']}_yolo11s"


def report_dir(cfg: dict[str, Any], name: str) -> Path:
    path = MODEL_ROOT / cfg["data"]["report_root"] / name
    path.mkdir(parents=True, exist_ok=True)
    return path


def generated_dir(cfg: dict[str, Any], name: str) -> Path:
    return MODEL_ROOT / cfg["data"]["generated_root"] / name


def atomic_write(path: Path, value: str | dict[str, Any] | list[Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    if isinstance(value, str):
        temporary.write_text(value, encoding="utf-8", newline="\n")
    else:
        temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    os.replace(temporary, path)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest().lower()


def load_rejected_hashes(path: Path | None = None) -> set[str]:
    rejected_path = path or (REPO_ROOT / "Trash-detection" / "validation" / "contracts" / "rejected_models.json")
    if not rejected_path.is_file():
        return set()
    rejected = json.loads(rejected_path.read_text(encoding="utf-8"))
    return {str(value).lower() for model in rejected.get("models", []) for value in model.get("sha256", [])}


def class_metadata_valid(classes: Any, labels: Any) -> bool:
    expected = [CLASS_NAMES[index] for index in sorted(CLASS_NAMES)]
    normalized = {str(key): value for key, value in classes.items()} if isinstance(classes, dict) else classes
    expected_mapping = {str(index): name for index, name in CLASS_NAMES.items()}
    return normalized in (expected, expected_mapping) and labels == expected


def image_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS)


def find_label(image: Path) -> Path | None:
    parts = list(image.parts)
    image_index = next((i for i, part in enumerate(parts) if part.lower() == "images"), None)
    candidates: list[Path] = []
    if image_index is not None:
        replaced = parts[:]
        replaced[image_index] = "labels"
        candidates.append(Path(*replaced).with_suffix(".txt"))
        label_root = Path(*replaced[: image_index + 1])
        candidates.extend(label_root.parent.rglob(f"{image.stem}.txt") if label_root.parent.is_dir() else [])
    candidates.append(image.with_suffix(".txt"))
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def yaml_names(root: Path) -> dict[int, str]:
    files = sorted(root.rglob("*.yaml")) + sorted(root.rglob("*.yml"))
    for path in files:
        try:
            value = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        except (OSError, yaml.YAMLError):
            continue
        names = value.get("names")
        if isinstance(names, list):
            return {i: str(name) for i, name in enumerate(names)}
        if isinstance(names, dict):
            return {int(i): str(name) for i, name in names.items()}
    return {}


def parse_label(path: Path | None) -> tuple[list[dict[str, Any]], list[str]]:
    if path is None:
        return [], ["missing_label"]
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError as exc:
        return [], [f"label_read_error:{exc}"]
    records: list[dict[str, Any]] = []
    errors: list[str] = []
    for line_no, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        fields = line.split()
        try:
            class_id = int(fields[0])
            values = [float(v) for v in fields[1:]]
        except (ValueError, IndexError):
            errors.append(f"line_{line_no}_non_numeric")
            continue
        if len(fields) not in (5, 9):
            errors.append(f"line_{line_no}_unsupported_field_count_{len(fields)}")
            continue
        if any(not math.isfinite(v) for v in values):
            errors.append(f"line_{line_no}_non_finite")
            continue
        records.append({"class_id": class_id, "values": values, "field_count": len(fields)})
    return records, errors


def normalized_hbb(record: dict[str, Any]) -> tuple[float, float, float, float] | None:
    values = record["values"]
    if record["field_count"] == 5:
        cx, cy, width, height = values
    else:
        xs = values[0::2]
        ys = values[1::2]
        cx = (min(xs) + max(xs)) / 2.0
        cy = (min(ys) + max(ys)) / 2.0
        width = max(xs) - min(xs)
        height = max(ys) - min(ys)
    if not all(0.0 <= value <= 1.0 for value in (cx, cy, width, height)):
        return None
    if width <= 0.0 or height <= 0.0 or cx - width / 2 < 0 or cx + width / 2 > 1 or cy - height / 2 < 0 or cy + height / 2 > 1:
        return None
    return cx, cy, width, height


def decoded_hash(value: Path | np.ndarray) -> str | None:
    image = cv2.imread(str(value), cv2.IMREAD_COLOR) if isinstance(value, Path) else value
    if image is None:
        return None
    ok, encoded = cv2.imencode(".png", image)
    if not ok:
        return None
    return hashlib.sha256(encoded.tobytes()).hexdigest().lower()


def perceptual_hash(value: Path | np.ndarray) -> str | None:
    """Return a compact DCT hash used only to propose near-duplicate groups."""
    image = cv2.imread(str(value), cv2.IMREAD_GRAYSCALE) if isinstance(value, Path) else cv2.cvtColor(value, cv2.COLOR_BGR2GRAY)
    if image is None:
        return None
    resized = cv2.resize(image, (32, 32), interpolation=cv2.INTER_AREA).astype(np.float32)
    low_frequency = cv2.dct(resized)[:8, :8]
    values = low_frequency.flatten()
    median = float(np.median(values[1:]))
    bits = "".join("1" if value > median else "0" for value in values)
    return f"{int(bits, 2):016x}"


def hamming_distance(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def label_digest(labels: list[dict[str, Any]]) -> str:
    payload = json.dumps(labels, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest().lower()


def group_key(source: str, image: Path) -> str:
    relative = image.as_posix()
    stem = image.stem
    if ".rf." in stem:
        stem = stem.split(".rf.", 1)[0]
    while stem.endswith(tuple(f"_aug{i:02d}" for i in range(1, 100))):
        stem = stem.rsplit("_aug", 1)[0]
    if source == "dataset-live":
        # These frames are one short machine capture sequence. Keeping the
        # sequence atomic prevents near-identical neighboring frames from
        # leaking across train/validation/holdout.
        return "dataset-live:machine-capture-sequence"
    if source == "true-negative":
        # The reviewed empty scenes contain two timestamped capture sessions;
        # keep each session together while allowing an independent negative
        # session to remain available for evaluation.
        match = re.match(r"WIN_(\d{8}_\d{2}_\d{2})_", stem, re.IGNORECASE)
        session = match.group(1) if match else "reviewed-empty-scene"
        return f"true-negative:{session}"
    if "live-machine" in relative:
        return "live-machine:machine-capture-sequence"
    return f"{source}:{stem}"


def source_mapping(model: str, source: str, names: dict[int, str]) -> tuple[dict[int, int], set[int], str]:
    """Return target mapping, excluded source IDs, and mapping explanation."""
    if model == "model2":
        return ({0: 1} if source in {"bottle-defect-detection", "bottle-label-detection", "bottle-label-inspection"} else {}), set(names) - {0}, "whole-bottle class 0 only"
    if source == "dataset-3":
        return {0: 1}, set(names) - {0}, "whole bottle class 0; parts excluded"
    if source == "dataset-1":
        return {3: 0, 4: 0}, set(names) - {3, 4}, "documented aluminum-cans classes can/cans; visual samples verified; numeric 0-2 excluded"
    if source == "dataset-4":
        return {0: 1, 1: 0}, set(names) - {0, 1}, "bottle/can source mapping"
    if source == "dataset-5":
        return {0: 1, 1: 1, 2: 1, 3: 1, 4: 1}, set(names) - {0, 1, 2, 3, 4}, "whole-bottle state classes; component-only classes excluded"
    if source == "dataset-6":
        return {0: 1}, set(names) - {0}, "PET admitted; metal requires beverage-can review"
    if source == "dataset-live":
        return {3: 0}, set(names) - {3}, "verified complete can OBB class"
    if source == "true-negative":
        return {}, set(names), "explicit reviewed empty-machine source"
    return {}, set(names), "source mapping requires review"


def source_roots(cfg: dict[str, Any]) -> list[tuple[str, str, Path]]:
    roots: list[tuple[str, str, Path]] = []
    for source in cfg["sources"]["include_model1"]:
        roots.append(("model1", source, MODEL_ROOT / cfg["sources"]["model1_root"] / source))
    for source in cfg["sources"]["include_model2"]:
        roots.append(("model2", source, MODEL_ROOT / cfg["sources"]["model2_root"] / source))
    roots.append(("model1", "live-machine-dataset", MODEL_ROOT / cfg["sources"]["model1_root"] / "live-machine-dataset"))
    return roots


def make_record(model: str, source: str, image: Path, root: Path, cfg: dict[str, Any]) -> dict[str, Any]:
    label = find_label(image)
    names = cfg.get("_source_names", {}).get(str(root))
    if names is None:
        names = yaml_names(root)
    if source == "true-negative":
        names = {}
    records, errors = parse_label(label)
    mapping, excluded_ids, explanation = source_mapping(model, source, names)
    labels: list[dict[str, Any]] = []
    invalid_box = False
    for record in records:
        if record["class_id"] in mapping:
            box = normalized_hbb(record)
            if box is None:
                invalid_box = True
            else:
                labels.append({"class_id": mapping[record["class_id"]], "bbox": list(box), "source_class_id": record["class_id"]})
    if source == "true-negative" and label is None:
        disposition = "approved_negative"
    elif source == "true-negative" and not records and not errors:
        disposition = "approved_negative"
    elif "live-machine" in str(image).lower():
        disposition = "exclude_part_only_machine_label"
    elif invalid_box or errors:
        disposition = "quarantine_invalid_label"
    elif labels:
        disposition = "eligible"
    elif label is None:
        disposition = "quarantine_missing_label"
    elif not records:
        disposition = "quarantine_empty_unreviewed"
    else:
        disposition = "exclude_non_target_or_ambiguous"
    width = height = None
    image_hash = None
    pixel_hash = None
    image_perceptual_hash = None
    try:
        image_data = cv2.imread(str(image), cv2.IMREAD_COLOR)
        if image_data is None:
            disposition = "quarantine_unreadable_image"
        else:
            height, width = image_data.shape[:2]
            image_hash = sha256_file(image)
            pixel_hash = decoded_hash(image_data)
            image_perceptual_hash = perceptual_hash(image_data)
    except (OSError, ValueError):
        disposition = "quarantine_unreadable_image"
    return {
        "model": model,
        "source": source,
        "image": image.relative_to(REPO_ROOT).as_posix(),
        "label": label.relative_to(REPO_ROOT).as_posix() if label else None,
        "image_sha256": image_hash,
        "pixel_sha256": pixel_hash,
        "perceptual_hash": image_perceptual_hash if image_hash else None,
        "label_sha256": sha256_file(label) if label and label.is_file() else None,
        "converted_label_sha256": label_digest(labels),
        "width": width,
        "height": height,
        "source_names": names,
        "mapping": explanation,
        "review_basis": f"configured source adapter: {explanation}",
        "identity": {"item": None, "session": None, "trial": None, "status": "unknown"},
        "labels": labels,
        "group": group_key(source, image),
        "disposition": disposition,
        "source_class_ids_seen": sorted({r["class_id"] for r in records}),
        "parse_errors": errors,
        "excluded_source_ids": sorted(excluded_ids),
    }


def audit(cfg: dict[str, Any], name: str) -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    missing_roots: list[str] = []
    roots = source_roots(cfg)
    cfg["_source_names"] = {str(root): yaml_names(root) for _, _, root in roots if root.is_dir()}
    for model, source, root in roots:
        if not root.is_dir():
            missing_roots.append(str(root))
            continue
        for image in image_files(root):
            records.append(make_record(model, source, image, root, cfg))
    byte_groups: dict[str, list[int]] = defaultdict(list)
    pixel_groups: dict[str, list[int]] = defaultdict(list)
    for index, record in enumerate(records):
        if record["image_sha256"]:
            byte_groups[record["image_sha256"]].append(index)
        if record["pixel_sha256"]:
            pixel_groups[record["pixel_sha256"]].append(index)
    duplicate_indices: set[int] = set()
    conflicting_duplicate_indices: set[int] = set()
    seen_duplicate_groups: set[tuple[int, ...]] = set()
    for group in list(byte_groups.values()) + list(pixel_groups.values()):
        if len(group) <= 1:
            continue
        key = tuple(sorted(group))
        if key in seen_duplicate_groups:
            continue
        seen_duplicate_groups.add(key)
        signatures = {records[index]["converted_label_sha256"] for index in group if records[index]["disposition"] in {"eligible", "approved_negative"}}
        if len(signatures) > 1:
            conflicting_duplicate_indices.update(group)
            continue
        ordered = sorted(group, key=lambda index: (records[index]["disposition"] not in {"eligible", "approved_negative"}, index))
        duplicate_indices.update(ordered[1:])
    for index in conflicting_duplicate_indices:
        if records[index]["disposition"] in {"eligible", "approved_negative"}:
            records[index]["disposition"] = "quarantine_conflicting_duplicate"
    for index in duplicate_indices:
        if records[index]["disposition"] in {"eligible", "approved_negative"}:
            records[index]["disposition"] = "exclude_duplicate"

    # A perceptual match is a split-leakage proposal, not an automatic label merge.
    # Use a small prefix bucket to avoid an O(n^2) comparison across the inventory.
    near_buckets: dict[str, list[int]] = defaultdict(list)
    for index, record in enumerate(records):
        if record["perceptual_hash"]:
            near_buckets[record["perceptual_hash"][:2]].append(index)
    group_parent: dict[str, str] = {}

    def find_group(value: str) -> str:
        group_parent.setdefault(value, value)
        while group_parent[value] != value:
            group_parent[value] = group_parent[group_parent[value]]
            value = group_parent[value]
        return value

    def union_groups(left: str, right: str) -> None:
        left_root, right_root = find_group(left), find_group(right)
        if left_root != right_root:
            group_parent[right_root] = left_root

    near_proposals = 0
    comparisons = 0
    for bucket in near_buckets.values():
        # This is a proposal index, not a ground-truth merge. Bound the work
        # so a visually uniform source cannot turn audit into an O(n^2) job.
        candidates = bucket[:128]
        for offset, left_index in enumerate(candidates):
            left_hash = records[left_index]["perceptual_hash"]
            for right_index in candidates[offset + 1 : offset + 65]:
                comparisons += 1
                right_hash = records[right_index]["perceptual_hash"]
                if left_hash and right_hash and hamming_distance(left_hash, right_hash) <= 5:
                    if records[left_index]["group"] != records[right_index]["group"]:
                        union_groups(records[left_index]["group"], records[right_index]["group"])
                        near_proposals += 1
    for record in records:
        root = find_group(record["group"])
        record["duplicate_group"] = f"near:{root}" if root != record["group"] else record["group"]
        if root != record["group"]:
            record["group"] = f"near:{root}"
    counts = Counter(record["disposition"] for record in records)
    source_counts: dict[str, dict[str, int]] = {}
    for record in records:
        source_counts.setdefault(record["source"], Counter())[record["disposition"]] += 1
    eligible = [record for record in records if record["disposition"] in {"eligible", "approved_negative"}]
    class_counts = Counter(CLASS_NAMES[label["class_id"]] for record in eligible for label in record["labels"])
    report = {
        "schema": "greenguard-m1-rebuild-audit-v1",
        "run_id": name,
        "created_at": utc_now(),
        "source_roots_missing": missing_roots,
        "image_count": len(records),
        "eligible_image_count": len(eligible),
        "counts_by_disposition": dict(counts),
        "source_counts": source_counts,
        "class_instance_counts": dict(class_counts),
        "duplicate_image_count": len(duplicate_indices),
        "conflicting_duplicate_image_count": len(conflicting_duplicate_indices),
        "near_duplicate_group_proposals": near_proposals,
        "near_duplicate_comparisons": comparisons,
        "distinct_image_hashes": len({r["image_sha256"] for r in records if r["image_sha256"]}),
        "distinct_pixel_hashes": len({r["pixel_sha256"] for r in records if r["pixel_sha256"]}),
        "true_negative_distinct_images": len({r["pixel_sha256"] for r in records if r["source"] == "true-negative" and r["pixel_sha256"]}),
        "records": records,
    }
    audit_root = report_dir(cfg, name)
    atomic_write(audit_root / "audit_report.json", report)
    atomic_write(audit_root / "audit_summary.json", {
        "schema": "greenguard-m1-rebuild-audit-summary-v1",
        "run_id": name,
        "created_at": report["created_at"],
        "image_count": report["image_count"],
        "eligible_image_count": report["eligible_image_count"],
        "counts_by_disposition": report["counts_by_disposition"],
        "source_counts": report["source_counts"],
        "class_instance_counts": report["class_instance_counts"],
        "duplicates": {
            "exact_or_pixel_duplicate_images": report["duplicate_image_count"],
            "conflicting_duplicate_images": report["conflicting_duplicate_image_count"],
            "near_duplicate_group_proposals": report["near_duplicate_group_proposals"],
            "near_duplicate_comparisons": report["near_duplicate_comparisons"],
            "distinct_image_hashes": report["distinct_image_hashes"],
            "distinct_pixel_hashes": report["distinct_pixel_hashes"],
        },
        "true_negative_distinct_images": report["true_negative_distinct_images"],
        "source_roots_missing": report["source_roots_missing"],
        "note": "The full per-image audit_report.json is intentionally local-only; this summary is the compact publication artifact.",
    })
    return report


def compact_audit(cfg: dict[str, Any], name: str) -> dict[str, Any]:
    """Derive the small publication summary from a frozen full audit."""
    audit_path = report_dir(cfg, name) / "audit_report.json"
    if not audit_path.is_file():
        raise FileNotFoundError(f"frozen audit not found: {audit_path}")
    report = json.loads(audit_path.read_text(encoding="utf-8"))
    summary = {
        "schema": "greenguard-m1-rebuild-audit-summary-v1",
        "run_id": name,
        "created_at": report.get("created_at"),
        "image_count": report.get("image_count", 0),
        "eligible_image_count": report.get("eligible_image_count", 0),
        "counts_by_disposition": report.get("counts_by_disposition", {}),
        "source_counts": report.get("source_counts", {}),
        "class_instance_counts": report.get("class_instance_counts", {}),
        "duplicates": {
            "exact_or_pixel_duplicate_images": report.get("duplicate_image_count", 0),
            "conflicting_duplicate_images": report.get("conflicting_duplicate_image_count", 0),
            "near_duplicate_group_proposals": report.get("near_duplicate_group_proposals", 0),
            "near_duplicate_comparisons": report.get("near_duplicate_comparisons", 0),
            "distinct_image_hashes": report.get("distinct_image_hashes", 0),
            "distinct_pixel_hashes": report.get("distinct_pixel_hashes", 0),
        },
        "true_negative_distinct_images": report.get("true_negative_distinct_images", 0),
        "source_roots_missing": report.get("source_roots_missing", []),
        "note": "The full per-image audit_report.json is intentionally local-only; this summary is the compact publication artifact.",
    }
    atomic_write(report_dir(cfg, name) / "audit_summary.json", summary)
    return summary


def split_groups(records: list[dict[str, Any]], cfg: dict[str, Any], seed: int) -> dict[str, str]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        groups[record["group"]].append(record)
    keys = list(groups)
    random.Random(seed).shuffle(keys)
    fractions = {"train": float(cfg["data"]["train_fraction"]), "val": float(cfg["data"]["validation_fraction"]), "holdout": float(cfg["data"]["holdout_fraction"])}
    target_records = {split: len(records) * fraction for split, fraction in fractions.items()}
    total_instances = Counter(int(label["class_id"]) for record in records for label in record["labels"])
    target_instances = {split: {class_id: total_instances[class_id] * fraction for class_id in (0, 1)} for split, fraction in fractions.items()}
    assigned: dict[str, str] = {}
    sizes = Counter()
    instances: dict[str, Counter] = defaultdict(Counter)
    class_by_split: dict[str, set[int]] = defaultdict(set)
    group_instances: dict[str, Counter] = {
        key: Counter(int(label["class_id"]) for record in groups[key] for label in record["labels"]) for key in keys
    }

    def assignment_score(key: str, split: str) -> float:
        """Higher score means the partition has the greatest remaining deficit."""
        record_count = sizes[split] + len(groups[key])
        score = (target_records[split] - sizes[split]) / max(target_records[split], 1.0)
        if record_count > target_records[split]:
            score -= 2.0 * (record_count - target_records[split]) / max(target_records[split], 1.0)
        for class_id in group_instances[key]:
            value = instances[split][class_id]
            score += 3.0 * (target_instances[split][class_id] - value) / max(target_instances[split][class_id], 1.0)
            new_value = value + group_instances[key][class_id]
            if new_value > target_instances[split][class_id]:
                score -= 6.0 * (new_value - target_instances[split][class_id]) / max(target_instances[split][class_id], 1.0)
        return score

    # Stratify by instance counts while assigning connected groups atomically.
    # Can-bearing groups are placed first so the small can pool is represented
    # in all partitions instead of being consumed by the training target.
    reserved_machine_groups = {
        key for key, items in groups.items()
        if any(item.get("source") in {"dataset-live", "true-negative"} for item in items)
    }
    ordered_keys = sorted(
        keys,
        key=lambda item: (
            0 if item in reserved_machine_groups else 1,
            -group_instances[item][0],
            -group_instances[item][1],
            -len(groups[item]),
            item,
        ),
    )
    for key in ordered_keys:
        labels = set(group_instances[key])
        chosen = "holdout" if key in reserved_machine_groups else max(("train", "val", "holdout"), key=lambda split: (assignment_score(key, split), split))
        assigned[key] = chosen
        sizes[chosen] += len(groups[key])
        instances[chosen].update(group_instances[key])
        class_by_split[chosen].update(labels)
    if cfg["data"].get("require_class_in_each_split", True):
        for split in ("train", "val", "holdout"):
            for class_id in (0, 1):
                if class_id not in class_by_split[split]:
                    candidates = [key for key in keys if class_id in {int(label["class_id"]) for record in groups[key] for label in record["labels"]} and assigned[key] != split]
                    if not candidates:
                        raise RuntimeError(f"cannot place class {class_id} in {split}")
                    donor = min(candidates, key=lambda key: len(groups[key]))
                    old_split = assigned[donor]
                    assigned[donor] = split
                    sizes[old_split] -= len(groups[donor])
                    sizes[split] += len(groups[donor])
                    instances[old_split].subtract(group_instances[donor])
                    instances[split].update(group_instances[donor])
                    class_by_split[old_split] = {item for item in class_by_split[old_split] if instances[old_split][item] > 0}
                    class_by_split[split].update(group_instances[donor])
    return assigned


def augment_image(image: np.ndarray, mode: str, seed: int, cfg: dict[str, Any]) -> np.ndarray:
    rng = np.random.default_rng(seed)
    result = image.astype(np.float32)
    bounds = cfg.get("augmentation", {}) if cfg else {}

    def interval(name: str, fallback: tuple[float, float]) -> tuple[float, float]:
        value = bounds.get(name, fallback)
        return float(value[0]), float(value[1])

    if mode == "dim":
        exposure_low, exposure_high = interval("exposure_multiplier", (0.45, 1.60))
        gamma_low, gamma_high = interval("gamma", (0.65, 1.60))
        multiplier = float(rng.uniform(exposure_low, min(0.80, exposure_high)))
        gamma = float(rng.uniform(max(1.10, gamma_low), gamma_high))
        result = np.power(np.clip(result * multiplier / 255.0, 0.0, 1.0), gamma) * 255.0
        noise_low, noise_high = interval("noise_std", (0.0, 8.0))
        result += rng.normal(0.0, float(rng.uniform(max(0.0, noise_low), noise_high)), result.shape)
    elif mode == "bright":
        exposure_low, exposure_high = interval("exposure_multiplier", (0.45, 1.60))
        gamma_low, gamma_high = interval("gamma", (0.65, 1.60))
        multiplier = float(rng.uniform(max(1.20, exposure_low), exposure_high))
        gamma = float(rng.uniform(gamma_low, min(0.90, gamma_high)))
        result = np.power(np.clip(result * multiplier / 255.0, 0.0, 1.0), gamma) * 255.0
        h, w = result.shape[:2]
        glare = np.zeros((h, w), dtype=np.float32)
        for _ in range(1 + int(rng.integers(0, 3))):
            center = (int(rng.integers(0, max(w, 1))), int(rng.integers(0, max(h, 1))))
            radius = int(rng.integers(max(10, min(h, w) // 12), max(11, min(h, w) // 3)))
            cv2.circle(glare, center, radius, float(rng.uniform(20.0, 70.0)), -1)
        glare = cv2.GaussianBlur(glare, (0, 0), max(3.0, min(h, w) / 10.0))
        result += glare[:, :, None]
    else:
        wb_low, wb_high = interval("white_balance_gain", (0.85, 1.15))
        contrast_low, contrast_high = interval("contrast", (0.75, 1.25))
        gains = rng.uniform(wb_low, wb_high, 3).astype(np.float32)
        result = np.clip((result - 128.0) * float(rng.uniform(contrast_low, contrast_high)) + 128.0, 0, 255)
        result *= gains[None, None, :]
        noise_low, noise_high = interval("noise_std", (0.0, 8.0))
        result += rng.normal(0.0, float(rng.uniform(noise_low, noise_high)), result.shape)
        blur_low, blur_high = interval("blur_kernel", (3, 7))
        if rng.random() < 0.75:
            kernel = int(rng.choice([value for value in (3, 5, 7) if blur_low <= value <= blur_high] or [3]))
            result = cv2.GaussianBlur(result, (kernel, kernel), 0)
        if rng.random() < 0.75:
            quality_low, quality_high = interval("jpeg_quality", (45, 95))
            ok, encoded = cv2.imencode(".jpg", np.clip(result, 0, 255).astype(np.uint8), [int(cv2.IMWRITE_JPEG_QUALITY), int(rng.uniform(quality_low, quality_high))])
            if ok:
                decoded = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
                if decoded is not None and decoded.shape == result.shape:
                    result = decoded.astype(np.float32)
    return np.clip(result, 0, 255).astype(np.uint8)


class DynamicPhotometricTransform:
    """Train-only, per-sample photometric stress transform.

    This object is inserted into Ultralytics' train dataset transform chain.
    It is deliberately photometric-only so normalized HBB labels remain valid;
    native bounded geometry settings handle the small spatial variation.
    """

    def __init__(self, seed: int, cfg: dict[str, Any]):
        self.rng = np.random.default_rng(seed)
        self.seed = seed
        self.cfg = cfg
        self.calls = 0

    def __call__(self, labels: dict[str, Any]) -> dict[str, Any]:
        image = labels.get("img")
        if image is None or not isinstance(image, np.ndarray) or image.ndim != 3:
            return labels
        draw = self.calls
        self.calls += 1
        mode = ("original", "dim", "bright", "optics")[int(self.rng.integers(0, 4))]
        if mode != "original":
            labels["img"] = augment_image(image, mode, self.seed + draw * 1009, self.cfg)
        labels["m1_augmentation"] = {"mode": mode, "seed": self.seed + draw * 1009}
        return labels


def install_dynamic_photometric_transform(cfg: dict[str, Any]) -> None:
    """Install the transform for this process against the pinned Ultralytics API."""
    from ultralytics.data.dataset import YOLODataset

    if getattr(YOLODataset, "_greenguard_dynamic_installed", False):
        return
    original = YOLODataset.build_transforms

    def build_transforms(dataset: Any, hyp: Any = None):
        transforms = original(dataset, hyp)
        if dataset.augment:
            transforms.transforms.insert(-1, DynamicPhotometricTransform(int(cfg["augmentation"]["seed"]), cfg))
        return transforms

    YOLODataset.build_transforms = build_transforms
    YOLODataset._greenguard_dynamic_installed = True


def copy_dataset(cfg: dict[str, Any], name: str, audit_report: dict[str, Any]) -> dict[str, Any]:
    output = generated_dir(cfg, name)
    if output.exists():
        raise RuntimeError(f"refusing to overwrite generated dataset: {output}")
    output.mkdir(parents=True)
    records = [record for record in audit_report["records"] if record["disposition"] in {"eligible", "approved_negative"}]
    group_assignments = split_groups(records, cfg, int(cfg["run"]["seed"]))
    max_originals = int(cfg["data"]["max_training_originals"])
    train_records = [record for record in records if group_assignments[record["group"]] == "train" and record["labels"]]
    train_selection_mode = "all"
    selected_ids: set[str] | None = None
    by_class = {class_id: [record for record in train_records if any(int(label["class_id"]) == class_id for label in record["labels"])] for class_id in (0, 1)}
    if by_class[0] and by_class[1]:
        per_class = min(len(by_class[0]), len(by_class[1]), max_originals // 2)
        rng = random.Random(int(cfg["run"]["seed"]))
        selected: list[dict[str, Any]] = []
        for class_id in (0, 1):
            values = by_class[class_id][:]
            rng.shuffle(values)
            selected.extend(values[:per_class])
        selected_ids = {record["image"] for record in selected}
        train_selection_mode = "deterministic_equal_class_sampling"
        records = [record for record in records if group_assignments[record["group"]] != "train" or record["image"] in selected_ids or not record["labels"]]
    split_counts = Counter()
    class_counts = Counter()
    val_groups = sorted({record["group"] for record in records if group_assignments[record["group"]] == "val"})
    calibration_group_count = max(1, round(len(val_groups) * float(cfg["data"]["calibration_fraction_of_validation"]))) if val_groups else 0
    calibration_groups = set(val_groups[:calibration_group_count])
    calibration: list[str] = []
    selection: list[str] = []
    holdout: list[str] = []
    manifest_records: list[dict[str, Any]] = []
    augmentation_examples: list[dict[str, Any]] = []
    for index, record in enumerate(sorted(records, key=lambda row: row["image"])):
        split = group_assignments[record["group"]]
        source_path = REPO_ROOT / record["image"]
        if not source_path.is_file():
            raise FileNotFoundError(source_path)
        stem = f"{index:06d}_{Path(record['image']).stem}"
        image = cv2.imread(str(source_path), cv2.IMREAD_COLOR)
        if image is None:
            raise RuntimeError(f"unable to decode {source_path}")
        labels = record["labels"]
        split_counts[split] += 1
        for label in labels:
            class_counts[CLASS_NAMES[int(label["class_id"])]] += 1
        partition = "selection" if split == "val" and record["group"] not in calibration_groups else "calibration" if split == "val" else split
        image_out = output / "images" / partition / f"{stem}.jpg"
        label_out = output / "labels" / partition / f"{stem}.txt"
        image_out.parent.mkdir(parents=True, exist_ok=True)
        label_out.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(image_out), image, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        label_out.write_text("\n".join(f"{label['class_id']} " + " ".join(f"{float(value):.8f}" for value in label["bbox"]) for label in labels) + ("\n" if labels else ""), encoding="utf-8", newline="\n")
        out_record = {"source": record["image"], "generated_image": image_out.relative_to(REPO_ROOT).as_posix(), "generated_label": label_out.relative_to(REPO_ROOT).as_posix(), "split": split, "group": record["group"], "source_sha256": record["image_sha256"], "labels": labels, "augmentation": "original"}
        manifest_records.append(out_record)
        if partition == "selection":
            selection.append(out_record["generated_image"])
        if partition == "calibration":
            calibration.append(out_record["generated_image"])
        if split == "holdout":
            holdout.append(out_record["generated_image"])
        if split == "train" and labels and len(augmentation_examples) < 12:
            mode = ("dim", "bright", "optics")[len(augmentation_examples) % 3]
            example_path = report_dir(cfg, name) / "augmentation_examples" / f"{len(augmentation_examples):02d}_{mode}.jpg"
            example_path.parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(example_path), augment_image(image, mode, int(cfg["run"]["seed"]) + index * 1009, cfg))
            augmentation_examples.append({"source": record["image"], "mode": mode, "seed": int(cfg["run"]["seed"]) + index * 1009, "path": str(example_path)})
    data_yaml = {"path": str(output.resolve()), "train": "images/train", "val": "images/selection", "test": "images/holdout", "names": {0: "metal_can", 1: "pet_bottle"}}
    atomic_write(output / "dataset.yaml", yaml.safe_dump(data_yaml, sort_keys=False))
    manifest = {"schema": "greenguard-m1-rebuild-dataset-v1", "run_id": name, "created_at": utc_now(), "classes": CLASS_NAMES, "records": manifest_records, "selection_images": selection, "calibration_images": calibration, "holdout_images": holdout, "split_counts": dict(split_counts), "class_instance_counts": dict(class_counts), "group_assignments": group_assignments, "augmentation": cfg["augmentation"], "augmentation_examples": augmentation_examples, "dynamic_train_augmentation": True}
    atomic_write(output / "manifest.json", manifest)
    return {"status": "READY", "generated_root": str(output), "split_counts": dict(split_counts), "class_instance_counts": dict(class_counts), "base_records": len(records), "train_selection_mode": train_selection_mode, "manifest": str(output / "manifest.json")}


def prepare(cfg: dict[str, Any], name: str, audit_name: str | None = None) -> dict[str, Any]:
    audit_path = report_dir(cfg, audit_name or name) / "audit_report.json"
    audit_report = json.loads(audit_path.read_text(encoding="utf-8")) if audit_path.is_file() else audit(cfg, name)
    eligible = [record for record in audit_report["records"] if record["disposition"] in {"eligible", "approved_negative"}]
    groups = {class_id: {record["group"] for record in eligible for label in record["labels"] if label["class_id"] == class_id} for class_id in (0, 1)}
    minimum = int(cfg["data"]["minimum_independent_groups_per_class"])
    if any(len(groups[class_id]) < minimum for class_id in (0, 1)):
        result = {"status": "NEEDS_REVIEW", "reason": "minimum independent groups per class not met", "groups": {CLASS_NAMES[k]: len(v) for k, v in groups.items()}}
        atomic_write(report_dir(cfg, name) / "prepare_report.json", result)
        return result
    result = copy_dataset(cfg, name, audit_report)
    atomic_write(report_dir(cfg, name) / "prepare_report.json", result)
    return result


def environment() -> dict[str, Any]:
    info: dict[str, Any] = {"python": sys.version, "platform": sys.platform}
    try:
        import torch
        info.update({"torch": torch.__version__, "cuda": torch.version.cuda, "cuda_available": bool(torch.cuda.is_available()), "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None})
    except Exception as exc:
        info["torch_error"] = str(exc)
    try:
        import ultralytics
        info["ultralytics"] = ultralytics.__version__
    except Exception as exc:
        info["ultralytics_error"] = str(exc)
    return info


def train(cfg: dict[str, Any], name: str, smoke: bool = False, resume_from: Path | None = None, batch_override: int | None = None) -> dict[str, Any]:
    dataset = generated_dir(cfg, name)
    data_yaml = dataset / "dataset.yaml"
    if not data_yaml.is_file():
        raise RuntimeError(f"prepared dataset missing: {data_yaml}")
    from ultralytics import YOLO

    model_name = str(cfg["training"]["pretrained_model"])
    report_root = report_dir(cfg, name)
    batches = [int(batch_override)] if batch_override else [int(v) for v in cfg["training"]["batches"]]
    last_error = None
    for batch in batches:
        try:
            model = YOLO(str(resume_from) if resume_from else model_name)
            install_dynamic_photometric_transform(cfg)
            weight_path = Path(getattr(model, "ckpt_path", model_name))
            if not weight_path.is_absolute():
                weight_path = (MODEL_ROOT / weight_path).resolve()
            run_name = name + ("_smoke_seed42" if smoke else f"_batch{batch}") + ("_resume" if resume_from else "")
            train_args = {
                "seed": int(cfg["run"]["seed"]),
                "data": str(data_yaml), "task": "detect", "imgsz": int(cfg["run"]["image_size"]), "epochs": 1 if smoke else int(cfg["training"]["epochs"]), "patience": 1 if smoke else int(cfg["training"]["patience"]), "batch": batch, "workers": int(cfg["training"]["workers"]), "cache": cfg["training"]["cache"], "optimizer": cfg["training"]["optimizer"], "lr0": float(cfg["training"]["lr0"]), "lrf": float(cfg["training"]["lrf"]), "weight_decay": float(cfg["training"]["weight_decay"]), "warmup_epochs": float(cfg["training"]["warmup_epochs"]), "amp": bool(cfg["training"]["amp"]) and not smoke, "device": int(cfg["training"]["device"]), "project": str(MODEL_ROOT / "runs"), "name": run_name, "exist_ok": bool(resume_from), "pretrained": not bool(resume_from), "resume": str(resume_from) if resume_from else False, "deterministic": True, "close_mosaic": int(cfg["training"]["close_mosaic"]), "mosaic": 0.0, "mixup": 0.0, "copy_paste": 0.0, "fliplr": 0.0, "flipud": 0.0, "multi_scale": 0.0, "degrees": float(cfg["augmentation"]["train_native"]["degrees"]), "translate": float(cfg["augmentation"]["train_native"]["translate"]), "scale": float(cfg["augmentation"]["train_native"]["scale"]), "shear": 0.0, "perspective": 0.0, "hsv_h": 0.0, "hsv_s": float(cfg["augmentation"]["train_native"]["hsv_s"]), "hsv_v": float(cfg["augmentation"]["train_native"]["hsv_v"]), "plots": True, "verbose": True,
            }
            started = time.time()
            result = model.train(**train_args)
            save_dir = Path(getattr(result, "save_dir", MODEL_ROOT / "runs" / train_args["name"]))
            best = save_dir / "weights" / "best.pt"
            if not best.is_file():
                raise RuntimeError(f"best checkpoint missing after training: {best}")
            results_csv = save_dir / "results.csv"
            completed_epochs = max(0, sum(1 for _ in results_csv.open(encoding="utf-8")) - 1) if results_csv.is_file() else None
            report = {"schema": "greenguard-m1-rebuild-train-v1", "run_id": name, "status": "COMPLETED", "smoke": smoke, "resumed_from": str(resume_from) if resume_from else None, "batch": batch, "completed_epochs": completed_epochs, "elapsed_seconds": time.time() - started, "best_checkpoint": str(best), "best_sha256": sha256_file(best), "pretrained_model": model_name, "pretrained_weight": str(weight_path) if weight_path.is_file() else model_name, "pretrained_weight_sha256": sha256_file(weight_path) if weight_path.is_file() else None, "dataset_yaml": str(data_yaml), "dynamic_augmentation": True, "environment": environment()}
            atomic_write(report_root / ("smoke_report.json" if smoke else "train_report.json"), report)
            return report
        except RuntimeError as exc:
            last_error = str(exc)
            if "out of memory" not in last_error.lower() and "cuda" not in last_error.lower():
                break
            try:
                import torch
                torch.cuda.empty_cache()
            except Exception:
                pass
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            break
    report = {"schema": "greenguard-m1-rebuild-train-v1", "run_id": name, "status": "FAILED", "reason": last_error, "environment": environment()}
    atomic_write(report_root / ("smoke_report.json" if smoke else "train_report.json"), report)
    return report


def xyxy_iou(left: Iterable[float], right: Iterable[float]) -> float:
    ax1, ay1, ax2, ay2 = left
    bx1, by1, bx2, by2 = right
    ix1, iy1, ix2, iy2 = max(ax1, bx1), max(ay1, by1), min(ax2, bx2), min(ay2, by2)
    intersection = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    return intersection / max(area_a + area_b - intersection, 1e-9)


def record_image(item: dict[str, Any]) -> np.ndarray | None:
    image_path = REPO_ROOT / item["generated_image"]
    return cv2.imread(str(image_path), cv2.IMREAD_COLOR)


def truth_boxes(item: dict[str, Any], width: int, height: int) -> list[dict[str, Any]]:
    truths = []
    for label in item.get("labels", []):
        cx, cy, bw, bh = [float(value) for value in label["bbox"]]
        truths.append({
            "class_id": int(label["class_id"]),
            "box": [(cx - bw / 2) * width, (cy - bh / 2) * height, (cx + bw / 2) * width, (cy + bh / 2) * height],
        })
    return truths


def collect_predictions(
    model_path: Path,
    records: list[dict[str, Any]],
    transform: Callable[[np.ndarray, int, dict[str, Any]], np.ndarray] | None = None,
    seed: int = 42,
) -> list[dict[str, Any]]:
    """Run one low-floor inference pass and retain raw predictions for scoring.

    Confidence selection must not re-run inference at every threshold. Keeping
    this collector independent from scoring also makes candidate/baseline and
    stress comparisons use identical predictions and matching code.
    """
    from ultralytics import YOLO

    model = YOLO(str(model_path), task="detect")
    collected: list[dict[str, Any]] = []
    for index, item in enumerate(records):
        image = record_image(item)
        if image is None:
            continue
        if transform is not None:
            image = transform(image, index, item)
        height, width = image.shape[:2]
        result = model.predict(image, imgsz=640, conf=0.001, device="cpu", verbose=False)[0]
        predictions: list[dict[str, Any]] = []
        if result.boxes is not None:
            for box, score, class_id in zip(
                result.boxes.xyxy.cpu().numpy(),
                result.boxes.conf.cpu().numpy(),
                result.boxes.cls.cpu().numpy().astype(int),
            ):
                if int(class_id) in CLASS_NAMES:
                    predictions.append({
                        "class_id": int(class_id),
                        "confidence": float(score),
                        "box": [float(value) for value in box],
                    })
        collected.append({
            "generated_image": item["generated_image"],
            "source": item.get("source"),
            "source_name": item.get("source_name"),
            "split": item.get("split"),
            "negative": not bool(item.get("labels")),
            "width": width,
            "height": height,
            "truths": truth_boxes(item, width, height),
            "predictions": predictions,
            "transform_seed": seed + index * 19,
        })
    return collected


def _area_fraction(box: list[float], width: int, height: int) -> float:
    x1, y1, x2, y2 = box
    return max(0.0, x2 - x1) * max(0.0, y2 - y1) / max(float(width * height), 1.0)


def _average_precision(collected: list[dict[str, Any]], class_id: int, iou_threshold: float, min_area_frac: float) -> float:
    total_truths = sum(sum(1 for truth in item["truths"] if truth["class_id"] == class_id) for item in collected)
    if total_truths == 0:
        return 0.0
    ranked: list[tuple[float, int, list[float]]] = []
    for item_index, item in enumerate(collected):
        for prediction in item["predictions"]:
            if prediction["class_id"] == class_id and _area_fraction(prediction["box"], item["width"], item["height"]) >= min_area_frac:
                ranked.append((prediction["confidence"], item_index, prediction["box"]))
    ranked.sort(key=lambda row: row[0], reverse=True)
    used: dict[int, set[int]] = defaultdict(set)
    true_positive: list[int] = []
    false_positive: list[int] = []
    for _, item_index, box in ranked:
        truths = collected[item_index]["truths"]
        matches = [
            (truth_index, xyxy_iou(box, truth["box"]))
            for truth_index, truth in enumerate(truths)
            if truth["class_id"] == class_id and truth_index not in used[item_index]
        ]
        best = max(matches, key=lambda row: row[1], default=(-1, 0.0))
        if best[1] >= iou_threshold:
            used[item_index].add(best[0])
            true_positive.append(1)
            false_positive.append(0)
        else:
            true_positive.append(0)
            false_positive.append(1)
    if not true_positive:
        return 0.0
    cumulative_tp = np.cumsum(true_positive)
    cumulative_fp = np.cumsum(false_positive)
    precision = cumulative_tp / np.maximum(cumulative_tp + cumulative_fp, 1)
    recall = cumulative_tp / max(total_truths, 1)
    return float(np.mean([max(precision[recall >= point], default=0.0) for point in np.linspace(0.0, 1.0, 101)]))


def score_predictions(collected: list[dict[str, Any]], confidence: float, iou_threshold: float, min_area_frac: float = 0.02) -> dict[str, Any]:
    stats = {class_id: {"tp": 0, "fp": 0, "fn": 0} for class_id in CLASS_NAMES}
    confusion = {truth_name: {pred_name: 0 for pred_name in CLASS_NAMES.values()} for truth_name in CLASS_NAMES.values()}
    false_positives_by_source: Counter[str] = Counter()
    misses_by_source: Counter[str] = Counter()
    accepted_confidences: dict[int, list[float]] = {class_id: [] for class_id in CLASS_NAMES}
    empty_machine_images = 0
    empty_machine_false_positive_images = 0
    accepted_detections_on_empty = 0
    scored_images = 0
    for item in collected:
        scored_images += 1
        truths = item["truths"]
        predictions = [
            prediction for prediction in item["predictions"]
            if prediction["confidence"] >= confidence
            and _area_fraction(prediction["box"], item["width"], item["height"]) >= min_area_frac
        ]
        if item["negative"]:
            empty_machine_images += 1
            accepted_detections_on_empty += len(predictions)
            if predictions:
                empty_machine_false_positive_images += 1
        used: set[int] = set()
        for prediction in sorted(predictions, key=lambda row: row["confidence"], reverse=True):
            class_id = int(prediction["class_id"])
            accepted_confidences[class_id].append(float(prediction["confidence"]))
            matches = [
                (truth_index, xyxy_iou(prediction["box"], truth["box"]))
                for truth_index, truth in enumerate(truths)
                if truth_index not in used and truth["class_id"] == class_id
            ]
            best = max(matches, key=lambda row: row[1], default=(-1, 0.0))
            if best[1] >= iou_threshold:
                used.add(best[0])
                stats[class_id]["tp"] += 1
                confusion[CLASS_NAMES[class_id]][CLASS_NAMES[class_id]] += 1
                continue
            stats[class_id]["fp"] += 1
            false_positives_by_source[str(item.get("source_name") or item.get("source") or "unknown")] += 1
            wrong_matches = [
                (truth["class_id"], xyxy_iou(prediction["box"], truth["box"]))
                for truth_index, truth in enumerate(truths)
                if truth_index not in used and truth["class_id"] != class_id
            ]
            wrong = max(wrong_matches, key=lambda row: row[1], default=(-1, 0.0))
            if wrong[1] >= iou_threshold:
                confusion[CLASS_NAMES[wrong[0]]][CLASS_NAMES[class_id]] += 1
        for truth_index, truth in enumerate(truths):
            if truth_index not in used:
                class_id = int(truth["class_id"])
                stats[class_id]["fn"] += 1
                misses_by_source[str(item.get("source_name") or item.get("source") or "unknown")] += 1
    result: dict[str, Any] = {
        "images": scored_images,
        "confidence": confidence,
        "iou": iou_threshold,
        "min_area_frac": min_area_frac,
        "classes": {},
        "confusion": confusion,
        "false_positives_by_source": dict(false_positives_by_source),
        "misses_by_source": dict(misses_by_source),
        "empty_machine": {
            "images": empty_machine_images,
            "false_positive_images": empty_machine_false_positive_images,
            "accepted_detections": accepted_detections_on_empty,
            "status": "MEASURED" if empty_machine_images else "NOT_MEASURED",
        },
    }
    f1_values = []
    recall_values = []
    for class_id in CLASS_NAMES:
        values = stats[class_id]
        precision = values["tp"] / max(values["tp"] + values["fp"], 1)
        recall = values["tp"] / max(values["tp"] + values["fn"], 1)
        f1 = 2 * precision * recall / max(precision + recall, 1e-9)
        ap50 = _average_precision(collected, class_id, 0.50, min_area_frac)
        ap_values = [_average_precision(collected, class_id, threshold, min_area_frac) for threshold in np.arange(0.50, 1.00, 0.05)]
        f1_values.append(f1)
        recall_values.append(recall)
        result["classes"][CLASS_NAMES[class_id]] = {
            **values,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "ap50": ap50,
            "ap50_95": float(np.mean(ap_values)),
            "confidence_distribution": {
                "accepted_count": len(accepted_confidences[class_id]),
                "mean": float(np.mean(accepted_confidences[class_id])) if accepted_confidences[class_id] else None,
                "p10": float(np.percentile(accepted_confidences[class_id], 10)) if accepted_confidences[class_id] else None,
                "p50": float(np.percentile(accepted_confidences[class_id], 50)) if accepted_confidences[class_id] else None,
                "p90": float(np.percentile(accepted_confidences[class_id], 90)) if accepted_confidences[class_id] else None,
            },
        }
    result["macro_f1"] = float(np.mean(f1_values))
    result["macro_recall"] = float(np.mean(recall_values))
    result["wrong_class_confusions"] = sum(
        count for truth_name, predicted in confusion.items() for predicted_name, count in predicted.items() if truth_name != predicted_name
    )
    return result


def evaluate_model(
    model_path: Path,
    records: list[dict[str, Any]],
    confidence: float,
    iou_threshold: float,
    transform: Callable[[np.ndarray, int, dict[str, Any]], np.ndarray] | None = None,
    seed: int = 42,
    min_area_frac: float = 0.02,
) -> dict[str, Any]:
    collected = collect_predictions(model_path, records, transform=transform, seed=seed)
    return score_predictions(collected, confidence, iou_threshold, min_area_frac=min_area_frac)


def choose_confidence(cfg: dict[str, Any], model_path: Path, records: list[dict[str, Any]]) -> tuple[float, dict[str, Any]]:
    collected = collect_predictions(model_path, records, seed=int(cfg["run"]["seed"]))
    candidates: list[tuple[float, dict[str, Any]]] = []
    evaluation_cfg = cfg["evaluation"]
    for confidence in evaluation_cfg["calibration_confidences"]:
        metrics = score_predictions(
            collected,
            float(confidence),
            float(evaluation_cfg["iou"]),
            min_area_frac=float(cfg["workflow"]["min_area_frac"]),
        )
        precisions = [metrics["classes"][name]["precision"] for name in CLASS_NAMES.values()]
        if min(precisions) >= float(evaluation_cfg["minimum_precision"]):
            candidates.append((float(confidence), metrics))
    if candidates:
        # The contract prioritizes macro recall after the per-class precision
        # floor, with F1 and the lower threshold used only as deterministic ties.
        selected = max(candidates, key=lambda row: (row[1]["macro_recall"], row[1]["macro_f1"], -row[0]))
        selected[1]["threshold_selection"] = "CALIBRATION_MAX_MACRO_RECALL_WITH_PRECISION_FLOOR"
        return selected
    fallback = 0.65
    fallback_metrics = score_predictions(
        collected,
        fallback,
        float(evaluation_cfg["iou"]),
        min_area_frac=float(cfg["workflow"]["min_area_frac"]),
    )
    fallback_metrics["threshold_selection"] = "FALLBACK_NO_CALIBRATION_THRESHOLD_MET_METAL_AND_PET_PRECISION_FLOOR"
    return fallback, fallback_metrics


def fixed_stress_transform(exposure: float, variant: str = "exposure") -> Callable[[np.ndarray, int, dict[str, Any]], np.ndarray]:
    """Return a deterministic transform for an evaluation-only stress case."""
    def transform(image: np.ndarray, index: int, item: dict[str, Any]) -> np.ndarray:
        result = np.clip(image.astype(np.float32) * float(exposure), 0.0, 255.0)
        if variant == "blur":
            result = cv2.GaussianBlur(result, (7, 7), 0)
        elif variant == "glare":
            height, width = result.shape[:2]
            glare = np.zeros((height, width), dtype=np.float32)
            center = (int(width * 0.72), int(height * 0.30))
            radius = max(8, int(min(height, width) * 0.16))
            cv2.circle(glare, center, radius, 90.0, -1)
            glare = cv2.GaussianBlur(glare, (0, 0), max(3.0, min(height, width) / 14.0))
            result += glare[:, :, None]
        return np.clip(result, 0.0, 255.0).astype(np.uint8)
    return transform


def evaluate(cfg: dict[str, Any], name: str) -> dict[str, Any]:
    report_root = report_dir(cfg, name)
    train_report = json.loads((report_root / "train_report.json").read_text(encoding="utf-8"))
    checkpoint = Path(train_report["best_checkpoint"])
    manifest = json.loads((generated_dir(cfg, name) / "manifest.json").read_text(encoding="utf-8"))
    by_path = {row["generated_image"]: row for row in manifest["records"]}
    calibration = [by_path[path] for path in manifest["calibration_images"]]
    holdout = [by_path[path] for path in manifest["holdout_images"]]
    evaluation_cfg = cfg["evaluation"]
    min_area_frac = float(cfg["workflow"]["min_area_frac"])
    confidence, calibration_metrics = choose_confidence(cfg, checkpoint, calibration)
    candidate = evaluate_model(checkpoint, holdout, confidence, float(evaluation_cfg["iou"]), min_area_frac=min_area_frac, seed=int(cfg["run"]["seed"]))
    baseline_path = RUNTIME_ROOT / "models" / "m1_detect_640.onnx"
    baseline = evaluate_model(baseline_path, holdout, confidence, float(evaluation_cfg["iou"]), min_area_frac=min_area_frac, seed=int(cfg["run"]["seed"])) if baseline_path.is_file() else {"status": "NOT_MEASURED"}
    stress: dict[str, Any] = {}
    for exposure in evaluation_cfg["stress_exposures"]:
        key = f"exposure_{float(exposure):.2f}"
        stress[key] = evaluate_model(
            checkpoint,
            holdout,
            confidence,
            float(evaluation_cfg["iou"]),
            transform=fixed_stress_transform(float(exposure)),
            seed=int(cfg["run"]["seed"]),
            min_area_frac=min_area_frac,
        )
    stress["blur_7x7"] = evaluate_model(checkpoint, holdout, confidence, float(evaluation_cfg["iou"]), transform=fixed_stress_transform(1.0, "blur"), min_area_frac=min_area_frac)
    stress["bounded_glare"] = evaluate_model(checkpoint, holdout, confidence, float(evaluation_cfg["iou"]), transform=fixed_stress_transform(1.0, "glare"), min_area_frac=min_area_frac)
    for stress_metrics in stress.values():
        for class_name in CLASS_NAMES.values():
            stress_metrics["classes"][class_name]["recall_loss_vs_normal"] = candidate["classes"][class_name]["recall"] - stress_metrics["classes"][class_name]["recall"]
    failures: list[str] = []
    acceptance: dict[str, Any] = {}
    for class_name in CLASS_NAMES.values():
        metrics = candidate["classes"][class_name]
        class_failures = []
        if metrics["precision"] < float(evaluation_cfg["minimum_precision"]):
            class_failures.append("precision_below_minimum")
            failures.append(f"{class_name}_precision_below_minimum")
        if metrics["recall"] < float(evaluation_cfg["minimum_recall"]):
            class_failures.append("recall_below_minimum")
            failures.append(f"{class_name}_recall_below_minimum")
        baseline_class = baseline.get("classes", {}).get(class_name)
        if baseline_class and metrics["recall"] + float(evaluation_cfg["maximum_recall_regression"]) < baseline_class["recall"]:
            class_failures.append("recall_regressed_vs_baseline")
            failures.append(f"{class_name}_recall_regressed")
        acceptance[class_name] = {"status": "PASS" if not class_failures else "FAIL", "failures": class_failures, "candidate": metrics, "baseline": baseline_class or "NOT_MEASURED"}
    if calibration_metrics.get("threshold_selection", "").startswith("FALLBACK"):
        failures.append("no_calibration_threshold_met_precision_floor")
    if candidate["empty_machine"]["status"] != "MEASURED":
        failures.append("empty_machine_not_measured")
    elif candidate["empty_machine"]["accepted_detections"] != 0:
        failures.append("empty_machine_false_positive")
    stress_wrong = {key: value["wrong_class_confusions"] for key, value in stress.items() if value.get("images", 0)}
    if any(value > 0 for value in stress_wrong.values()):
        failures.append("stress_wrong_class_confusion")
    result = {
        "schema": "greenguard-m1-rebuild-evaluation-v2",
        "run_id": name,
        "status": "PASS" if not failures else "FAIL",
        "production_ready": False,
        "confidence": confidence,
        "min_area_frac": min_area_frac,
        "calibration": calibration_metrics,
        "acceptance": acceptance,
        "candidate": candidate,
        "baseline": baseline,
        "stress": stress,
        "stress_wrong_class_confusions": stress_wrong,
        "failures": failures,
        "holdout_images": len(holdout),
        "note": "offline gates do not activate the model; owner camera validation remains required",
    }
    atomic_write(report_root / "evaluation_report.json", result)
    return result


def export_model(cfg: dict[str, Any], name: str) -> dict[str, Any]:
    from ultralytics import YOLO

    report_root = report_dir(cfg, name)
    train_report = json.loads((report_root / "train_report.json").read_text(encoding="utf-8"))
    checkpoint = Path(train_report["best_checkpoint"])
    target = MODEL_ROOT / "export" / "candidates" / name
    if target.exists():
        raise RuntimeError(f"refusing to overwrite candidate export: {target}")
    target.mkdir(parents=True)
    model = YOLO(str(checkpoint), task="detect")
    exported = model.export(format="onnx", imgsz=640, batch=1, dynamic=False, half=False, simplify=True, opset=17, nms=False)
    exported_path = Path(exported)
    destination = target / "m1_rebuild_640.onnx"
    shutil.copy2(exported_path, destination)
    (target / "labels.txt").write_text("metal_can\npet_bottle\n", encoding="utf-8", newline="\n")
    rejected_hashes = load_rejected_hashes()
    candidate_sha256 = sha256_file(destination)
    if candidate_sha256 in rejected_hashes:
        raise RuntimeError("candidate export hash is listed in rejected_models.json; refusing publication")
    active_m1 = RUNTIME_ROOT / "models" / "m1_detect_640.onnx"
    active_m2 = RUNTIME_ROOT / "models" / "m2_obb_640.onnx"
    evaluation_path = report_root / "evaluation_report.json"
    evaluation = json.loads(evaluation_path.read_text(encoding="utf-8")) if evaluation_path.is_file() else {}
    candidate_status = "CAMERA_VALIDATION_REQUIRED" if evaluation.get("status") == "PASS" else "FAILED_ACCEPTANCE"
    runtime_config_path = RUNTIME_ROOT / "config" / f"m1_rebuild_{name}.json"
    if runtime_config_path.exists():
        raise RuntimeError(f"refusing to overwrite candidate runtime config: {runtime_config_path}")
    default_config_path = RUNTIME_ROOT / "config" / "default.json"
    runtime_config = json.loads(default_config_path.read_text(encoding="utf-8"))
    detector = runtime_config["m1"]["detector"]
    detector.update({
        "path": f"../training/model1/export/candidates/{name}/m1_rebuild_640.onnx",
        "classes": list(CLASS_NAMES.values()),
        "visible_class_ids": [0, 1],
        "ignored_class_ids": [],
        "decision_conf": float(evaluation.get("confidence", 0.65)),
        "candidate_only": True,
        "candidate_run": name,
        "candidate_sha256": candidate_sha256,
    })
    runtime_config["m1"]["min_area_frac"] = float(cfg["workflow"]["min_area_frac"])
    runtime_config["candidate_validation"] = {
        "status": candidate_status,
        "manifest": f"../training/model1/export/candidates/{name}/candidate_manifest.json",
        "active_model2_sha256": sha256_file(active_m2) if active_m2.is_file() else None,
    }
    atomic_write(runtime_config_path, runtime_config)
    candidate_manifest = {
        "schema": "greenguard-m1-rebuild-candidate-v1",
        "run_id": name,
        "status": candidate_status,
        "classes": CLASS_NAMES,
        "task": "detect",
        "image_size": int(cfg["run"]["image_size"]),
        "onnx": str(destination),
        "onnx_runtime_path": f"../training/model1/export/candidates/{name}/m1_rebuild_640.onnx",
        "onnx_sha256": candidate_sha256,
        "checkpoint": str(checkpoint),
        "checkpoint_sha256": sha256_file(checkpoint),
        "runtime_config": str(runtime_config_path),
        "decision_conf": float(evaluation.get("confidence", 0.65)),
        "min_area_frac": float(cfg["workflow"]["min_area_frac"]),
        "active_baseline_m1_sha256": sha256_file(active_m1) if active_m1.is_file() else None,
        "active_model2_sha256": sha256_file(active_m2) if active_m2.is_file() else None,
        "rejected_hash_protection": {"checked": True, "rejected_hashes": sorted(rejected_hashes), "candidate_is_rejected": False},
        "workflow_contract": {"observations": 7, "quorum": 4, "pet_only_m2": True, "one_result_per_item": True, "clear_frames_to_rearm": 8},
        "production_touched": False,
    }
    atomic_write(target / "candidate_manifest.json", candidate_manifest)
    report = {
        "schema": "greenguard-m1-rebuild-export-v2",
        "run_id": name,
        "status": "EXPORTED",
        "candidate_status": candidate_status,
        "checkpoint": str(checkpoint),
        "checkpoint_sha256": sha256_file(checkpoint),
        "onnx": str(destination),
        "onnx_sha256": candidate_sha256,
        "bytes": destination.stat().st_size,
        "classes": CLASS_NAMES,
        "runtime_config": str(runtime_config_path),
        "production_touched": False,
    }
    atomic_write(report_root / "export_report.json", report)
    return report


def verify(cfg: dict[str, Any], name: str) -> dict[str, Any]:
    report_root = report_dir(cfg, name)
    export_report = json.loads((report_root / "export_report.json").read_text(encoding="utf-8"))
    candidate = Path(export_report["onnx"])
    checks: dict[str, Any] = {"candidate_exists": candidate.is_file(), "candidate_sha256": sha256_file(candidate) if candidate.is_file() else None}
    for label, path in {"active_m1": RUNTIME_ROOT / "models" / "m1_detect_640.onnx", "active_m2": RUNTIME_ROOT / "models" / "m2_obb_640.onnx"}.items():
        checks[label] = {"path": str(path), "sha256": sha256_file(path) if path.is_file() else None}
    try:
        import onnx
        graph = onnx.load(str(candidate))
        inputs = [list(value.shape.dim[i].dim_value for i in range(len(value.shape.dim))) for value in graph.graph.input]
        outputs = [list(value.shape.dim[i].dim_value for i in range(len(value.shape.dim))) for value in graph.graph.output]
        checks["onnx"] = {"inputs": inputs, "outputs": outputs, "metadata": {item.key: item.value for item in graph.metadata_props}}
        checks["expected_layout"] = outputs == [[1, 6, 8400]]
    except Exception as exc:
        try:
            import onnxruntime as ort
            session = ort.InferenceSession(str(candidate), providers=["CPUExecutionProvider"])
            checks["onnxruntime"] = {"inputs": [list(value.shape) for value in session.get_inputs()], "outputs": [list(value.shape) for value in session.get_outputs()]}
            checks["expected_layout"] = checks["onnxruntime"]["outputs"] == [[1, 6, 8400]]
        except Exception as runtime_exc:
            checks["onnx_error"] = f"onnx={exc}; onnxruntime={runtime_exc}"
    checks["class_metadata"] = {
        "expected": {str(key): value for key, value in CLASS_NAMES.items()},
        "labels_file": (candidate.parent / "labels.txt").read_text(encoding="utf-8").splitlines() if (candidate.parent / "labels.txt").is_file() else None,
    }
    checks["class_metadata"]["pass"] = class_metadata_valid(export_report.get("classes", {}), checks["class_metadata"]["labels_file"])
    checks["rejected_hash_protection"] = {"candidate_is_rejected": checks["candidate_sha256"] in load_rejected_hashes(), "pass": checks["candidate_sha256"] not in load_rejected_hashes()}

    parity: dict[str, Any] = {"status": "NOT_MEASURED"}
    benchmark: dict[str, Any] = {"status": "NOT_MEASURED"}
    train_report_path = report_root / "train_report.json"
    manifest_path = generated_dir(cfg, name) / "manifest.json"
    if candidate.is_file() and train_report_path.is_file() and manifest_path.is_file():
        try:
            train_report = json.loads(train_report_path.read_text(encoding="utf-8"))
            checkpoint = Path(train_report["best_checkpoint"])
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            by_class: dict[int, dict[str, Any]] = {}
            negative: dict[str, Any] | None = None
            for path in manifest.get("holdout_images", []):
                record = next(row for row in manifest["records"] if row["generated_image"] == path)
                labels = record.get("labels", [])
                if not labels and negative is None:
                    negative = record
                for label in labels:
                    by_class.setdefault(int(label["class_id"]), record)
            parity_records = [record for class_id in (0, 1) if (record := by_class.get(class_id))]
            if negative:
                parity_records.append(negative)
            parity_cases = []
            for label, transform in [
                ("normal", None),
                ("dim_exposure_0.25", fixed_stress_transform(0.25)),
                ("bright_exposure_2.0", fixed_stress_transform(2.0)),
            ]:
                if not parity_records:
                    continue
                left = collect_predictions(checkpoint, parity_records, transform=transform, seed=int(cfg["run"]["seed"]))
                right = collect_predictions(candidate, parity_records, transform=transform, seed=int(cfg["run"]["seed"]))
                case_matches = []
                for left_item, right_item in zip(left, right):
                    unmatched = 0
                    worst_iou = 1.0
                    worst_conf_delta = 0.0
                    for class_id in CLASS_NAMES:
                        left_predictions = sorted((row for row in left_item["predictions"] if row["class_id"] == class_id), key=lambda row: row["confidence"], reverse=True)
                        right_predictions = sorted((row for row in right_item["predictions"] if row["class_id"] == class_id), key=lambda row: row["confidence"], reverse=True)
                        used = set()
                        for prediction in left_predictions:
                            matches = [(idx, xyxy_iou(prediction["box"], candidate_prediction["box"])) for idx, candidate_prediction in enumerate(right_predictions) if idx not in used]
                            best = max(matches, key=lambda row: row[1], default=(-1, 0.0))
                            if best[0] < 0:
                                unmatched += 1
                                continue
                            used.add(best[0])
                            worst_iou = min(worst_iou, best[1])
                            worst_conf_delta = max(worst_conf_delta, abs(prediction["confidence"] - right_predictions[best[0]]["confidence"]))
                        unmatched += max(0, len(right_predictions) - len(used))
                    case_matches.append({"image": left_item["generated_image"], "unmatched": unmatched, "min_iou": worst_iou, "max_confidence_delta": worst_conf_delta})
                parity_cases.append({"case": label, "images": len(case_matches), "results": case_matches})
            parity_pass = all(
                row["unmatched"] == 0 and row["min_iou"] >= 0.95 and row["max_confidence_delta"] <= 0.001
                for case in parity_cases for row in case["results"]
            ) if parity_cases else False
            parity = {"status": "PASS" if parity_pass else "FAIL", "thresholds": {"box_iou": 0.95, "confidence_delta": 0.001}, "cases": parity_cases}

            from ultralytics import YOLO
            benchmark_model = YOLO(str(candidate), task="detect")
            sample_image = record_image(parity_records[0]) if parity_records else None
            if sample_image is not None:
                for _ in range(3):
                    benchmark_model.predict(sample_image, imgsz=640, conf=0.001, device="cpu", verbose=False)
                durations = []
                for _ in range(10):
                    started = time.perf_counter()
                    benchmark_model.predict(sample_image, imgsz=640, conf=0.001, device="cpu", verbose=False)
                    durations.append((time.perf_counter() - started) * 1000.0)
                durations.sort()
                median_ms = float(np.median(durations))
                p95_ms = float(np.percentile(durations, 95))
                benchmark = {"status": "MEASURED", "runs": len(durations), "median_inference_ms": median_ms, "p95_inference_ms": p95_ms, "target_fps": 5.0, "m1_fps": 1000.0 / max(median_ms, 1e-9), "full_workflow_fps": None, "full_workflow_status": "NOT_MEASURED"}
                # Exercise the same public M1 -> PET-only M2 routing on a
                # candidate-configured runtime, while leaving default.json
                # and the active model files untouched.
                pet_record = by_class.get(1)
                if pet_record is not None:
                    import importlib
                    runtime_src = RUNTIME_ROOT / "src"
                    if str(runtime_src) not in sys.path:
                        sys.path.insert(0, str(runtime_src))
                    pipeline_module = importlib.import_module("pipeline")
                    candidate_cfg = json.loads(Path(export_report.get("runtime_config", "")).read_text(encoding="utf-8"))
                    m1_pipeline = pipeline_module.M1Pipeline(candidate_cfg)
                    m2_pipeline = pipeline_module.M2Pipeline(candidate_cfg)
                    pet_image = record_image(pet_record)
                    if pet_image is not None:
                        for _ in range(2):
                            m1_result = m1_pipeline.run(pet_image, det_conf=0.001)
                            if m1_result.is_pet and m1_result.poly is not None:
                                m2_pipeline.run(pet_image, m1_result.poly, infer_conf=0.001)
                        workflow_durations = []
                        for _ in range(5):
                            started = time.perf_counter()
                            m1_result = m1_pipeline.run(pet_image, det_conf=0.001)
                            if m1_result.is_pet and m1_result.poly is not None:
                                m2_pipeline.run(pet_image, m1_result.poly, infer_conf=0.001)
                            workflow_durations.append((time.perf_counter() - started) * 1000.0)
                        workflow_median_ms = float(np.median(workflow_durations))
                        benchmark["full_workflow_fps"] = 1000.0 / max(workflow_median_ms, 1e-9)
                        benchmark["full_workflow_median_ms"] = workflow_median_ms
                        benchmark["target_fps_met"] = benchmark["full_workflow_fps"] >= benchmark["target_fps"]
                        benchmark["full_workflow_status"] = "MEASURED"
        except Exception as exc:
            parity = {"status": "NOT_MEASURED", "reason": str(exc)}
    checks["parity"] = parity
    checks["benchmark"] = benchmark
    result = {
        "schema": "greenguard-m1-rebuild-verify-v2",
        "run_id": name,
        "status": "PASS" if checks["candidate_exists"] and checks.get("expected_layout", False) and checks["class_metadata"]["pass"] and checks["rejected_hash_protection"]["pass"] and checks["active_m1"]["sha256"] and checks["active_m2"]["sha256"] and parity.get("status") == "PASS" else "FAIL",
        "checks": checks,
        "production_touched": False,
    }
    manifest_path = candidate.parent / "candidate_manifest.json"
    if manifest_path.is_file():
        candidate_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        candidate_manifest["verification_status"] = result["status"]
        candidate_manifest["status"] = "CAMERA_VALIDATION_REQUIRED" if result["status"] == "PASS" and candidate_manifest.get("status") != "FAILED_ACCEPTANCE" else "FAILED_ACCEPTANCE"
        atomic_write(manifest_path, candidate_manifest)
    runtime_config_path = Path(export_report.get("runtime_config", ""))
    if runtime_config_path.is_file():
        runtime_config = json.loads(runtime_config_path.read_text(encoding="utf-8"))
        runtime_config.setdefault("candidate_validation", {})["status"] = candidate_manifest.get("status") if manifest_path.is_file() else "FAILED_ACCEPTANCE"
        atomic_write(runtime_config_path, runtime_config)
    atomic_write(report_root / "verify_report.json", result)
    return result


def dispatch(args: argparse.Namespace) -> int:
    cfg = load_config(Path(args.config) if args.config else CONFIG_PATH)
    name = run_id(cfg, args.run_id)
    if args.command == "audit": result = audit(cfg, name)
    elif args.command == "compact-audit": result = compact_audit(cfg, name)
    elif args.command == "prepare": result = prepare(cfg, name, audit_name=args.audit_run_id)
    elif args.command == "smoke": result = train(cfg, name, smoke=True, batch_override=args.batch)
    elif args.command == "train": result = train(cfg, name, resume_from=args.resume_from, batch_override=args.batch)
    elif args.command == "evaluate": result = evaluate(cfg, name)
    elif args.command == "export": result = export_model(cfg, name)
    elif args.command == "verify": result = verify(cfg, name)
    else: raise ValueError(args.command)
    printable = {key: value for key, value in result.items() if key != "records"}
    print(json.dumps(printable, indent=2, default=str))
    return 0 if result.get("status") not in {"FAILED", "FAIL", "NEEDS_REVIEW"} else 2


def main() -> int:
    parser = argparse.ArgumentParser(description="GreenGuard two-class Model 1 rebuild")
    parser.add_argument("command", choices=["audit", "compact-audit", "prepare", "smoke", "train", "evaluate", "export", "verify"])
    parser.add_argument("--config", type=Path)
    parser.add_argument("--run-id")
    parser.add_argument("--batch", type=int)
    parser.add_argument("--resume-from", type=Path)
    parser.add_argument("--audit-run-id")
    return dispatch(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
