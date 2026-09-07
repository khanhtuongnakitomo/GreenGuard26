from __future__ import annotations

import argparse
import hashlib
import json
import random
import shutil
import tempfile
from pathlib import Path

import cv2
import numpy as np
import yaml
from ultralytics import YOLO

from evaluate_m2v6_live_finetune import (
    clean_negative_eval,
    compare_locked_test,
    create_surface_yaml,
    evaluate_surface,
    gate_replay,
    read_gate_sequences,
)
from live_finetune_common import canonical_names, load_config, report_path, sha256_file, workflow_paths, write_json, write_status


def stress_image(image: np.ndarray, kind: str, seed: int) -> np.ndarray:
    rng = random.Random(seed)
    out = image.astype(np.float32)
    if kind == "dark":
        out = np.power(np.clip(out / 255.0, 0.0, 1.0), 0.55) * 255.0
        out = out * 0.78 - 12.0
    elif kind == "bright":
        out = out * 1.28 + 24.0
        h, w = image.shape[:2]
        overlay = np.zeros_like(image)
        center = (int(w * (0.55 + 0.25 * rng.random())), int(h * (0.15 + 0.55 * rng.random())))
        axes = (max(4, int(w * 0.12)), max(4, int(h * 0.08)))
        cv2.ellipse(overlay, center, axes, rng.uniform(-40.0, 40.0), 0, 360, (255, 255, 255), -1)
        out = cv2.addWeighted(np.clip(out, 0, 255).astype(np.uint8), 0.82, overlay, 0.18, 0).astype(np.float32)
    elif kind == "glare":
        h, w = image.shape[:2]
        overlay = image.copy()
        cv2.ellipse(overlay, (int(w * 0.68), int(h * 0.30)), (int(w * 0.18), int(h * 0.10)), -20, 0, 360, (255, 255, 255), -1)
        out = cv2.addWeighted(image, 0.78, overlay, 0.22, 0).astype(np.float32)
    elif kind == "noise":
        noise = np.random.default_rng(seed).normal(0.0, 9.0, image.shape)
        out = out + noise
    elif kind == "blur":
        out = cv2.GaussianBlur(image, (5, 5), 0).astype(np.float32)
    return np.clip(out, 0.0, 255.0).astype(np.uint8)


def stable_seed(text: str) -> int:
    return int.from_bytes(hashlib.sha256(text.encode("utf-8")).digest()[:4], "big")


def create_stress_surface(generated_root: Path, kind: str) -> Path:
    source_images = generated_root / "splits" / "live" / "holdout" / "images"
    source_labels = generated_root / "splits" / "live" / "holdout" / "labels"
    root = generated_root / "surfaces" / "stress" / kind
    image_dir = root / "images"
    label_dir = root / "labels"
    image_dir.mkdir(parents=True, exist_ok=True)
    label_dir.mkdir(parents=True, exist_ok=True)
    for image_path in sorted(source_images.iterdir()):
        if image_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
            continue
        image = cv2.imread(str(image_path))
        if image is None:
            continue
        output = image_dir / f"{image_path.stem}_{kind}.jpg"
        cv2.imwrite(str(output), stress_image(image, kind, stable_seed(image_path.name + kind)))
        source_label = source_labels / f"{image_path.stem}.txt"
        if source_label.is_file():
            shutil.copy2(source_label, label_dir / f"{output.stem}.txt")
    payload = {
        "path": str(generated_root.resolve()),
        "train": f"surfaces/stress/{kind}/images",
        "val": f"surfaces/stress/{kind}/images",
        "test": f"surfaces/stress/{kind}/images",
        "names": {0: "cap", 1: "label", 2: "ring"},
    }
    yaml_path = root / "dataset.yaml"
    yaml_path.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")
    return yaml_path


def stage_metrics(cfg: dict, weights: Path, stage_name: str, locked_yaml: Path) -> dict:
    generated_root = workflow_paths(cfg)["generated_root"]
    names = canonical_names(cfg)
    batch = int(cfg["training"]["val_batch"])
    imgsz = int(cfg["training"]["imgsz"])
    val_yaml = generated_root / "live_val.yaml"
    holdout_yaml = generated_root / "live_holdout.yaml"
    surfaces = {
        "machine_val": evaluate_surface(weights, val_yaml, imgsz, batch, "cpu", names),
        "machine_holdout": evaluate_surface(weights, holdout_yaml, imgsz, batch, "cpu", names),
        "locked_test": evaluate_surface(weights, locked_yaml, imgsz, batch, "cpu", names),
        "clean_negative": clean_negative_eval(weights, cfg),
        "gate_replay": gate_replay(weights, read_gate_sequences(generated_root), cfg),
    }
    stress = {}
    for kind in ("dark", "bright", "glare", "noise", "blur"):
        stress[kind] = evaluate_surface(weights, create_stress_surface(generated_root, kind), imgsz, batch, "cpu", names)
    surfaces["stress"] = stress
    return {"stage": stage_name, "weights": str(weights), "weights_sha256": sha256_file(weights, upper=True), "surfaces": surfaces}


