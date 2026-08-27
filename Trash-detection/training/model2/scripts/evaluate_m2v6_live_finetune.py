from __future__ import annotations

import argparse
import json
import math
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

import cv2
import yaml
from ultralytics import YOLO

from live_finetune_common import (
    canonical_names,
    load_config,
    log_event,
    report_path,
    workflow_paths,
    write_json,
    write_status,
)


def metric_adapter(result: Any) -> Any:
    return getattr(result, "obb", None) or getattr(result, "box", None)


def per_class_metrics(result: Any, names: list[str]) -> dict[str, dict[str, float]]:
    metrics = metric_adapter(result)
    if metrics is None:
        return {}
    per_class: dict[str, dict[str, float]] = {}
    indices = list(getattr(metrics, "ap_class_index", []))
    for i, cls_idx in enumerate(indices):
        name = names[int(cls_idx)]
        precision = float(metrics.p[i]) if hasattr(metrics, "p") else 0.0
        recall = float(metrics.r[i]) if hasattr(metrics, "r") else 0.0
        f1 = (2.0 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
        per_class[name] = {
            "precision": round(precision, 6),
            "recall": round(recall, 6),
            "f1": round(f1, 6),
            "mAP50": round(float(metrics.ap50[i]), 6),
            "mAP50-95": round(float(metrics.ap[i]), 6),
        }
    return per_class


def summary_metrics(result: Any, names: list[str]) -> dict[str, Any]:
    per_class = per_class_metrics(result, names)
    recalls = [item["recall"] for item in per_class.values()]
    f1s = [item["f1"] for item in per_class.values()]
    results_dict = getattr(result, "results_dict", {}) or {}
    return {
        "overall_precision": round(float(results_dict.get("metrics/precision(B)", 0.0)), 6),
        "overall_recall": round(float(results_dict.get("metrics/recall(B)", 0.0)), 6),
        "overall_mAP50": round(float(results_dict.get("metrics/mAP50(B)", 0.0)), 6),
        "overall_mAP50-95": round(float(results_dict.get("metrics/mAP50-95(B)", 0.0)), 6),
        "macro_recall": round(sum(recalls) / len(recalls), 6) if recalls else 0.0,
        "macro_f1": round(sum(f1s) / len(f1s), 6) if f1s else 0.0,
        "classes": per_class,
    }


def create_surface_yaml(base_path: Path, split_rel: str, names: list[str]) -> Path:
    payload = {
        "path": str(base_path.resolve()),
        "train": split_rel,
        "val": split_rel,
        "test": split_rel,
        "names": {idx: name for idx, name in enumerate(names)},
    }
    handle = tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False, encoding="utf-8")
    with handle:
        yaml.safe_dump(payload, handle)
    return Path(handle.name)


def evaluate_surface(weights: Path, yaml_path: Path, imgsz: int, batch: int, device: str, names: list[str]) -> dict[str, Any]:
    model = YOLO(str(weights))
    result = model.val(
        data=str(yaml_path),
        split="test",
        imgsz=imgsz,
        batch=batch,
        plots=False,
        verbose=False,
        device=device,
    )
    return summary_metrics(result, names)


def read_gate_sequences(generated_root: Path) -> list[dict[str, Any]]:
    reports = generated_root / "manifests" / "gate_sequences.json"
    if not reports.is_file():
        return []
    entries = json.loads(reports.read_text(encoding="utf-8"))
    sequences = []
    for entry in entries:
        path = Path(entry["path"])
        if path.is_file():
            sequences.append(json.loads(path.read_text(encoding="utf-8")))
    return sequences


def top1_per_class(detections: Any, names: list[str]) -> dict[str, float]:
    hits: dict[str, float] = {}
    if detections.obb is None or len(detections.obb) == 0:
        return hits
    clss = detections.obb.cls.cpu().numpy().astype(int)
    confs = detections.obb.conf.cpu().numpy()
    for cls_idx, conf in zip(clss, confs):
        name = names[int(cls_idx)]
        hits[name] = max(hits.get(name, 0.0), float(conf))
    return hits


