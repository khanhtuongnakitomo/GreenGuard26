"""Fail-closed preflight/runner for the reviewed strict two-class M1 candidate.

The command never consumes the derived v7 manifest and never writes active
runtime models. Until a reviewer-approved grouped manifest exists it exits
with NEEDS_REVIEWED_DATA, which is an intentional terminal status.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_ROOT = ROOT / "training" / "model1"
CONFIG_PATH = MODEL_ROOT / "strict_two_class_config.json"
DEFAULT_MANIFEST = MODEL_ROOT / "dataset" / "strict_reviewed" / "manifest.json"
STATUSES = {"COMPLETE_CANDIDATE", "FAILED_ACCEPTANCE", "NEEDS_REVIEWED_DATA", "RESOURCE_BUSY", "INTERRUPTED"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest().lower()


def fail(message: str) -> tuple[bool, list[str]]:
    return False, [message]


def validate_manifest(path: Path) -> tuple[bool, list[str], dict]:
    if not path.is_file():
        return False, [f"reviewed manifest missing: {path}"], {}
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return False, [f"invalid reviewed manifest: {exc}"], {}
    errors: list[str] = []
    if manifest.get("schema_version") != "greenguard-m1-reviewed-v1": errors.append("wrong manifest schema")
    if manifest.get("classes") != ["metal_can", "pet_bottle"]: errors.append("manifest must contain exactly metal_can, pet_bottle")
    rows = manifest.get("items")
    splits = manifest.get("splits")
    if not isinstance(rows, list) or not isinstance(splits, dict): return False, errors + ["items and splits are required"], manifest
    row_by_image = {str(row.get("image")): row for row in rows}
    if len(row_by_image) != len(rows): errors.append("duplicate image entries")
    groups: dict[str, set[str]] = {name: set() for name in ("train", "val", "holdout")}
    source_hashes: set[str] = set()
    class_presence = {name: set() for name in groups}
    sessions: set[str] = set()
    for split, images in splits.items():
        if split not in groups or not isinstance(images, list): errors.append(f"invalid split {split}"); continue
        for image in images:
            row = row_by_image.get(str(image))
            if row is None: errors.append(f"split references unknown image {image}"); continue
            if row.get("review_status") != "approved": errors.append(f"unapproved row {image}")
            if not row.get("physical_item_id") or not row.get("session_id") or not row.get("trial_id"): errors.append(f"missing group identity {image}")
            group = f'{row.get("physical_item_id")}::{row.get("session_id")}::{row.get("trial_id")}'; groups[split].add(group)
            sessions.add(str(row.get("session_id")))
            label_path = MODEL_ROOT / str(row.get("label", ""))
            image_path = MODEL_ROOT / str(image)
            if not image_path.is_file() or not label_path.is_file(): errors.append(f"missing image/label for {image}"); continue
            expected_hash = str(row.get("source_sha256", "")).lower()
            if expected_hash and sha256(image_path) != expected_hash: errors.append(f"source hash mismatch {image}")
            image_hash = sha256(image_path)
            if image_hash in source_hashes: errors.append(f"duplicate source image {image}")
            source_hashes.add(image_hash)
            for line in label_path.read_text(encoding="utf-8").splitlines():
                fields = line.split()
                if len(fields) != 5 or fields[0] not in {"0", "1"}: errors.append(f"non-HBB or invalid class {label_path}"); continue
                coords = [float(value) for value in fields[1:]]
                if any(value <= 0.0 or value >= 1.0 for value in coords): errors.append(f"clipped/invalid normalized box {label_path}")
                class_presence[split].add(manifest["classes"][int(fields[0])])
    for left, right in (("train", "val"), ("train", "holdout"), ("val", "holdout")):
        overlap = groups[left] & groups[right]
        if overlap: errors.append(f"group leakage {left}/{right}: {sorted(overlap)[:3]}")
    if len(sessions) < 3: errors.append("at least three independent sessions are required")
    for split in groups:
        if class_presence[split] != {"metal_can", "pet_bottle"}: errors.append(f"both target classes required in {split}")
    return not errors, errors, manifest


def environment_snapshot() -> dict:
    try:
        import torch
        torch_version, cuda, gpu = torch.__version__, torch.version.cuda, torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
    except Exception as exc:
        torch_version, cuda, gpu = None, None, str(exc)
    return {"python": sys.version, "torch": torch_version, "cuda": cuda, "gpu": gpu, "pid": os.getpid()}


def main() -> int:
    parser = argparse.ArgumentParser(description="Preflight or run the guarded strict two-class Model 1 candidate")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=MODEL_ROOT / "export" / "candidates" / "strict_two_class")
    parser.add_argument("--run", action="store_true", help="train only after all reviewed-data gates pass")
    parser.add_argument("--smoke", action="store_true", help="one-epoch smoke after data gates pass")
    args = parser.parse_args()
    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    checkpoint = Path(cfg["source_checkpoint"])
    errors: list[str] = []
    if not checkpoint.is_file(): errors.append(f"source checkpoint missing: {checkpoint}")
    elif sha256(checkpoint) != cfg["source_checkpoint_sha256"]: errors.append("source checkpoint hash mismatch")
    valid, manifest_errors, manifest = validate_manifest(args.manifest)
    errors.extend(manifest_errors)
    status = "NEEDS_REVIEWED_DATA" if not valid else "RESOURCE_BUSY"
    if valid and args.run:
        # The training process is deliberately isolated from active runtime paths.
        args.output.mkdir(parents=True, exist_ok=True)
        (args.output / "RUN_INFO.json").write_text(json.dumps({"status": "STARTING", "config": cfg, "environment": environment_snapshot(), "manifest": manifest}, indent=2), encoding="utf-8")
        status = "INTERRUPTED"
        errors.append("guarded training backend is not started by this recovery branch; reviewed dataset is ready for an explicit training run")
    report = {"schema_version": "greenguard-m1-training-status-v1", "status": status, "generated_at": datetime.now(UTC).isoformat(), "manifest": str(args.manifest), "errors": errors, "config": cfg, "environment": environment_snapshot(), "production_model_touched": False}
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "STATUS.json").write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps({"status": status, "errors": errors}, indent=2))
    return 0 if status in {"COMPLETE_CANDIDATE", "FAILED_ACCEPTANCE", "INTERRUPTED", "RESOURCE_BUSY"} else 2


if __name__ == "__main__": raise SystemExit(main())
