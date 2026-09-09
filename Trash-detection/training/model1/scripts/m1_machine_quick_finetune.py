"""Bounded Model 1 machine-domain fine-tune workflow.

This runner is deliberately separate from ``m1_rebuild.py``.  It owns a
short, resumable, machine-focused experiment and never dispatches the
12-hour rebuild.  The normal stages only use the local filesystem; GPU
training is performed only by an explicit stage or by ``full --activate``.
The module's pure data, sampler, deadline, and metadata helpers are safe to
import from CPU-only tests.
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
from typing import Any, Callable, Iterable, Iterator

import cv2
import numpy as np
import yaml


REPO_ROOT = Path(__file__).resolve().parents[4]
MODEL_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_ROOT = MODEL_ROOT.parents[1] / "pc-demo"
DEFAULT_CONFIG = MODEL_ROOT / "config" / "m1_machine_quick_finetune.yaml"
CLASS_NAMES = {0: "metal_can", 1: "pet_bottle"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
STAGES = (
    "preflight",
    "audit-new",
    "prepare-replay",
    "baseline",
    "smoke",
    "freeze-head",
    "full-finetune",
    "calibrate",
    "evaluate",
    "export",
    "verify",
    "activate",
    "publish",
)
ROLE_QUOTAS = (
    "new_can",
    "new_pet",
    "old_machine_can",
    "old_machine_pet",
    "generic_can",
    "generic_pet",
    "negative",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_write(path: Path, value: Any) -> None:
    """Write JSON/text/YAML artifacts without leaving partial reports."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    if isinstance(value, str):
        temporary.write_text(value, encoding="utf-8", newline="\n")
    else:
        temporary.write_text(json.dumps(value, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8", newline="\n")
    os.replace(temporary, path)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest().lower()


def decoded_hash(image: np.ndarray) -> str | None:
    if image is None:
        return None
    ok, encoded = cv2.imencode(".png", image)
    return hashlib.sha256(encoded.tobytes()).hexdigest().lower() if ok else None


def image_files(root: Path) -> list[Path]:
    return sorted(path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS) if root.is_dir() else []


def load_config(path: Path = DEFAULT_CONFIG) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        config = yaml.safe_load(handle) or {}
    names = config.get("classes", {}).get("names", {})
    normalized = {int(key): value for key, value in names.items()} if isinstance(names, dict) else {}
    if normalized != CLASS_NAMES:
        raise ValueError("quick fine-tune requires exactly metal_can and pet_bottle in class order")
    config["_config_path"] = str(path.resolve())
    return config


def run_name(config: dict[str, Any], supplied: str | None = None) -> str:
    if supplied:
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{2,100}", supplied):
            raise ValueError("run id contains unsupported characters")
        return supplied
    return f"{config['run']['id_prefix']}_{datetime.now().strftime('%Y%m%d')}_seed{config['run']['seed']}_r1"


def report_root(config: dict[str, Any], name: str) -> Path:
    return MODEL_ROOT / config["run"]["report_root"] / name


def generated_root(config: dict[str, Any], name: str) -> Path:
    return MODEL_ROOT / config["run"]["generated_root"] / name


def resolve_model_path(config: dict[str, Any], key: str) -> Path:
    raw = Path(str(config["sources"][key]))
    return raw.resolve() if raw.is_absolute() else (MODEL_ROOT / raw).resolve()


def resolve_repo_path(value: str | Path) -> Path:
    path = Path(value)
    return path.resolve() if path.is_absolute() else (REPO_ROOT / path).resolve()


def git_head() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


class DeadlineExceeded(RuntimeError):
    pass


class WallClockDeadline:
    """Monotonic hard wall-clock budget with injectable time for tests."""

    def __init__(self, minutes: float, started: float | None = None, clock: Callable[[], float] = time.monotonic):
        if minutes <= 0:
            raise ValueError("wall-clock budget must be positive")
        self.minutes = float(minutes)
        self.clock = clock
        self.started = clock() if started is None else float(started)
        self.deadline = self.started + self.minutes * 60.0

    def elapsed_seconds(self) -> float:
        return max(0.0, self.clock() - self.started)

    def remaining_seconds(self) -> float:
        return max(0.0, self.deadline - self.clock())

    def expired(self) -> bool:
        return self.clock() >= self.deadline

    def require(self, stage: str, reserve_seconds: float = 0.0) -> None:
        if self.clock() + float(reserve_seconds) >= self.deadline:
            raise DeadlineExceeded(f"hard wall-clock deadline reached before {stage}")

    def with_reserved_tail(self, reserve_seconds: float) -> "WallClockDeadline":
        """Return a deadline that stops work before this deadline's protected tail."""
        reserve = max(0.0, float(reserve_seconds))
        child = object.__new__(WallClockDeadline)
        child.minutes = max(0.0, (self.deadline - reserve - self.started) / 60.0)
        child.clock = self.clock
        child.started = self.started
        child.deadline = self.deadline - reserve
        return child

    def snapshot(self, stage: str) -> dict[str, Any]:
        return {"stage": stage, "elapsed_seconds": self.elapsed_seconds(), "remaining_seconds": self.remaining_seconds(), "expired": self.expired()}


class Heartbeat:
    """Minute heartbeat and five-minute compact progress files."""

    def __init__(self, root: Path, deadline: WallClockDeadline | None = None, clock: Callable[[], float] = time.monotonic):
        self.root = root
        self.deadline = deadline
        self.clock = clock
        self.last_heartbeat = float("-inf")
        self.last_summary = float("-inf")

    def update(self, stage: str, **progress: Any) -> None:
        now = self.clock()
        payload = {"schema": "greenguard-m1-quick-heartbeat-v1", "updated_at": utc_now(), "stage": stage, **progress}
        if self.deadline:
            payload.update(self.deadline.snapshot(stage))
        if now - self.last_heartbeat >= 60.0:
            atomic_write(self.root / "heartbeat.json", payload)
            self.last_heartbeat = now
        if now - self.last_summary >= 300.0:
            atomic_write(self.root / "progress_summary.json", payload)
            self.last_summary = now


def parse_yolo_label(path: Path | None) -> tuple[list[dict[str, Any]], list[str]]:
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
        if len(fields) not in (5, 9):
            errors.append(f"line_{line_no}_unsupported_field_count_{len(fields)}")
            continue
        try:
            class_id = int(fields[0])
            values = [float(value) for value in fields[1:]]
        except (ValueError, IndexError):
            errors.append(f"line_{line_no}_non_numeric")
            continue
        if any(not math.isfinite(value) for value in values):
            errors.append(f"line_{line_no}_non_finite")
            continue
        if len(values) == 4:
            cx, cy, width, height = values
        else:
            xs = values[0::2]
            ys = values[1::2]
            cx, cy = (min(xs) + max(xs)) / 2.0, (min(ys) + max(ys)) / 2.0
            width, height = max(xs) - min(xs), max(ys) - min(ys)
        if not all(0.0 <= value <= 1.0 for value in (cx, cy, width, height)) or width <= 0 or height <= 0:
            errors.append(f"line_{line_no}_out_of_bounds_or_non_positive")
            continue
        if cx - width / 2 < 0 or cx + width / 2 > 1 or cy - height / 2 < 0 or cy + height / 2 > 1:
            errors.append(f"line_{line_no}_box_crosses_image_bounds")
            continue
        records.append({"source_class_id": class_id, "bbox": [cx, cy, width, height], "field_count": len(fields)})
    return records, errors


def _timestamp(image: Path) -> tuple[int, int, int] | None:
    match = re.search(r"WIN_\d{8}_(\d{2})_(\d{2})_(\d{2})", image.name, re.IGNORECASE)
    return tuple(int(value) for value in match.groups()) if match else None


def new_data_group(image: Path) -> dict[str, str]:
    """Return the approved atomic group, split, and sampler role."""
    if image.parent.name.lower() == "true-negative":
        return {"group": "new-data:negative_1403", "split": "train", "role": "negative"}
    stamp = _timestamp(image)
    if stamp is None:
        return {"group": "new-data:unknown", "split": "quarantine", "role": "unknown"}
    hour, minute, second = stamp
    total = hour * 3600 + minute * 60 + second
    if 13 * 3600 + 58 * 60 <= total <= 13 * 3600 + 59 * 60 + 59:
        return {"group": "new-data:can_1358_1359", "split": "train", "role": "new_can"}
    if 14 * 3600 <= total <= 14 * 3600 + 60 + 30:
        return {"group": "new-data:pet_clear_1400_1401", "split": "train", "role": "new_pet"}
    if 14 * 3600 + 60 + 56 <= total <= 14 * 3600 + 2 * 60 + 30:
        return {"group": "new-data:pet_green_1401_1402", "split": "train", "role": "new_pet"}
    if 14 * 3600 + 2 * 60 + 45 <= total <= 14 * 3600 + 3 * 60 + 11:
        return {"group": "new-data:pet_white_1402_1403", "split": "holdout", "role": "new_pet_holdout"}
    return {"group": "new-data:unknown", "split": "quarantine", "role": "unknown"}


def canonical_new_class(raw_class_id: int, config: dict[str, Any]) -> int:
    mapping = {int(key): int(value) for key, value in config["new_data"]["raw_to_canonical"].items()}
    if raw_class_id not in mapping:
        raise ValueError(f"unknown New-data source class {raw_class_id}")
    return mapping[raw_class_id]


def _new_label_path(root: Path, image: Path) -> Path | None:
    candidates = [root / "labels" / "train" / f"{image.stem}.txt", root / "labels" / f"{image.stem}.txt"]
    candidates.extend(path for path in (root / "labels").rglob(f"{image.stem}.txt") if path not in candidates) if (root / "labels").is_dir() else None
    existing = sorted({path.resolve() for path in candidates if path.is_file()})
    return existing[0] if len(existing) == 1 else None


def audit_new_data(config: dict[str, Any], name: str) -> dict[str, Any]:
    root = resolve_model_path(config, "new_data_root")
    report = report_root(config, name)
    records: list[dict[str, Any]] = []
    positive_root = root / config["new_data"].get("image_directory", "Images")
    negative_root = root / config["new_data"].get("negative_directory", "true-negative")
    images = image_files(positive_root) + image_files(negative_root)
    expected_mapping = {"0": 1, "1": 0}
    for image in sorted(images):
        role_info = new_data_group(image)
        label_path = _new_label_path(root, image) if role_info["role"] != "negative" else _new_label_path(root, image)
        if role_info["role"] == "negative" and label_path is None:
            source_records, errors = [], []
        else:
            source_records, errors = parse_yolo_label(label_path)
        labels: list[dict[str, Any]] = []
        if role_info["role"] == "negative":
            if label_path and source_records:
                errors.append("negative_has_non_empty_label")
            if label_path and errors == [] and label_path.read_text(encoding="utf-8", errors="replace").strip():
                errors.append("negative_label_not_empty_or_reviewed")
        else:
            for source_record in source_records:
                try:
                    labels.append({"class_id": canonical_new_class(int(source_record["source_class_id"]), config), "bbox": source_record["bbox"], "source_class_id": int(source_record["source_class_id"])})
                except ValueError as exc:
                    errors.append(str(exc))
        image_data = cv2.imread(str(image), cv2.IMREAD_COLOR)
        if image_data is None:
            errors.append("unreadable_image")
            width = height = None
            image_hash = pixel_hash = None
        else:
            height, width = image_data.shape[:2]
            image_hash = sha256_file(image)
            pixel_hash = decoded_hash(image_data)
        if role_info["split"] == "quarantine":
            errors.append("filename_not_in_approved_capture_ranges")
        if role_info["role"] != "negative" and not labels and not errors:
            errors.append("positive_has_no_target_label")
        disposition = "eligible" if not errors and role_info["split"] != "quarantine" else "quarantine"
        relative_image = image.relative_to(REPO_ROOT).as_posix()
        records.append({
            "source": relative_image,
            "label": label_path.relative_to(REPO_ROOT).as_posix() if label_path else None,
            "source_kind": "new-data",
            "source_sha256": image_hash,
            "pixel_sha256": pixel_hash,
            "source_label_sha256": sha256_file(label_path) if label_path and label_path.is_file() else None,
            "converted_label_sha256": hashlib.sha256(json.dumps(labels, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
            "labels": labels,
            "class_ids": sorted({int(label["class_id"]) for label in labels}),
            "group": role_info["group"],
            "split": role_info["split"],
            "role": role_info["role"],
            "reviewed": disposition == "eligible",
            "review_basis": "approved New-data capture-time mapping and whole-object OBB-to-HBB conversion" if disposition == "eligible" else ";".join(errors),
            "disposition": disposition,
            "errors": errors,
            "width": width,
            "height": height,
        })
    old_manifest_path = resolve_model_path(config, "previous_manifest")
    old_hashes: set[str] = set()
    if old_manifest_path.is_file():
        try:
            old_hashes = {str(row.get("source_sha256", "")).lower() for row in json.loads(old_manifest_path.read_text(encoding="utf-8")).get("records", []) if row.get("source_sha256")}
        except (OSError, json.JSONDecodeError):
            old_hashes = set()
    for row in records:
        if row["source_sha256"] and row["source_sha256"].lower() in old_hashes:
            row["disposition"] = "quarantine"
            row["errors"].append("exact_duplicate_with_previous_frozen_manifest")
            row["reviewed"] = False
    counts = Counter(row["disposition"] for row in records)
    class_counts = Counter(CLASS_NAMES[int(label["class_id"])] for row in records if row["disposition"] == "eligible" for label in row["labels"])
    group_counts = Counter(row["group"] for row in records if row["disposition"] == "eligible")
    result = {
        "schema": "greenguard-m1-quick-audit-new-v1",
        "run_id": name,
        "created_at": utc_now(),
        "new_data_root": str(root),
        "source_class_mapping": expected_mapping,
        "image_count": len(records),
        "counts_by_disposition": dict(counts),
        "class_instance_counts": dict(class_counts),
        "group_counts": dict(group_counts),
        "records": records,
        "expected_counts": config["new_data"]["expected_counts"],
        "previous_manifest": str(old_manifest_path),
        "previous_manifest_sha256": sha256_file(old_manifest_path) if old_manifest_path.is_file() else None,
    }
    atomic_write(report / "audit_new_report.json", result)
    atomic_write(report / "audit_new_summary.json", {key: value for key, value in result.items() if key != "records"})
    return result


def _old_records(config: dict[str, Any]) -> list[dict[str, Any]]:
    path = resolve_model_path(config, "previous_manifest")
    if not path.is_file():
        raise FileNotFoundError(f"previous frozen manifest missing: {path}")
    manifest = json.loads(path.read_text(encoding="utf-8"))
    rows: list[dict[str, Any]] = []
    for row in manifest.get("records", []):
        source = resolve_repo_path(str(row.get("source", "")))
        if not source.is_file():
            continue
        labels = [{"class_id": int(label["class_id"]), "bbox": list(label["bbox"]), "source_class_id": label.get("source_class_id")} for label in row.get("labels", [])]
        rows.append({
            "source": source.relative_to(REPO_ROOT).as_posix(),
            "source_sha256": str(row.get("source_sha256") or sha256_file(source)).lower(),
            "pixel_sha256": None,
            "source_kind": "previous-frozen-manifest",
            "labels": labels,
            "class_ids": sorted({int(label["class_id"]) for label in labels}),
            "group": str(row.get("group", "unknown")),
            "split": str(row.get("split", "quarantine")),
            "role": None,
            "reviewed": True,
            "review_basis": "preserved previous frozen manifest assignment",
            "disposition": "eligible",
            "errors": [],
        })
    return rows


def _is_machine_record(row: dict[str, Any]) -> bool:
    group = str(row.get("group", ""))
    source = str(row.get("source", "")).lower()
    return group.startswith(("live-machine:", "dataset-live:", "true-negative:")) or "dataset-live" in source or "re-annotated-data" in source or "true-negative" in source


def _record_with_role(row: dict[str, Any], role: str) -> dict[str, Any]:
    clone = dict(row)
    clone["role"] = role
    clone["source_scope"] = "new" if row.get("source_kind") == "new-data" else "old"
    return clone


def build_replay_pool(config: dict[str, Any], new_report: dict[str, Any]) -> dict[str, Any]:
    old = _old_records(config)
    new = [row for row in new_report["records"] if row["disposition"] == "eligible"]
    train_new = [row for row in new if row["split"] == "train"]
    training: list[dict[str, Any]] = []
    for row in train_new:
        training.append(_record_with_role(row, row["role"]))
    old_machine = [row for row in old if row["split"] == "train" and _is_machine_record(row)]
    old_generic = [row for row in old if row["split"] == "train" and not _is_machine_record(row) and row["labels"]]
    class_totals = Counter(int(label["class_id"]) for row in old_generic for label in row["labels"])
    rarer_class = min((0, 1), key=lambda class_id: (class_totals[class_id], class_id))
    for row in old_machine:
        if row["labels"]:
            classes = set(row["class_ids"])
            class_id = min(classes, key=lambda value: (class_totals[value], value)) if classes else 0
            training.append(_record_with_role(row, "old_machine_can" if class_id == 0 else "old_machine_pet"))
        else:
            training.append(_record_with_role(row, "negative"))
    groups_by_class: dict[int, dict[str, list[dict[str, Any]]]] = {0: defaultdict(list), 1: defaultdict(list)}
    for row in old_generic:
        present = set(row["class_ids"])
        if len(present) > 1:
            present = {rarer_class}
        for class_id in present:
            groups_by_class[class_id][str(row["group"])].append(row)
    rng = random.Random(int(config["run"]["seed"]))
    max_groups = int(config["replay"].get("max_generic_groups_per_class", 1000))
    selected_generic_groups: dict[int, list[str]] = {}
    selected_generic: set[tuple[str, str]] = set()
    for class_id in (0, 1):
        keys = sorted(groups_by_class[class_id])
        rng.shuffle(keys)
        selected_generic_groups[class_id] = sorted(keys[:max_groups])
        for group in selected_generic_groups[class_id]:
            for row in groups_by_class[class_id][group]:
                selected_generic.add((row["source"], "generic_can" if class_id == 0 else "generic_pet"))
    for row in old_generic:
        for source, role in sorted(selected_generic):
            if source == row["source"]:
                training.append(_record_with_role(row, role))
                break
    # Prevent a source from being copied twice when it serves both class roles.
    unique_training: dict[str, dict[str, Any]] = {}
    for row in training:
        unique_training.setdefault(str(row["source"]), row)
    evaluation = [row for row in old if row["split"] in {"selection", "val", "holdout"}]
    evaluation.extend(_record_with_role(row, row["role"]) for row in new if row["split"] == "holdout")
    unique_eval: dict[str, dict[str, Any]] = {}
    for row in evaluation:
        unique_eval.setdefault(str(row["source"]), row)
    negative_count = sum(1 for row in unique_training.values() if not row["labels"])
    by_role = Counter(str(row.get("role")) for row in unique_training.values())
    return {
        "training": sorted(unique_training.values(), key=lambda row: str(row["source"])),
        "evaluation": sorted(unique_eval.values(), key=lambda row: (str(row.get("split")), str(row["source"]))),
        "generic_groups": {CLASS_NAMES[key]: values for key, values in selected_generic_groups.items()},
        "counts_by_role": dict(by_role),
        "training_negative_images": negative_count,
        "old_manifest_sha256": sha256_file(resolve_model_path(config, "previous_manifest")),
    }


def _write_yolo_label(path: Path, labels: list[dict[str, Any]]) -> None:
    text = "".join(f"{int(label['class_id'])} " + " ".join(f"{float(value):.8f}" for value in label["bbox"]) + "\n" for label in labels)
    path.write_text(text, encoding="utf-8", newline="\n")


def _augment_bounds(config: dict[str, Any]) -> dict[str, Any]:
    return config.get("augmentation", {})


def augmentation_mode(seed: int, config: dict[str, Any]) -> str:
    ratios = config.get("augmentation", {}).get("mode_ratios", {"original": 0.5, "dim": 0.2, "bright": 0.2, "optics": 0.1})
    value = random.Random(int(seed)).random()
    cursor = 0.0
    for mode in ("original", "dim", "bright", "optics"):
        cursor += float(ratios.get(mode, 0.0))
        if value < cursor:
            return mode
    return "optics"


def machine_augment(image: np.ndarray, mode: str, seed: int, config: dict[str, Any], boxes: list[list[float]] | None = None) -> np.ndarray:
    """Apply bounded train-only machine appearance augmentation.

    Geometry is intentionally left to Ultralytics' bounded native transform;
    this function is photometric and therefore cannot invalidate HBB labels.
    """
    if mode == "original":
        return image.copy()
    rng = np.random.default_rng(int(seed))
    result = image.astype(np.float32)
    bounds = _augment_bounds(config)
    if mode == "dim":
        exposure = rng.uniform(*bounds.get("dim", {}).get("exposure", [0.65, 0.90]))
        gamma = rng.uniform(*bounds.get("dim", {}).get("gamma", [1.05, 1.30]))
        result = np.power(np.clip(result * exposure / 255.0, 0.0, 1.0), gamma) * 255.0
        noise = rng.uniform(*bounds.get("dim", {}).get("noise_std", [0.0, 4.0]))
        result += rng.normal(0.0, noise, result.shape)
    elif mode == "bright":
        exposure = rng.uniform(*bounds.get("bright", {}).get("exposure", [1.10, 1.35]))
        gamma = rng.uniform(*bounds.get("bright", {}).get("gamma", [0.80, 0.98]))
        result = np.power(np.clip(result * exposure / 255.0, 0.0, 1.0), gamma) * 255.0
        height, width = result.shape[:2]
        glare = np.zeros((height, width), dtype=np.float32)
        center = (int(rng.uniform(width * 0.15, width * 0.85)), int(rng.uniform(height * 0.10, height * 0.50)))
        radius = max(4, int(min(height, width) * 0.08))
        cv2.circle(glare, center, radius, 35.0, -1)
        glare = cv2.GaussianBlur(glare, (0, 0), max(2.0, radius / 2.0))
        result += glare[:, :, None]
    else:
        gains = rng.uniform(*bounds.get("optics", {}).get("white_balance_gain", [0.90, 1.10]), 3).astype(np.float32)
        result = np.clip((result - 128.0) * float(rng.uniform(0.95, 1.05)) + 128.0, 0, 255)
        result *= gains[None, None, :]
        result += rng.normal(0.0, rng.uniform(*bounds.get("optics", {}).get("noise_std", [0.0, 6.0])), result.shape)
        result = cv2.GaussianBlur(result, (3, 3), 0)
        quality = int(rng.uniform(*bounds.get("optics", {}).get("jpeg_quality", [70, 95])))
        ok, encoded = cv2.imencode(".jpg", np.clip(result, 0, 255).astype(np.uint8), [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if ok:
            decoded = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
            if decoded is not None and decoded.shape == image.shape:
                result = decoded.astype(np.float32)
    return np.clip(result, 0, 255).astype(np.uint8)


class MachineReplaySampler:
    """Deterministic 768-draw replay sampler with role/group/image caps."""

    def __init__(self, records: list[dict[str, Any]], config: dict[str, Any], seed: int | None = None, trace_path: Path | None = None):
        self.records = list(records)
        self.config = config
        self.seed = int(config["run"]["seed"] if seed is None else seed)
        self.quotas = {role: int(config["replay"]["quotas"].get(role, 0)) for role in ROLE_QUOTAS}
        self.trace_path = trace_path
        self.epoch = 0
        self.by_role: dict[str, list[int]] = {role: [index for index, row in enumerate(self.records) if row.get("role") == role] for role in ROLE_QUOTAS}

    def __len__(self) -> int:
        return sum(self.quotas.values())

    def _image_cap(self, role: str, count: int) -> int:
        if role == "new_can":
            return int(self.config["replay"].get("max_new_can_draws_per_image", 8))
        if role == "negative":
            return int(self.config["replay"].get("max_negative_draws_per_image", 8))
        if role == "new_pet":
            # The two approved PET groups are uneven (13 and 8 images). One
            # extra draw above the even-pool average is required for the
            # smaller group to supply its atomic half of the 96-draw quota.
            return max(1, math.ceil(self.quotas[role] / max(count, 1)) + 1)
        return max(1, math.ceil(self.quotas[role] / max(count, 1)))

    def _group_cap(self, role: str, count: int) -> int:
        pool = self.by_role[role]
        groups = {str(self.records[index].get("group", index)) for index in pool}
        natural = max(1, math.ceil(self.quotas[role] / max(len(groups), 1)))
        if role.startswith("old_machine"):
            natural *= int(self.config["replay"].get("max_machine_group_multiplier", 3))
        return max(natural, math.ceil(self.quotas[role] / max(count, 1)))

    def draw_epoch(self, epoch: int | None = None) -> list[int]:
        epoch_number = self.epoch if epoch is None else int(epoch)
        rng = random.Random(self.seed + epoch_number * 1_000_003)
        result: list[int] = []
        trace: list[dict[str, Any]] = []
        for role in ROLE_QUOTAS:
            quota = self.quotas[role]
            pool = self.by_role[role]
            if quota == 0:
                continue
            if not pool:
                raise RuntimeError(f"replay role {role} cannot supply its {quota} quota")
            image_cap = self._image_cap(role, len(pool))
            group_cap = self._group_cap(role, len(pool))
            image_uses: Counter[int] = Counter()
            group_uses: Counter[str] = Counter()
            ordered = sorted(pool, key=lambda index: (str(self.records[index].get("group", "")), str(self.records[index].get("source", "")), index))
            if ordered:
                offset = (epoch_number + ROLE_QUOTAS.index(role)) % len(ordered)
                ordered = ordered[offset:] + ordered[:offset]
            group_order = []
            for index in ordered:
                group = str(self.records[index].get("group", index))
                if group not in group_order:
                    group_order.append(group)
            coverage_target = min(quota, len(group_order))
            for group in group_order:
                if len([row for row in trace if row["role"] == role]) >= coverage_target:
                    break
                candidates = [index for index in ordered if str(self.records[index].get("group", index)) == group and image_uses[index] < image_cap and group_uses[group] < group_cap]
                if not candidates:
                    continue
                selected = candidates[(epoch_number + ROLE_QUOTAS.index(role)) % len(candidates)]
                result.append(selected)
                image_uses[selected] += 1
                group_uses[group] += 1
                trace.append({"draw": len(result) - 1, "role": role, "record": selected, "source": self.records[selected].get("source"), "group": group})
            if len([row for row in trace if row["role"] == role]) < coverage_target:
                raise RuntimeError(f"replay group coverage exhausted for role {role}")
            for draw_number in range(len([row for row in trace if row["role"] == role]), quota):
                candidates = [index for index in ordered if image_uses[index] < image_cap and group_uses[str(self.records[index].get("group", index))] < group_cap]
                if not candidates:
                    raise RuntimeError(f"replay caps exhausted for role {role} at draw {draw_number}/{quota}")
                selected = candidates[rng.randrange(len(candidates))]
                result.append(selected)
                group = str(self.records[selected].get("group", selected))
                image_uses[selected] += 1
                group_uses[group] += 1
                trace.append({"draw": len(result) - 1, "role": role, "record": selected, "source": self.records[selected].get("source"), "group": group})
        rng.shuffle(result)
        trace.sort(key=lambda row: result.index(row["record"]) if row["record"] in result else row["draw"])
        if self.trace_path:
            self.trace_path.parent.mkdir(parents=True, exist_ok=True)
            with self.trace_path.open("a", encoding="utf-8", newline="\n") as handle:
                handle.write(json.dumps({"epoch": epoch_number, "draws": trace}, sort_keys=True) + "\n")
        return result

    def __iter__(self) -> Iterator[int]:
        value = self.draw_epoch(self.epoch)
        self.epoch += 1
        return iter(value)


def _write_previews(config: dict[str, Any], name: str, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    preview_root = report_root(config, name) / "augmentation_previews"
    previews: list[dict[str, Any]] = []
    modes = ("original", "dim", "bright", "optics")
    candidates = [row for row in records if row.get("labels") or row.get("role") == "negative"]
    for index, row in enumerate(candidates[:12]):
        image = cv2.imread(str(resolve_repo_path(row["source"])), cv2.IMREAD_COLOR)
        if image is None:
            continue
        mode = modes[index % len(modes)]
        output = preview_root / f"{index:02d}_{mode}.jpg"
        output.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(output), machine_augment(image, mode, int(config["run"]["seed"]) + index * 1009, config))
        previews.append({"source": row["source"], "role": row.get("role"), "mode": mode, "seed": int(config["run"]["seed"]) + index * 1009, "path": str(output)})
    return previews


def prepare_replay(config: dict[str, Any], name: str) -> dict[str, Any]:
    audit_path = report_root(config, name) / "audit_new_report.json"
    if not audit_path.is_file():
        raise FileNotFoundError("audit-new must complete before prepare-replay")
    output = generated_root(config, name)
    if output.exists():
        raise RuntimeError(f"refusing to overwrite quick-fine-tune dataset: {output}")
    new_report = json.loads(audit_path.read_text(encoding="utf-8"))
    pool = build_replay_pool(config, new_report)
    provenance_rows = [{**row, "partition": "train"} for row in pool["training"]]
    provenance_rows.extend({**row, "partition": "selection" if row.get("split") == "selection" else "calibration" if row.get("split") == "val" else "holdout"} for row in pool["evaluation"])
    leakage = validate_no_split_leakage(provenance_rows)
    if leakage:
        raise RuntimeError(f"frozen replay has split leakage: {leakage[:10]}")
    output.mkdir(parents=True)
    manifest_records: list[dict[str, Any]] = []
    split_lists: dict[str, list[str]] = {"train": [], "selection": [], "calibration": [], "holdout": []}
    all_rows = [(row, "train") for row in pool["training"]]
    all_rows.extend((row, "selection" if row.get("split") == "selection" else "calibration" if row.get("split") == "val" else "holdout") for row in pool["evaluation"])
    seen_sources: set[str] = set()
    for index, (row, partition) in enumerate(sorted(all_rows, key=lambda pair: (pair[1], str(pair[0]["source"]))), 1):
        source = resolve_repo_path(row["source"])
        source_key = f"{partition}:{row['source']}"
        if source_key in seen_sources:
            continue
        if not source.is_file():
            raise FileNotFoundError(source)
        image = cv2.imread(str(source), cv2.IMREAD_COLOR)
        if image is None:
            raise RuntimeError(f"unable to decode {source}")
        seen_sources.add(source_key)
        stem = f"{index:06d}_{source.stem}"
        image_out = output / "images" / partition / f"{stem}.jpg"
        label_out = output / "labels" / partition / f"{stem}.txt"
        image_out.parent.mkdir(parents=True, exist_ok=True)
        label_out.parent.mkdir(parents=True, exist_ok=True)
        if not cv2.imwrite(str(image_out), image, [int(cv2.IMWRITE_JPEG_QUALITY), 95]):
            raise RuntimeError(f"unable to write prepared image {image_out}")
        _write_yolo_label(label_out, row.get("labels", []))
        generated_image = image_out.relative_to(REPO_ROOT).as_posix()
        generated_label = label_out.relative_to(REPO_ROOT).as_posix()
        manifest_row = {
            "source": row["source"],
            "source_sha256": row.get("source_sha256"),
            "source_kind": row.get("source_kind"),
            "generated_image": generated_image,
            "generated_label": generated_label,
            "partition": partition,
            "split": row.get("split"),
            "group": row.get("group"),
            "role": row.get("role"),
            "source_scope": row.get("source_scope", "old"),
            "labels": row.get("labels", []),
            "class_ids": row.get("class_ids", []),
            "review_basis": row.get("review_basis"),
        }
        manifest_records.append(manifest_row)
        split_lists[partition].append(generated_image)
    data_yaml = {"path": str(output.resolve()), "train": "images/train", "val": "images/selection", "test": "images/holdout", "names": {0: "metal_can", 1: "pet_bottle"}}
    atomic_write(output / "dataset.yaml", yaml.safe_dump(data_yaml, sort_keys=False))
    train_rows = [row for row in manifest_records if row["partition"] == "train"]
    previews = _write_previews(config, name, train_rows)
    quotas = {role: int(config["replay"]["quotas"].get(role, 0)) for role in ROLE_QUOTAS}
    manifest = {
        "schema": "greenguard-m1-machine-quick-dataset-v1",
        "run_id": name,
        "created_at": utc_now(),
        "classes": CLASS_NAMES,
        "records": manifest_records,
        "train_images": split_lists["train"],
        "selection_images": split_lists["selection"],
        "calibration_images": split_lists["calibration"],
        "holdout_images": split_lists["holdout"],
        "split_counts": {key: len(value) for key, value in split_lists.items()},
        "class_instance_counts": dict(Counter(CLASS_NAMES[int(label["class_id"])] for row in manifest_records for label in row["labels"])),
        "replay": {"quotas": quotas, "epoch_presentations": sum(quotas.values()), "pool_counts": pool["counts_by_role"], "generic_groups": pool["generic_groups"], "old_manifest_sha256": pool["old_manifest_sha256"], "trace": str(report_root(config, name) / "sampler_draws.jsonl")},
        "augmentation": config["augmentation"],
        "augmentation_previews": previews,
        "source_checkpoint": str(resolve_model_path(config, "source_checkpoint")),
        "source_checkpoint_sha256": config["sources"]["source_checkpoint_sha256"],
        "config_sha256": sha256_file(Path(config["_config_path"])),
        "split_leakage_policy": "connected source/group/session identities remain in one partition",
    }
    atomic_write(output / "manifest.json", manifest)
    result = {"schema": "greenguard-m1-quick-prepare-v1", "run_id": name, "status": "READY", "generated_root": str(output), "manifest": str(output / "manifest.json"), "train_records": len(train_rows), "split_counts": manifest["split_counts"], "class_instance_counts": manifest["class_instance_counts"], "replay": manifest["replay"], "preview_count": len(previews)}
    atomic_write(report_root(config, name) / "prepare_replay_report.json", result)
    return result


def validate_no_split_leakage(records: Iterable[dict[str, Any]]) -> list[str]:
    by_group: dict[str, set[str]] = defaultdict(set)
    by_hash: dict[str, set[str]] = defaultdict(set)
    for row in records:
        partition = str(row.get("partition", row.get("split", "")))
        if row.get("group"):
            by_group[str(row["group"])].add(partition)
        if row.get("source_sha256"):
            by_hash[str(row["source_sha256"]).lower()].add(partition)
    violations = [f"group:{key}" for key, values in by_group.items() if len(values) > 1]
    violations.extend(f"hash:{key}" for key, values in by_hash.items() if len(values) > 1)
    return sorted(violations)


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


def stage_preflight(config: dict[str, Any], name: str) -> dict[str, Any]:
    root = report_root(config, name)
    checkpoint = resolve_model_path(config, "source_checkpoint")
    previous = resolve_model_path(config, "previous_manifest")
    active_m1 = resolve_model_path(config, "active_model")
    active_pc_m2 = resolve_model_path(config, "active_pc_m2")
    active_jetson_m2 = resolve_model_path(config, "active_jetson_m2")
    result = {
        "schema": "greenguard-m1-quick-preflight-v1",
        "run_id": name,
        "status": "READY",
        "created_at": utc_now(),
        "starting_git_commit": git_head(),
        "environment": environment(),
        "source_checkpoint": str(checkpoint),
        "source_checkpoint_exists": checkpoint.is_file(),
        "source_checkpoint_sha256": sha256_file(checkpoint) if checkpoint.is_file() else None,
        "expected_source_checkpoint_sha256": str(config["sources"]["source_checkpoint_sha256"]).lower(),
        "previous_manifest": str(previous),
        "previous_manifest_sha256": sha256_file(previous) if previous.is_file() else None,
        "active_hashes": {"m1": sha256_file(active_m1) if active_m1.is_file() else None, "pc_m2": sha256_file(active_pc_m2) if active_pc_m2.is_file() else None, "jetson_m2": sha256_file(active_jetson_m2) if active_jetson_m2.is_file() else None},
        "config_sha256": sha256_file(Path(config["_config_path"])),
        "resume": False,
        "training_processes_started": False,
    }
    failures = []
    if not checkpoint.is_file():
        failures.append("source_checkpoint_missing")
    elif result["source_checkpoint_sha256"] != result["expected_source_checkpoint_sha256"]:
        failures.append("source_checkpoint_hash_mismatch")
    if not previous.is_file():
        failures.append("previous_frozen_manifest_missing")
    if not active_pc_m2.is_file() or not active_jetson_m2.is_file():
        failures.append("protected_model2_missing")
    if failures:
        result["status"] = "FAILED"
        result["failures"] = failures
    atomic_write(root / "preflight_report.json", result)
    return result


def stage_baseline(config: dict[str, Any], name: str) -> dict[str, Any]:
    preflight_path = report_root(config, name) / "preflight_report.json"
    if not preflight_path.is_file():
        raise FileNotFoundError("preflight must complete before baseline")
    active = resolve_model_path(config, "active_model")
    result = {"schema": "greenguard-m1-quick-baseline-v1", "run_id": name, "status": "READY" if active.is_file() else "NOT_MEASURED", "active_model": str(active), "active_sha256": sha256_file(active) if active.is_file() else None, "note": "Baseline inference is evaluated later on the same frozen records; no holdout is used for training."}
    atomic_write(report_root(config, name) / "baseline_report.json", result)
    return result


def train_args(config: dict[str, Any], *, weights: Path, data: Path, project: Path, run_name_value: str, phase: str, batch: int, epochs: int, patience: int, smoke: bool = False) -> dict[str, Any]:
    phase_config = config["training"].get("phase_a" if phase == "freeze-head" else "phase_b", {})
    args = {
        "data": str(data),
        "task": "detect",
        "imgsz": int(config["training"].get("image_size", config["run"]["image_size"])),
        "epochs": int(epochs),
        "patience": int(patience),
        "batch": int(batch),
        "workers": int(config["training"]["workers"]),
        "cache": config["training"]["cache"],
        "optimizer": config["training"]["optimizer"],
        "lr0": float(0.001 if smoke else phase_config["lr0"]),
        "lrf": float(0.01 if smoke else phase_config["lrf"]),
        "weight_decay": float(config["training"]["weight_decay"]),
        "warmup_epochs": float(0.0 if smoke else config["training"]["warmup_epochs"]),
        "amp": bool(False if smoke else phase_config["amp"]),
        "device": 0,
        "project": str(project),
        "name": run_name_value,
        "exist_ok": False,
        # Keep the explicitly loaded checkpoint weights while starting a fresh
        # optimizer/epoch state. In Ultralytics 8.4, pretrained=False here
        # discards YOLO(weights) and silently rebuilds a random-initialized model.
        "pretrained": True,
        "resume": False,
        "deterministic": bool(config["training"]["deterministic"]),
        "mosaic": 0.0,
        "mixup": 0.0,
        "copy_paste": 0.0,
        "fliplr": 0.0,
        "flipud": 0.0,
        "multi_scale": 0.0,
        "degrees": 0.0 if smoke else 3.0,
        "translate": 0.0 if smoke else 0.02,
        "scale": 0.0 if smoke else 0.04,
        "shear": 0.0,
        "perspective": 0.0,
        "hsv_h": 0.0,
        "hsv_s": 0.0,
        "hsv_v": 0.0,
        "plots": True,
        "verbose": True,
    }
    freeze = 0 if smoke else int(phase_config.get("freeze", 0))
    if freeze:
        args["freeze"] = freeze
    return args


def _install_quick_augmentation(config: dict[str, Any]) -> None:
    from ultralytics.data.dataset import YOLODataset

    if getattr(YOLODataset, "_greenguard_quick_aug_installed", False):
        return
    original = YOLODataset.build_transforms

    class QuickTransform:
        def __init__(self) -> None:
            self.calls = 0

        def __call__(self, labels: dict[str, Any]) -> dict[str, Any]:
            image = labels.get("img")
            if isinstance(image, np.ndarray) and image.ndim == 3:
                draw = self.calls
                self.calls += 1
                mode = augmentation_mode(int(config["augmentation"]["seed"]) + draw * 1009, config)
                labels["img"] = machine_augment(image, mode, int(config["augmentation"]["seed"]) + draw * 1009, config)
                labels["m1_quick_augmentation"] = {"mode": mode, "seed": int(config["augmentation"]["seed"]) + draw * 1009}
            return labels

    def build_transforms(dataset: Any, hyp: Any = None):
        transforms = original(dataset, hyp)
        if dataset.augment:
            transforms.transforms.insert(-1, QuickTransform())
        return transforms

    YOLODataset.build_transforms = build_transforms
    YOLODataset._greenguard_quick_aug_installed = True


def _install_quick_sampler(config: dict[str, Any], manifest_path: Path, trace_path: Path) -> None:
    import torch
    from ultralytics.data.build import InfiniteDataLoader
    from ultralytics.models.yolo.detect import train as detect_train

    if getattr(detect_train, "_greenguard_quick_sampler_installed", False):
        return
    original = detect_train.build_dataloader
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows = [row for row in manifest["records"] if row.get("partition") == "train"]
    state = {"epoch": 0}

    def build_dataloader(dataset: Any, batch: int, workers: int, *args: Any, **kwargs: Any):
        if bool(getattr(dataset, "augment", False)) and bool(kwargs.get("shuffle", True)):
            sampler = MachineReplaySampler(rows, config, trace_path=trace_path)
            sampler.epoch = state["epoch"]
            state["epoch"] += 1
            generator = torch.Generator()
            generator.manual_seed(int(config["run"]["seed"]))
            return InfiniteDataLoader(
                dataset=dataset,
                batch_size=min(int(batch), len(sampler)),
                sampler=sampler,
                shuffle=False,
                num_workers=0,
                drop_last=bool(kwargs.get("drop_last", False)),
                pin_memory=bool(torch.cuda.is_available()),
                collate_fn=getattr(dataset, "collate_fn", None),
                generator=generator,
            )
        return original(dataset, batch=batch, workers=workers, *args, **kwargs)

    detect_train.build_dataloader = build_dataloader
    detect_train._greenguard_quick_sampler_installed = True


def _train_child(config: dict[str, Any], name: str, phase: str, weights: Path, data: Path, batch: int, epochs: int, patience: int, smoke: bool = False) -> int:
    from ultralytics import YOLO

    manifest_path = generated_root(config, name) / "manifest.json"
    if not smoke:
        _install_quick_augmentation(config)
        _install_quick_sampler(config, manifest_path, report_root(config, name) / "sampler_draws.jsonl")
    run_name_value = f"{name}_{'smoke' if smoke else 'phase_a' if phase == 'freeze-head' else 'phase_b'}_batch{batch}"
    args = train_args(config, weights=weights, data=data, project=MODEL_ROOT / config["run"]["runs_root"], run_name_value=run_name_value, phase=phase, batch=batch, epochs=epochs, patience=patience, smoke=smoke)
    model = YOLO(str(weights), task="detect")
    model.train(**args)
    return 0


def _best_checkpoint(config: dict[str, Any], name: str, phase: str, batch: int, smoke: bool = False) -> Path | None:
    suffix = "smoke" if smoke else "phase_a" if phase == "freeze-head" else "phase_b"
    path = MODEL_ROOT / config["run"]["runs_root"] / f"{name}_{suffix}_batch{batch}" / "weights" / "best.pt"
    return path if path.is_file() else None


def run_training_process(config: dict[str, Any], name: str, phase: str, weights: Path, data: Path, deadline: WallClockDeadline, *, smoke: bool = False) -> dict[str, Any]:
    requested_epochs = int(config["training"]["smoke_epochs"] if smoke else config["training"]["phase_a"]["epochs"] if phase == "freeze-head" else config["training"]["phase_b"]["epochs"])
    patience = int(1 if smoke else config["training"]["phase_a"]["patience"] if phase == "freeze-head" else config["training"]["phase_b"]["patience"])
    log_root = report_root(config, name)
    log_root.mkdir(parents=True, exist_ok=True)
    heartbeat = Heartbeat(log_root, deadline)
    attempts: list[dict[str, Any]] = []
    for batch in [int(value) for value in config["training"]["batches"]]:
        if deadline.expired():
            break
        stdout_path = log_root / f"{phase.replace('-', '_')}_batch{batch}.stdout.log"
        stderr_path = log_root / f"{phase.replace('-', '_')}_batch{batch}.stderr.log"
        command = [sys.executable, str(Path(__file__).resolve()), "__train-child", "--config", str(Path(config["_config_path"])), "--run-id", name, "--phase", phase, "--weights", str(weights), "--data", str(data), "--batch", str(batch), "--epochs", str(requested_epochs), "--patience", str(patience)]
        if smoke:
            command.append("--smoke")
        started = time.monotonic()
        with stdout_path.open("w", encoding="utf-8", newline="\n") as stdout, stderr_path.open("w", encoding="utf-8", newline="\n") as stderr:
            process = subprocess.Popen(command, cwd=REPO_ROOT, stdout=stdout, stderr=stderr)
            while process.poll() is None:
                heartbeat.update(phase, pid=process.pid, batch=batch, requested_epochs=requested_epochs, checkpoint_time=None)
                if deadline.expired():
                    process.terminate()
                    try:
                        process.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=15)
                    attempts.append({"batch": batch, "returncode": "deadline", "elapsed_seconds": time.monotonic() - started})
                    checkpoint = _best_checkpoint(config, name, phase, batch, smoke)
                    return {"status": "TIME_BUDGET_EXPIRED_WITH_VALID_CHECKPOINT" if checkpoint else "TIME_BUDGET_EXPIRED", "phase": phase, "batch": batch, "checkpoint": str(checkpoint) if checkpoint else None, "attempts": attempts}
                time.sleep(min(10.0, max(0.5, deadline.remaining_seconds())))
            return_code = process.returncode
        attempts.append({"batch": batch, "returncode": return_code, "elapsed_seconds": time.monotonic() - started})
        checkpoint = _best_checkpoint(config, name, phase, batch, smoke)
        if return_code == 0 and checkpoint:
            return {"status": "COMPLETED", "phase": phase, "batch": batch, "completed_epochs": requested_epochs, "checkpoint": str(checkpoint), "checkpoint_sha256": sha256_file(checkpoint), "attempts": attempts}
        stderr_text = stderr_path.read_text(encoding="utf-8", errors="replace") if stderr_path.is_file() else ""
        if "out of memory" not in stderr_text.lower() and "cuda" not in stderr_text.lower():
            break
    return {"status": "FAILED", "phase": phase, "attempts": attempts, "reason": "training child failed or did not create best.pt"}


def _smoke_data(config: dict[str, Any], name: str) -> Path:
    manifest = json.loads((generated_root(config, name) / "manifest.json").read_text(encoding="utf-8"))
    rows = [row for row in manifest["records"] if row.get("partition") == "train"]
    by_class: dict[int, list[str]] = {0: [], 1: []}
    negatives: list[str] = []
    for row in rows:
        path = str((REPO_ROOT / row["generated_image"]).resolve())
        if not row["labels"]:
            negatives.append(path)
        for class_id in row.get("class_ids", []):
            by_class[int(class_id)].append(path)
    chosen = by_class[0][:64] + by_class[1][:64] + negatives[: max(0, int(config["training"]["smoke_images"]) - 128)]
    if len(chosen) < min(128, int(config["training"]["smoke_images"])):
        raise RuntimeError("smoke subset cannot provide the requested balanced images")
    root = report_root(config, name)
    train_list = root / "smoke_train.txt"
    atomic_write(train_list, "\n".join(chosen) + "\n")
    selection = generated_root(config, name) / "images" / "selection"
    if not selection.is_dir():
        raise RuntimeError("smoke validation partition is missing")
    data = root / "smoke_dataset.yaml"
    atomic_write(
        data,
        yaml.safe_dump(
            {
                "path": str(generated_root(config, name).resolve()),
                "train": str(train_list.resolve()),
                "val": str(selection.resolve()),
                "names": {0: "metal_can", 1: "pet_bottle"},
            },
            sort_keys=False,
        ),
    )
    return data


def stage_smoke(config: dict[str, Any], name: str, deadline: WallClockDeadline) -> dict[str, Any]:
    deadline.require("smoke")
    data = _smoke_data(config, name)
    checkpoint = resolve_model_path(config, "source_checkpoint")
    result = run_training_process(config, name, "smoke", checkpoint, data, deadline, smoke=True)
    result.update({"schema": "greenguard-m1-quick-smoke-v1", "run_id": name, "data": str(data), "resume": False})
    atomic_write(report_root(config, name) / "smoke_report.json", result)
    return result


def _phase_checkpoint(config: dict[str, Any], name: str, phase: str) -> Path:
    report_name = "freeze_head_report.json" if phase == "freeze-head" else "full_finetune_report.json"
    path = report_root(config, name) / report_name
    if not path.is_file():
        raise FileNotFoundError(f"{report_name} missing")
    row = json.loads(path.read_text(encoding="utf-8"))
    checkpoint = Path(str(row.get("checkpoint", "")))
    if not checkpoint.is_file():
        raise FileNotFoundError(f"checkpoint missing: {checkpoint}")
    return checkpoint


def stage_freeze_head(config: dict[str, Any], name: str, deadline: WallClockDeadline) -> dict[str, Any]:
    deadline.require("freeze-head")
    data = generated_root(config, name) / "dataset.yaml"
    result = run_training_process(config, name, "freeze-head", resolve_model_path(config, "source_checkpoint"), data, deadline)
    result.update({"schema": "greenguard-m1-quick-freeze-head-v1", "run_id": name, "resume": False, "freeze_modules": int(config["training"]["phase_a"]["freeze"])})
    atomic_write(report_root(config, name) / "freeze_head_report.json", result)
    return result


def stage_full_finetune(config: dict[str, Any], name: str, deadline: WallClockDeadline) -> dict[str, Any]:
    deadline.require("full-finetune")
    data = generated_root(config, name) / "dataset.yaml"
    phase_a = _phase_checkpoint(config, name, "freeze-head")
    result = run_training_process(config, name, "full-finetune", phase_a, data, deadline)
    result.update({"schema": "greenguard-m1-quick-full-finetune-v1", "run_id": name, "resume": False, "initialized_from": str(phase_a), "initialized_from_sha256": sha256_file(phase_a) if phase_a.is_file() else None})
    atomic_write(report_root(config, name) / "full_finetune_report.json", result)
    return result


def _candidate_checkpoint(config: dict[str, Any], name: str) -> Path:
    return _phase_checkpoint(config, name, "full-finetune")


def _legacy() -> Any:
    scripts = str(MODEL_ROOT / "scripts")
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    import m1_rebuild
    return m1_rebuild


def _manifest_records(config: dict[str, Any], name: str, partition: str) -> list[dict[str, Any]]:
    manifest_path = generated_root(config, name) / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    return [row for row in manifest["records"] if row.get("partition") == partition]


def collect_predictions(config: dict[str, Any], model_path: Path, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    legacy = _legacy()
    from ultralytics import YOLO

    model = YOLO(str(model_path), task="detect")
    device: int | str = "cpu"
    if model_path.suffix.lower() != ".onnx":
        try:
            import torch
            device = 0 if torch.cuda.is_available() else "cpu"
        except Exception:
            device = "cpu"
    collected: list[dict[str, Any]] = []
    for index, item in enumerate(records):
        image = legacy.record_image(item)
        if image is None:
            continue
        height, width = image.shape[:2]
        result = model.predict(image, imgsz=640, conf=0.001, device=device, verbose=False)[0]
        predictions = []
        if result.boxes is not None:
            for box, score, class_id in zip(result.boxes.xyxy.cpu().numpy(), result.boxes.conf.cpu().numpy(), result.boxes.cls.cpu().numpy().astype(int)):
                if int(class_id) in CLASS_NAMES:
                    predictions.append({"class_id": int(class_id), "confidence": float(score), "box": [float(value) for value in box]})
        collected.append({"generated_image": item["generated_image"], "source": item.get("source"), "source_name": item.get("source_name"), "split": item.get("split"), "negative": not bool(item.get("labels")), "width": width, "height": height, "truths": legacy.truth_boxes(item, width, height), "predictions": predictions, "transform_seed": int(config["run"]["seed"]) + index * 19})
    metadata = {str(row.get("source")): row for row in records}
    for item in collected:
        source = metadata.get(str(item.get("source")), {})
        item["group"] = source.get("group")
        item["role"] = source.get("role")
        item["source_scope"] = source.get("source_scope")
        item["partition"] = source.get("partition")
    return collected


def _threshold_grid(config: dict[str, Any]) -> list[float]:
    evaluation = config["evaluation"]
    count = int(round((float(evaluation["calibration_max"]) - float(evaluation["calibration_min"])) / float(evaluation["calibration_step"])))
    return [round(float(evaluation["calibration_min"]) + index * float(evaluation["calibration_step"],), 2) for index in range(count + 1)]


def calibrate_class_thresholds(config: dict[str, Any], collected: list[dict[str, Any]]) -> tuple[dict[str, float], dict[str, Any]]:
    legacy = _legacy()
    grid = _threshold_grid(config)
    thresholds: dict[str, float] = {}
    details: dict[str, Any] = {}

    def precision_recall(class_id: int, threshold: float) -> dict[str, Any]:
        tp = fp = fn = 0
        for item in collected:
            truths = [truth for truth in item["truths"] if int(truth["class_id"]) == class_id]
            predictions = [
                prediction for prediction in item["predictions"]
                if int(prediction["class_id"]) == class_id
                and float(prediction["confidence"]) >= threshold
                and legacy._area_fraction(prediction["box"], item["width"], item["height"]) >= float(config["evaluation"]["min_area_frac"])
            ]
            used: set[int] = set()
            for prediction in sorted(predictions, key=lambda row: float(row["confidence"]), reverse=True):
                matches = [(index, legacy.xyxy_iou(prediction["box"], truth["box"])) for index, truth in enumerate(truths) if index not in used]
                match = max(matches, key=lambda row: row[1], default=(-1, 0.0))
                if match[1] >= float(config["evaluation"]["iou"]):
                    used.add(match[0])
                    tp += 1
                else:
                    fp += 1
            fn += len(truths) - len(used)
        return {"tp": tp, "fp": fp, "fn": fn, "precision": tp / max(tp + fp, 1), "recall": tp / max(tp + fn, 1)}

    for class_id, class_name in CLASS_NAMES.items():
        rows: list[tuple[float, dict[str, Any]]] = []
        for threshold in grid:
            metrics = precision_recall(class_id, threshold)
            rows.append((threshold, metrics))
        passing = [row for row in rows if row[1]["precision"] >= float(config["evaluation"]["minimum_precision"])]
        if passing:
            selected = max(passing, key=lambda row: (row[1]["recall"], row[1]["precision"], -row[0]))
            decision = "MAX_RECALL_WITH_PRECISION_FLOOR"
        else:
            selected = max(rows, key=lambda row: (row[1]["precision"], row[1]["recall"], -row[0]))
            decision = "FALLBACK_HIGHEST_PRECISION_NO_THRESHOLD_MET_FLOOR"
        thresholds[class_name] = float(selected[0])
        details[class_name] = {"threshold": selected[0], "decision": decision, "metrics": selected[1], "grid": [{"threshold": value, **metric} for value, metric in rows]}
    return thresholds, details


def stage_calibrate(config: dict[str, Any], name: str) -> dict[str, Any]:
    checkpoint = _candidate_checkpoint(config, name)
    records = _manifest_records(config, name, "calibration")
    if not records:
        result = {"schema": "greenguard-m1-quick-calibration-v1", "run_id": name, "status": "NOT_MEASURED", "reason": "calibration partition is empty"}
    else:
        collected = collect_predictions(config, checkpoint, records)
        thresholds, details = calibrate_class_thresholds(config, collected)
        result = {"schema": "greenguard-m1-quick-calibration-v1", "run_id": name, "status": "MEASURED", "checkpoint": str(checkpoint), "thresholds": thresholds, "classes": details, "calibration_images": len(records), "holdout_used": False}
    atomic_write(report_root(config, name) / "calibration_report.json", result)
    return result


def _workflow_vote(class_ids: list[int | None], quorum: int = 4, window: int = 7) -> dict[str, Any]:
    observations = list(class_ids[:window])
    counts = Counter(value for value in observations if value in CLASS_NAMES)
    result = None
    if len(observations) == window:
        winners = [class_id for class_id, count in counts.items() if count >= quorum]
        if len(winners) == 1:
            result = CLASS_NAMES[winners[0]]
    return {"observations": len(observations), "counts": dict(counts), "result": result, "early_result": any(sum(value == class_id for value in observations[:index]) >= quorum for class_id in CLASS_NAMES for index in range(4, min(window, len(observations) + 1)))}


def stage_evaluate(config: dict[str, Any], name: str) -> dict[str, Any]:
    legacy = _legacy()
    checkpoint = _candidate_checkpoint(config, name)
    calibration_path = report_root(config, name) / "calibration_report.json"
    calibration = json.loads(calibration_path.read_text(encoding="utf-8")) if calibration_path.is_file() else {}
    thresholds = calibration.get("thresholds", {name: 0.65 for name in CLASS_NAMES.values()})
    holdout = _manifest_records(config, name, "holdout")
    selection = _manifest_records(config, name, "selection")
    train = _manifest_records(config, name, "train")
    old_holdout = [row for row in holdout if row.get("source_scope") != "new"]
    new_all = [row for row in [*train, *holdout] if row.get("source_scope") == "new"]
    new_holdout = [row for row in holdout if row.get("source_scope") == "new"]
    candidate_rows = collect_predictions(config, checkpoint, old_holdout) if old_holdout else []
    new_predictions = collect_predictions(config, checkpoint, new_all) if new_all else []
    baseline_path = resolve_model_path(config, "active_model")
    baseline_rows = collect_predictions(config, baseline_path, old_holdout) if old_holdout and baseline_path.is_file() else []
    candidate_metrics = legacy.score_predictions(candidate_rows, thresholds, float(config["evaluation"]["iou"]), min_area_frac=float(config["evaluation"]["min_area_frac"])) if candidate_rows else {"status": "NOT_MEASURED"}
    baseline_metrics = legacy.score_predictions(baseline_rows, thresholds, float(config["evaluation"]["iou"]), min_area_frac=float(config["evaluation"]["min_area_frac"])) if baseline_rows else {"status": "NOT_MEASURED"}
    new_metrics = legacy.score_predictions(new_predictions, thresholds, float(config["evaluation"]["iou"]), min_area_frac=float(config["evaluation"]["min_area_frac"])) if new_predictions else {"status": "NOT_MEASURED"}
    holdout_sources = {row.get("source") for row in new_holdout}
    new_holdout_predictions = [row for row in new_predictions if row.get("source") in holdout_sources]
    new_holdout_metrics = legacy.score_predictions(new_holdout_predictions, thresholds, float(config["evaluation"]["iou"]), min_area_frac=float(config["evaluation"]["min_area_frac"])) if new_holdout_predictions else {"status": "NOT_MEASURED"}
    failures: list[str] = []
    if candidate_metrics.get("status") == "NOT_MEASURED":
        failures.append("holdout_not_measured")
    else:
        for class_name in CLASS_NAMES.values():
            metrics = candidate_metrics["classes"][class_name]
            if metrics["precision"] < float(config["evaluation"]["minimum_precision"]):
                failures.append(f"{class_name}_precision_below_minimum")
            if metrics["recall"] < float(config["evaluation"]["minimum_recall"]):
                failures.append(f"{class_name}_recall_below_minimum")
            baseline_class = baseline_metrics.get("classes", {}).get(class_name)
            if baseline_class and metrics["recall"] + float(config["evaluation"]["maximum_recall_regression"]) < baseline_class["recall"]:
                failures.append(f"{class_name}_recall_regressed")
        if candidate_metrics.get("empty_machine", {}).get("accepted_detections", 0) != 0:
            failures.append("empty_machine_false_positive")
    if new_metrics.get("status") == "NOT_MEASURED":
        failures.append("new_data_not_measured")
    else:
        if new_metrics["classes"]["metal_can"]["tp"] < 7:
            failures.append("new_data_can_below_7_of_8")
        if new_metrics["classes"]["pet_bottle"]["tp"] < 25:
            failures.append("new_data_pet_below_25_of_27")
        if new_metrics.get("wrong_class_confusions", 0) != 0:
            failures.append("new_data_wrong_class_acceptance")
        if new_metrics.get("empty_machine", {}).get("accepted_detections", 0) != 0:
            failures.append("new_data_negative_false_positive")
    if new_holdout_metrics.get("status") == "NOT_MEASURED" or new_holdout_metrics.get("classes", {}).get("pet_bottle", {}).get("tp", 0) < 5:
        failures.append("white_pet_holdout_below_5_of_6")
    workflow = {}
    for group in sorted({str(row.get("group")) for row in new_all if row.get("role") in {"new_can", "new_pet"}}):
        group_predictions = sorted((row for row in new_predictions if row.get("group") == group), key=lambda row: str(row.get("source")))
        ids: list[int | None] = []
        for item in group_predictions:
            accepted = [prediction for prediction in item.get("predictions", []) if float(prediction.get("confidence", 0.0)) >= float(thresholds.get(CLASS_NAMES.get(int(prediction.get("class_id", -1)), ""), 1.1))]
            ids.append(int(max(accepted, key=lambda row: row["confidence"])["class_id"]) if accepted else None)
        workflow[group] = _workflow_vote(ids)
        workflow[group]["emitted_before_seven"] = False
        expected = "metal_can" if group == "new-data:can_1358_1359" else "pet_bottle"
        if workflow[group]["result"] != expected or workflow[group]["observations"] != 7:
            failures.append(f"workflow_quorum_failed:{group}")
    result = {"schema": "greenguard-m1-quick-evaluation-v1", "run_id": name, "status": "PASS" if not failures else "FAIL", "production_ready": False, "checkpoint": str(checkpoint), "thresholds": thresholds, "candidate_old_holdout": candidate_metrics, "baseline_old_holdout": baseline_metrics, "new_data_all": new_metrics, "new_data_holdout": new_holdout_metrics, "new_data_images": len(new_all), "new_data_holdout_images": len(new_holdout), "new_data_predictions": new_predictions, "selection_images": len(selection), "old_holdout_images": len(old_holdout), "workflow_replay": workflow, "failures": failures, "note": "The one-can adaptation set and physical camera evidence remain insufficient for PRODUCTION_READY."}
    atomic_write(report_root(config, name) / "evaluation_report.json", result)
    return result


def stage_export(config: dict[str, Any], name: str) -> dict[str, Any]:
    from ultralytics import YOLO

    checkpoint = _candidate_checkpoint(config, name)
    destination_root = MODEL_ROOT / config["run"]["export_root"] / name
    if destination_root.exists():
        raise RuntimeError(f"refusing to overwrite candidate export: {destination_root}")
    destination_root.mkdir(parents=True)
    exported = YOLO(str(checkpoint), task="detect").export(format="onnx", imgsz=640, batch=1, dynamic=False, half=False, simplify=True, opset=17, nms=False)
    destination = destination_root / "m1_machine_quick_640.onnx"
    shutil.copy2(Path(exported), destination)
    (destination_root / "labels.txt").write_text("metal_can\npet_bottle\n", encoding="utf-8", newline="\n")
    candidate_hash = sha256_file(destination)
    evaluation = json.loads((report_root(config, name) / "evaluation_report.json").read_text(encoding="utf-8")) if (report_root(config, name) / "evaluation_report.json").is_file() else {}
    status = "CAMERA_VALIDATION_REQUIRED" if evaluation.get("status") == "PASS" else "FAILED_ACCEPTANCE"
    manifest = {"schema": "greenguard-m1-machine-quick-candidate-v1", "run_id": name, "status": status, "classes": {str(key): value for key, value in CLASS_NAMES.items()}, "labels": ["metal_can", "pet_bottle"], "task": "detect", "image_size": 640, "onnx": str(destination), "onnx_sha256": candidate_hash, "checkpoint": str(checkpoint), "checkpoint_sha256": sha256_file(checkpoint), "decision_conf_by_class": evaluation.get("thresholds", {"metal_can": 0.65, "pet_bottle": 0.65}), "workflow_contract": {"observations": 7, "quorum": 4, "pet_only_m2": True, "one_result_per_item": True, "clear_frames_to_rearm": 8}, "source_checkpoint_sha256": config["sources"]["source_checkpoint_sha256"], "activation_policy": "always_replace_only_when_structurally_runtime_compatible"}
    atomic_write(destination_root / "candidate_manifest.json", manifest)
    result = {"schema": "greenguard-m1-quick-export-v1", "run_id": name, "status": "EXPORTED", "candidate_status": status, "onnx": str(destination), "onnx_sha256": candidate_hash, "bytes": destination.stat().st_size, "checkpoint": str(checkpoint), "candidate_manifest": str(destination_root / "candidate_manifest.json")}
    atomic_write(report_root(config, name) / "export_report.json", result)
    return result


def stage_verify(config: dict[str, Any], name: str) -> dict[str, Any]:
    export = json.loads((report_root(config, name) / "export_report.json").read_text(encoding="utf-8"))
    candidate = Path(export["onnx"])
    checks: dict[str, Any] = {"candidate_exists": candidate.is_file(), "candidate_sha256": sha256_file(candidate) if candidate.is_file() else None, "expected_sha256": export.get("onnx_sha256")}
    structural = False
    try:
        import onnxruntime as ort
        session = ort.InferenceSession(str(candidate), providers=["CPUExecutionProvider"])
        outputs = [list(value.shape) for value in session.get_outputs()]
        structural = outputs == [config["export"]["expected_output"]]
        checks["onnxruntime"] = {"inputs": [list(value.shape) for value in session.get_inputs()], "outputs": outputs}
    except Exception as exc:
        checks["runtime_error"] = str(exc)
    labels = (candidate.parent / "labels.txt").read_text(encoding="utf-8").splitlines() if (candidate.parent / "labels.txt").is_file() else []
    metadata_ok = labels == ["metal_can", "pet_bottle"]
    rejected = False
    rejected_path = REPO_ROOT / "Trash-detection" / "validation" / "contracts" / "rejected_models.json"
    if rejected_path.is_file():
        try:
            rejected = checks["candidate_sha256"] in {str(value).lower() for model in json.loads(rejected_path.read_text(encoding="utf-8")).get("models", []) for value in model.get("sha256", [])}
        except (OSError, json.JSONDecodeError):
            rejected = True
    parity: dict[str, Any] = {"status": "NOT_MEASURED"}
    try:
        evaluation = json.loads((report_root(config, name) / "evaluation_report.json").read_text(encoding="utf-8"))
        thresholds = evaluation.get("thresholds", {"metal_can": 0.65, "pet_bottle": 0.65})
        manifest = json.loads((generated_root(config, name) / "manifest.json").read_text(encoding="utf-8"))
        all_records = manifest.get("records", [])
        representatives: list[dict[str, Any]] = []
        for group in sorted({str(row.get("group")) for row in all_records if row.get("source_scope") == "new"}):
            group_rows = [row for row in all_records if str(row.get("group")) == group]
            representatives.extend(group_rows if group == "new-data:negative_1403" else group_rows[:1])
        for class_id in (0, 1):
            match = next((row for row in all_records if row.get("partition") == "holdout" and row.get("source_scope") != "new" and class_id in row.get("class_ids", [])), None)
            if match:
                representatives.append(match)
        old_negative = next((row for row in all_records if row.get("partition") == "holdout" and row.get("source_scope") != "new" and not row.get("labels")), None)
        if old_negative:
            representatives.append(old_negative)
        pytorch_rows = collect_predictions(config, _candidate_checkpoint(config, name), representatives)
        onnx_rows = collect_predictions(config, candidate, representatives)

        def accepted_top(item: dict[str, Any]) -> dict[str, Any] | None:
            accepted = []
            for prediction in item.get("predictions", []):
                class_name = CLASS_NAMES.get(int(prediction.get("class_id", -1)))
                if class_name is None:
                    continue
                if float(prediction.get("confidence", 0.0)) < float(thresholds.get(class_name, 1.1)):
                    continue
                if _legacy()._area_fraction(prediction["box"], item["width"], item["height"]) < float(config["evaluation"]["min_area_frac"]):
                    continue
                accepted.append(prediction)
            return max(accepted, key=lambda row: float(row["confidence"]), default=None)

        cases = []
        parity_pass = len(pytorch_rows) == len(onnx_rows) == len(representatives)
        for left, right in zip(pytorch_rows, onnx_rows):
            left_top, right_top = accepted_top(left), accepted_top(right)
            if left_top is None or right_top is None:
                case_pass = left_top is None and right_top is None
                iou = confidence_delta = None
            else:
                iou = _legacy().xyxy_iou(left_top["box"], right_top["box"])
                confidence_delta = abs(float(left_top["confidence"]) - float(right_top["confidence"]))
                case_pass = int(left_top["class_id"]) == int(right_top["class_id"]) and iou >= 0.95 and confidence_delta <= 0.001
            parity_pass = parity_pass and case_pass
            cases.append({"source": left.get("source"), "pytorch_class": None if left_top is None else CLASS_NAMES[int(left_top["class_id"])], "onnx_class": None if right_top is None else CLASS_NAMES[int(right_top["class_id"])], "iou": iou, "confidence_delta": confidence_delta, "pass": case_pass})
        parity = {"status": "PASS" if parity_pass else "FAIL", "representatives": len(representatives), "thresholds": {"iou": 0.95, "confidence_delta": 0.001}, "cases": cases}
    except Exception as exc:
        parity = {"status": "NOT_MEASURED", "reason": f"{type(exc).__name__}: {exc}"}
    checks.update({"structural_compatible": structural, "class_metadata": {"labels": labels, "pass": metadata_ok}, "rejected_hash": rejected, "protected_model2_hashes": {"pc": sha256_file(resolve_model_path(config, "active_pc_m2")) if resolve_model_path(config, "active_pc_m2").is_file() else None, "jetson": sha256_file(resolve_model_path(config, "active_jetson_m2")) if resolve_model_path(config, "active_jetson_m2").is_file() else None}, "parity": parity})
    checks["activation_allowed"] = bool(checks["candidate_exists"] and checks["candidate_sha256"] == checks["expected_sha256"] and structural and metadata_ok and not rejected)
    result = {"schema": "greenguard-m1-quick-verify-v1", "run_id": name, "status": "PASS" if checks["activation_allowed"] else "FAIL", "checks": checks}
    atomic_write(report_root(config, name) / "verify_report.json", result)
    return result


def stage_activate(config: dict[str, Any], name: str) -> dict[str, Any]:
    verify_path = report_root(config, name) / "verify_report.json"
    if not verify_path.is_file():
        raise FileNotFoundError("verify must complete before activate")
    verify = json.loads(verify_path.read_text(encoding="utf-8"))
    if not verify.get("checks", {}).get("activation_allowed"):
        result = {"schema": "greenguard-m1-quick-activation-v1", "run_id": name, "status": "NOT_ACTIVATED", "reason": "candidate is not structurally runtime-compatible", "verify": verify}
        atomic_write(report_root(config, name) / "activation_report.json", result)
        return result
    export = json.loads((report_root(config, name) / "export_report.json").read_text(encoding="utf-8"))
    candidate = Path(export["onnx"])
    candidate_manifest = json.loads(Path(export["candidate_manifest"]).read_text(encoding="utf-8"))
    active_model = resolve_model_path(config, "active_model")
    active_config = resolve_model_path(config, "active_config")
    active_manifest = resolve_model_path(config, "active_manifest")
    backup = report_root(config, name) / "activation_backup"
    if backup.exists():
        raise RuntimeError(f"refusing to reuse activation backup: {backup}")
    backup.mkdir(parents=True)
    for path in (active_model, active_config, active_manifest):
        if path.is_file():
            shutil.copy2(path, backup / path.name)
    previous_hash = sha256_file(active_model) if active_model.is_file() else None
    runtime_config = json.loads(active_config.read_text(encoding="utf-8"))
    thresholds = candidate_manifest.get("decision_conf_by_class", {"metal_can": 0.65, "pet_bottle": 0.65})
    runtime_config["m1"]["detector"].update({"path": "models/m1_detect_640.onnx", "classes": ["metal_can", "pet_bottle"], "visible_class_ids": [0, 1], "decision_conf": max(float(value) for value in thresholds.values()), "decision_conf_by_class": {key: float(value) for key, value in thresholds.items()}, "candidate_only": False, "active_candidate_run": name, "active_candidate_sha256": sha256_file(candidate)})
    runtime_config.setdefault("candidate_validation", {})["status"] = "FAILED_ACCEPTANCE_ACTIVE_OVERRIDE" if candidate_manifest.get("status") == "FAILED_ACCEPTANCE" else "CAMERA_VALIDATION_REQUIRED_ACTIVE_OVERRIDE"
    atomic_write(active_config, runtime_config)
    shutil.copy2(candidate, active_model)
    runtime_manifest = json.loads(active_manifest.read_text(encoding="utf-8"))
    for entry in runtime_manifest.get("models", []):
        if entry.get("family") == "m1":
            entry.update({"source_path": str(candidate), "source_sha256": sha256_file(candidate), "sha256": sha256_file(candidate), "bytes": candidate.stat().st_size, "classes": ["metal_can", "pet_bottle"], "source_run": name})
    atomic_write(active_manifest, runtime_manifest)
    status = "FAILED_ACCEPTANCE_ACTIVE_OVERRIDE" if candidate_manifest.get("status") == "FAILED_ACCEPTANCE" else "CAMERA_VALIDATION_REQUIRED_ACTIVE_OVERRIDE"
    result = {"schema": "greenguard-m1-quick-activation-v1", "run_id": name, "status": status, "active_model": str(active_model), "active_sha256": sha256_file(active_model), "previous_sha256": previous_hash, "backup": str(backup), "rollback": f"copy {backup / active_model.name} {active_model}; copy {backup / active_config.name} {active_config}; copy {backup / active_manifest.name} {active_manifest}", "model2_hashes_unchanged": verify["checks"].get("protected_model2_hashes")}
    atomic_write(report_root(config, name) / "activation_report.json", result)
    return result


def stage_publish(config: dict[str, Any], name: str) -> dict[str, Any]:
    result = {"schema": "greenguard-m1-quick-publish-v1", "run_id": name, "status": "PREPARED_ONLY", "git_publish_executed": False, "message": "Git commit/push remains under the calling agent; this runner does not mutate Git."}
    atomic_write(report_root(config, name) / "publish_report.json", result)
    return result


def full(config: dict[str, Any], name: str, wall_minutes: float, activate: bool = False, publish: bool = False) -> dict[str, Any]:
    deadline = WallClockDeadline(wall_minutes)
    reserve_seconds = float(config["run"].get("deadline_reserve_minutes", 32)) * 60.0
    training_deadline = deadline.with_reserved_tail(reserve_seconds)
    heartbeat = Heartbeat(report_root(config, name), deadline)
    results: dict[str, Any] = {"schema": "greenguard-m1-machine-quick-finetune-orchestration-v1", "run_id": name, "status": "RUNNING", "wall_minutes": wall_minutes, "started_at": utc_now(), "stages": {}}
    stage_calls: list[tuple[str, Callable[[], dict[str, Any]]]] = [
        ("preflight", lambda: stage_preflight(config, name)),
        ("audit-new", lambda: audit_new_data(config, name)),
        ("prepare-replay", lambda: prepare_replay(config, name)),
        ("baseline", lambda: stage_baseline(config, name)),
        ("smoke", lambda: stage_smoke(config, name, training_deadline)),
        ("freeze-head", lambda: stage_freeze_head(config, name, training_deadline)),
        ("full-finetune", lambda: stage_full_finetune(config, name, training_deadline)),
        ("calibrate", lambda: stage_calibrate(config, name)),
        ("evaluate", lambda: stage_evaluate(config, name)),
        ("export", lambda: stage_export(config, name)),
        ("verify", lambda: stage_verify(config, name)),
    ]
    try:
        for stage, callback in stage_calls:
            (training_deadline if stage in {"smoke", "freeze-head", "full-finetune"} else deadline).require(stage)
            heartbeat.update(stage, state="starting")
            value = callback()
            results["stages"][stage] = value
            heartbeat.update(stage, state=value.get("status", "completed"))
            if value.get("status") in {"FAILED", "NOT_MEASURED"} and stage in {"preflight", "audit-new", "prepare-replay", "smoke", "freeze-head", "full-finetune"}:
                raise RuntimeError(f"stage {stage} returned {value.get('status')}")
        if activate:
            deadline.require("activate", reserve_seconds=0)
            results["stages"]["activate"] = stage_activate(config, name)
        if publish:
            results["stages"]["publish"] = stage_publish(config, name)
        results["status"] = "COMPLETED"
    except DeadlineExceeded as exc:
        results["status"] = "TIME_BUDGET_EXPIRED"
        results["failure"] = str(exc)
    except Exception as exc:
        results["status"] = "FAILED"
        results["failure"] = f"{type(exc).__name__}: {exc}"
    results["finished_at"] = utc_now()
    results["elapsed_seconds"] = deadline.elapsed_seconds()
    atomic_write(report_root(config, name) / "orchestration_report.json", results)
    return results


def dispatch(args: argparse.Namespace) -> tuple[int, dict[str, Any]]:
    config_path = Path(args.config).resolve() if args.config else DEFAULT_CONFIG
    config = load_config(config_path)
    name = run_name(config, args.run_id)
    if args.command == "__train-child":
        return _train_child(config, name, args.phase, Path(args.weights), Path(args.data), int(args.batch), int(args.epochs), int(args.patience), bool(args.smoke)), {"status": "COMPLETED"}
    if args.command == "full":
        result = full(config, name, float(args.wall_minutes or config["run"]["wall_minutes"]), bool(args.activate), bool(args.publish))
    elif args.command == "preflight":
        result = stage_preflight(config, name)
    elif args.command == "audit-new":
        result = audit_new_data(config, name)
    elif args.command == "prepare-replay":
        result = prepare_replay(config, name)
    elif args.command == "baseline":
        result = stage_baseline(config, name)
    elif args.command == "smoke":
        result = stage_smoke(config, name, WallClockDeadline(float(args.wall_minutes or config["run"]["wall_minutes"])))
    elif args.command == "freeze-head":
        result = stage_freeze_head(config, name, WallClockDeadline(float(args.wall_minutes or config["run"]["wall_minutes"])))
    elif args.command == "full-finetune":
        result = stage_full_finetune(config, name, WallClockDeadline(float(args.wall_minutes or config["run"]["wall_minutes"])))
    elif args.command == "calibrate":
        result = stage_calibrate(config, name)
    elif args.command == "evaluate":
        result = stage_evaluate(config, name)
    elif args.command == "export":
        result = stage_export(config, name)
    elif args.command == "verify":
        result = stage_verify(config, name)
    elif args.command == "activate":
        result = stage_activate(config, name)
    elif args.command == "publish":
        result = stage_publish(config, name)
    else:
        raise ValueError(args.command)
    status = str(result.get("status", ""))
    return (0 if status not in {"FAILED", "FAIL", "NOT_ACTIVATED", "TIME_BUDGET_EXPIRED", "TIME_BUDGET_EXPIRED_WITHOUT_CHECKPOINT"} else 2), result


def main() -> int:
    parser = argparse.ArgumentParser(description="GreenGuard bounded Model 1 machine-domain quick fine-tune")
    parser.add_argument("command", choices=[*STAGES, "full", "__train-child"])
    parser.add_argument("--config", type=Path)
    parser.add_argument("--run-id")
    parser.add_argument("--wall-minutes", type=float)
    parser.add_argument("--activate", action="store_true")
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--phase")
    parser.add_argument("--weights", type=Path)
    parser.add_argument("--data", type=Path)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--patience", type=int, default=1)
    parser.add_argument("--smoke", action="store_true")
    args = parser.parse_args()
    if args.command == "__train-child" and (not args.phase or not args.weights or not args.data):
        parser.error("__train-child requires --phase, --weights, and --data")
    code, result = dispatch(args)
    printable = {key: value for key, value in result.items() if key != "records"}
    print(json.dumps(printable, indent=2, default=str))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