def gate_replay(model_path: Path, sequences: list[dict[str, Any]], cfg: dict[str, Any]) -> dict[str, Any]:
    if not sequences:
        return {"sequence_count": 0, "positive_sequences": 0, "positive_reject_rate": 0.0}
    names = canonical_names(cfg)
    runtime = cfg["runtime_contract"]
    infer_conf = float(runtime["infer_conf"])
    violation_conf = float(runtime["violation_conf"])
    vote_window = int(runtime["vote_window"])
    vote_need = int(runtime["vote_need"])
    warmup_frames = max(1, int(math.ceil(float(runtime["warmup_seconds"]) * float(cfg["dataset"]["eval_frame_fps"]))))

    model = YOLO(str(model_path), task="obb" if model_path.suffix == ".onnx" else None)
    positive_sequences = 0
    positive_rejects = 0
    details = []
    for sequence in sequences:
        votes: list[str] = []
        reject_locked = False
        positive = bool(sequence.get("expected_positive_sequence"))
        if positive:
            positive_sequences += 1
        for frame_index, frame in enumerate(sequence["frames"], start=1):
            image_path = cfg["_resolved"]["paths"]["generated_root"] / "canonical" / "live_machine" / "images" / frame["image_name"]
            image = cv2.imread(str(image_path))
            if image is None:
                continue
            result = model.predict(image, imgsz=int(cfg["training"]["imgsz"]), conf=infer_conf, device="cpu", verbose=False)[0]
            hits = top1_per_class(result, names)
            if frame_index < warmup_frames:
                continue
            votes.append("REJECT" if any(conf >= violation_conf for conf in hits.values()) else "ACCEPT")
            votes = votes[-vote_window:]
            if votes.count("REJECT") >= vote_need:
                reject_locked = True
                break
        if positive and reject_locked:
            positive_rejects += 1
        details.append({"group_id": sequence["group_id"], "split": sequence["split"], "positive": positive, "reject_locked": reject_locked})
    return {
        "sequence_count": len(sequences),
        "positive_sequences": positive_sequences,
        "positive_rejects": positive_rejects,
        "positive_reject_rate": round(positive_rejects / positive_sequences, 6) if positive_sequences else 0.0,
        "details": details,
    }


def clean_negative_eval(model_path: Path, cfg: dict[str, Any]) -> dict[str, Any]:
    generated_root = workflow_paths(cfg)["generated_root"]
    negative_root = generated_root / "surfaces" / "clean_negative" / "images"
    names = canonical_names(cfg)
    images = sorted(item for item in negative_root.iterdir() if item.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}) if negative_root.is_dir() else []
    if not images:
        return {"image_count": 0, "false_rejects": None, "false_reject_rate": None, "missing": True}
    model = YOLO(str(model_path), task="obb" if model_path.suffix == ".onnx" else None)
    infer_conf = float(cfg["runtime_contract"]["infer_conf"])
    violation_conf = float(cfg["runtime_contract"]["violation_conf"])
    false_rejects = 0
    details = []
    for image_path in images:
        image = cv2.imread(str(image_path))
        if image is None:
            continue
        result = model.predict(image, imgsz=int(cfg["training"]["imgsz"]), conf=infer_conf, device="cpu", verbose=False)[0]
        hits = top1_per_class(result, names)
        rejected = any(conf >= violation_conf for conf in hits.values())
        if rejected:
            false_rejects += 1
        details.append({"image_name": image_path.name, "rejected": rejected, "top1": hits})
    return {
        "image_count": len(images),
        "false_rejects": false_rejects,
        "false_reject_rate": round(false_rejects / len(images), 6),
        "missing": False,
        "details": details,
    }


def class_keys(surface: dict[str, Any]) -> set[str]:
    return set(surface.get("classes", {}).keys())