def gates_for(cfg: dict, baseline: dict, candidate: dict, prepare_report: dict) -> dict[str, bool]:
    names = canonical_names(cfg)
    holdout = candidate["surfaces"]["machine_holdout"]
    locked_ok, _ = compare_locked_test(
        baseline["surfaces"]["locked_test"],
        candidate["surfaces"]["locked_test"],
        float(cfg["evaluation"]["locked_test_max_per_class_regression"]),
        names,
    )
    classes = holdout.get("classes", {})
    cap = classes.get("cap", {})
    label = classes.get("label", {})
    ring = classes.get("ring", {})
    positive_lock = candidate["surfaces"]["gate_replay"].get("positive_reject_rate", 0.0)
    negative = candidate["surfaces"]["clean_negative"]
    baseline_negative = baseline["surfaces"]["clean_negative"]
    stress = candidate["surfaces"]["stress"]
    normal = holdout.get("macro_recall", 0.0)
    stress_recall_ok = all(item.get("macro_recall", 0.0) >= normal - float(cfg["evaluation"]["stress_recall_drop_max"]) for item in stress.values())
    return {
        "quarantine_clear": not prepare_report.get("promotion_prereq_failures"),
        "cap_recall": float(cap.get("recall", 0.0)) >= float(cfg["evaluation"]["cap_min_recall"]),
        "label_recall": float(label.get("recall", 0.0)) >= float(cfg["evaluation"]["label_min_recall"]),
        "cap_f1": float(cap.get("f1", 0.0)) >= float(cfg["evaluation"]["cap_min_f1"]),
        "label_f1": float(label.get("f1", 0.0)) >= float(cfg["evaluation"]["label_min_f1"]),
        "machine_holdout_map50": float(holdout.get("overall_mAP50", 0.0)) >= float(cfg["evaluation"]["machine_holdout_min_map50"]),
        "machine_holdout_macro_f1": float(holdout.get("macro_f1", 0.0)) >= float(cfg["evaluation"]["machine_holdout_min_macro_f1"]),
        "ring_recall": float(ring.get("recall", 0.0)) >= float(cfg["evaluation"]["ring_min_recall"]),
        "ring_map50": float(ring.get("mAP50", 0.0)) >= float(cfg["evaluation"]["ring_min_map50"]),
        "temporal_positive_lock": positive_lock >= float(cfg["evaluation"]["temporal_positive_lock_min"]),
        "clean_negative_not_worse": not negative.get("missing", True) and negative.get("false_reject_rate", 1.0) <= baseline_negative.get("false_reject_rate", 1.0),
        "locked_test_regression": locked_ok,
        "stress_recall": stress_recall_ok,
    }


def acceptance_summary(gates: dict[str, bool], manual: bool, reason: str | None) -> dict:
    automated_passed = all(gates.values())
    return {
        "automated_gates_passed": automated_passed,
        "manual_machine_acceptance": manual,
        "manual_acceptance_reason": reason if manual else None,
        "production_ready": automated_passed or manual,
        "production_blockers": sorted(name for name, passed in gates.items() if not passed),
        "promotion": "manual_machine_specific_acceptance_candidate_only" if manual else "not_requested_and_not_performed",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate and select the Model 2 revamped stages.")
    parser.add_argument("--config", default="config/m2_revamped.yaml")
    parser.add_argument("--dataset-run", required=True)
    parser.add_argument("--stage-a", required=True)
    parser.add_argument("--stage-b", required=True)
    parser.add_argument(
        "--manual-machine-acceptance",
        action="store_true",
        help="Explicitly accept the selected candidate for the fixed machine camera despite automated gate failures.",
    )
    parser.add_argument(
        "--acceptance-reason",
        default="Explicit fixed-camera machine-specific acceptance requested by the operator.",
    )
    args = parser.parse_args()

    cfg = load_config(args.config, run_name_override=args.dataset_run)
    generated_root = workflow_paths(cfg)["generated_root"]
    prepare_path = report_path(cfg, "prepare_report.json")
    if not prepare_path.is_file():
        write_status(cfg, "CRASHED", step="evaluate", detail="missing prepare report")
        return 1
    prepare_report = json.loads(prepare_path.read_text(encoding="utf-8"))
    baseline_path = Path(cfg["_resolved"]["baseline_checkpoint"])
    locked_yaml = create_surface_yaml(Path(cfg["_resolved"]["model2_root"]) / "dataset", "test_locked/images", canonical_names(cfg))
    baseline = stage_metrics(cfg, baseline_path, "active_baseline", locked_yaml)
    candidates = []
    for stage_name in (args.stage_a, args.stage_b):
        weights = Path(cfg["_resolved"]["model2_root"]) / "runs" / stage_name / "weights" / "best.pt"
        if weights.is_file():
            candidate = stage_metrics(cfg, weights, stage_name, locked_yaml)
            candidate["gates"] = gates_for(cfg, baseline, candidate, prepare_report)
            candidates.append(candidate)
    if not candidates:
        write_status(cfg, "CRASHED", step="evaluate", detail="no stage checkpoint found")
        return 1

    def rank(item: dict) -> tuple:
        holdout = item["surfaces"]["machine_holdout"]
        classes = holdout.get("classes", {})
        gates = item["gates"]
        return (
            sum(bool(value) for value in gates.values()),
            min(classes.get("cap", {}).get("recall", 0.0), classes.get("label", {}).get("recall", 0.0)),
            item["surfaces"]["gate_replay"].get("positive_reject_rate", 0.0),
            -item["surfaces"]["clean_negative"].get("false_reject_rate", 1.0),
            holdout.get("overall_mAP50", 0.0),
        )

    selected = max(candidates, key=rank)
    acceptance = acceptance_summary(
        selected["gates"],
        bool(args.manual_machine_acceptance),
        args.acceptance_reason,
    )
    report = {
        "run_name": cfg["run_name"],
        "baseline": baseline,
        "candidates": candidates,
        "selected_stage": selected["stage"],
        "selected_weights": selected["weights"],
        "selected_gates": selected["gates"],
        **acceptance,
    }
    write_json(report_path(cfg, "revamped_evaluation_report.json"), report)
    status_detail = f"selected {selected['stage']} with {len(report['production_blockers'])} automated blockers"
    if args.manual_machine_acceptance:
        status_detail += "; manually accepted for fixed-camera machine use"
    write_status(cfg, "STOPPED", step="evaluate", detail=status_detail)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