def compare_locked_test(
    baseline: dict[str, Any],
    candidate: dict[str, Any],
    max_regression: float,
    names: list[str],
) -> tuple[bool, dict[str, float]]:
    regressions = {}
    okay = True
    for name in names:
        base_value = baseline["classes"].get(name, {}).get("mAP50")
        cand_value = candidate["classes"].get(name, {}).get("mAP50")
        if base_value is None or cand_value is None:
            okay = False
            regressions[name] = None
            continue
        regression = round(cand_value - base_value, 6)
        regressions[name] = regression
        if regression < -max_regression:
            okay = False
    return okay, regressions


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=None)
    parser.add_argument("--run", default=None)
    parser.add_argument("--weights", default=None)
    parser.add_argument("--device", default="0")
    args = parser.parse_args()

    cfg = load_config(args.config, run_name_override=args.run)
    generated_root = workflow_paths(cfg)["generated_root"]
    prepare_report_path = report_path(cfg, "prepare_report.json")
    if not prepare_report_path.is_file():
        write_status(cfg, "CRASHED", step="evaluate", detail="prepare_report.json is missing")
        return 1
    prepare_report = json.loads(prepare_report_path.read_text(encoding="utf-8"))

    weights = Path(args.weights) if args.weights else Path(cfg["_resolved"]["model2_root"]) / "runs" / (args.run or cfg["run_name"]) / "weights" / "best.pt"
    baseline = cfg["_resolved"]["baseline_checkpoint"]
    if not weights.is_file():
        write_status(cfg, "CRASHED", step="evaluate", detail=f"candidate weights not found: {weights}")
        return 1

    write_status(cfg, "VALIDATING", step="evaluate", candidate_weights=str(weights))
    names = canonical_names(cfg)
    batch = int(cfg["training"]["val_batch"])
    imgsz = int(cfg["training"]["imgsz"])

    val_yaml = generated_root / "live_val.yaml"
    holdout_yaml = generated_root / "live_holdout.yaml"
    locked_yaml = create_surface_yaml(Path(cfg["_resolved"]["model2_root"]) / "dataset", "test_locked/images", names)

    candidate_val = evaluate_surface(weights, val_yaml, imgsz, batch, args.device, names)
    baseline_val = evaluate_surface(baseline, val_yaml, imgsz, batch, args.device, names)
    candidate_holdout = evaluate_surface(weights, holdout_yaml, imgsz, batch, args.device, names)
    baseline_holdout = evaluate_surface(baseline, holdout_yaml, imgsz, batch, args.device, names)
    candidate_locked = evaluate_surface(weights, locked_yaml, imgsz, batch, args.device, names)
    baseline_locked = evaluate_surface(baseline, locked_yaml, imgsz, batch, args.device, names)

    candidate_negatives = clean_negative_eval(weights, cfg)
    baseline_negatives = clean_negative_eval(baseline, cfg)
    sequences = read_gate_sequences(generated_root)
    candidate_gate = gate_replay(weights, sequences, cfg)
    baseline_gate = gate_replay(baseline, sequences, cfg)

    locked_ok, locked_regressions = compare_locked_test(
        baseline_locked,
        candidate_locked,
        float(cfg["evaluation"]["locked_test_max_per_class_regression"]),
        names,
    )

    gates = {
        "prepare_data_prereqs": not prepare_report.get("promotion_prereq_failures"),
        "class_coverage_val": class_keys(candidate_val) == set(names),
        "class_coverage_holdout": class_keys(candidate_holdout) == set(names),
        "class_coverage_locked": class_keys(candidate_locked) == set(names),
        "holdout_macro_f1_preserved": candidate_holdout["macro_f1"] >= baseline_holdout["macro_f1"],
        "holdout_macro_recall_preserved": candidate_holdout["macro_recall"] >= baseline_holdout["macro_recall"],
        "locked_test_regression_ok": locked_ok,
        "clean_negative_not_worse": (
            not candidate_negatives["missing"]
            and not baseline_negatives["missing"]
            and candidate_negatives["false_reject_rate"] <= baseline_negatives["false_reject_rate"]
        ),
        "gate_replay_preserved": candidate_gate["positive_reject_rate"] >= baseline_gate["positive_reject_rate"],
    }
    blockers = [name for name, ok in gates.items() if not ok]
    if candidate_negatives["missing"]:
        blockers.append("missing_clean_negative_surface")
    if baseline_negatives["missing"]:
        blockers.append("baseline_clean_negative_surface_missing")

    report = {
        "run_name": cfg["run_name"],
        "candidate_weights": str(weights),
        "baseline_weights": str(baseline),
        "prepare_report": str(prepare_report_path),
        "surfaces": {
            "machine_val": {"candidate": candidate_val, "baseline": baseline_val},
            "machine_holdout": {"candidate": candidate_holdout, "baseline": baseline_holdout},
            "locked_test": {"candidate": candidate_locked, "baseline": baseline_locked, "per_class_regressions": locked_regressions},
            "clean_negative": {"candidate": candidate_negatives, "baseline": baseline_negatives},
            "gate_replay": {"candidate": candidate_gate, "baseline": baseline_gate},
        },
        "gates": gates,
        "gate_blockers": sorted(set(blockers)),
    }
    write_json(report_path(cfg, "evaluation_report.json"), report)
    log_event(cfg, "completed evaluation surfaces", status="VALIDATING", blockers=len(report["gate_blockers"]))
    write_status(cfg, "STOPPED", step="evaluate", detail=f"evaluation completed with {len(report['gate_blockers'])} gate blockers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
