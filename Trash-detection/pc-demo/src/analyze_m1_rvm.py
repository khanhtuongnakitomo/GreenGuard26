"""Deterministic, fail-closed threshold analysis for M1 diagnostic sessions."""
from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Any

KNOWN_LABELS = {"metal_can", "pet_bottle", "pp_cup", "empty"}
POSITIVE = ("metal_can", "pet_bottle")
MIN_AREA_FRAC = 0.02
INFER_CONF = 0.05


def threshold_grid() -> list[float]:
    return [float(Decimal("0.20") + Decimal("0.02") * i) for i in range(31)]


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid JSON: {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"expected object: {path}")
    return value


def load_sessions(paths: list[Path]) -> list[dict[str, Any]]:
    """Validate manifests and traces before any metric is calculated."""
    records: list[dict[str, Any]] = []
    seen_frames: set[tuple[str, int]] = set()
    seen_trials: set[tuple[str, str]] = set()
    model_hashes: set[str] = set()
    for path in paths:
        report = _read_json(path / "session_report.json")
        manifest = _read_json(path / "manifest.json")
        report_hash = manifest.get("files", {}).get("session_report.json")
        report_path = path / "session_report.json"
        if report_hash and _sha256(report_path) != str(report_hash).lower():
            raise ValueError(f"session report hash mismatch: {report_path}")
        if report.get("serial_enabled") is not False or manifest.get("serial_enabled") is not False:
            raise ValueError(f"serial must be disabled: {path}")
        label = report.get("label")
        if label not in KNOWN_LABELS:
            raise ValueError(f"unknown ground-truth label {label!r}: {path}")
        model_hash = str(report.get("model_sha256", "")).lower()
        if not model_hash:
            raise ValueError(f"missing model hash: {path}")
        model_hashes.add(model_hash)
        trial_key = (str(report.get("session_id", "")), str(report.get("trial_id", "")))
        if trial_key in seen_trials:
            raise ValueError(f"duplicate trial id: {trial_key}")
        seen_trials.add(trial_key)
        trace_path = path / str(report.get("trace_file", "trace.jsonl"))
        if not trace_path.is_file():
            raise ValueError(f"missing trace file: {trace_path}")
        expected_trace_hash = manifest.get("files", {}).get(trace_path.name)
        if expected_trace_hash and _sha256(trace_path) != str(expected_trace_hash).lower():
            raise ValueError(f"trace hash mismatch: {trace_path}")
        try:
            lines = trace_path.read_text(encoding="utf-8").splitlines()
        except OSError as exc:
            raise ValueError(f"cannot read trace: {trace_path}: {exc}") from exc
        for line_number, line in enumerate(lines, 1):
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"corrupt JSONL {trace_path}:{line_number}: {exc}") from exc
            if not isinstance(row, dict):
                raise ValueError(f"trace row is not an object: {trace_path}:{line_number}")
            frame_key = (str(row.get("session_id", "")), int(row.get("frame_index", -1)))
            if frame_key in seen_frames:
                raise ValueError(f"duplicate session/frame: {frame_key}")
            seen_frames.add(frame_key)
            if row.get("ground_truth_label") != label:
                raise ValueError(f"trace/report label mismatch: {trace_path}:{line_number}")
            if str(row.get("model_sha256", "")).lower() != model_hash:
                raise ValueError(f"mixed model hash within session: {trace_path}:{line_number}")
            if row.get("final_reason") not in {
                "NO_DETECTION", "IGNORED_CLASS_ONLY", "AREA_TOO_SMALL", "BELOW_DECISION_CONF",
                "ACCEPTED_METAL_CAN", "ACCEPTED_PET_BOTTLE",
            }:
                raise ValueError(f"unknown reason: {trace_path}:{line_number}")
            row["_session_path"] = str(path)
            row["_report_label"] = label
            records.append(row)
    if len(model_hashes) > 1:
        raise ValueError("mixed model hashes across sessions")
    if not records:
        raise ValueError("no trace rows found")
    return records


def _sha256(path: Path) -> str:
    import hashlib

    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest().lower()


def _candidate(row: dict[str, Any], threshold: float) -> dict[str, Any] | None:
    selected = row.get("best_visible_candidate")
    if not isinstance(selected, dict):
        return None
    class_name = selected.get("class_name")
    if class_name not in POSITIVE:
        return None
    if float(selected.get("area_frac", 0.0)) < MIN_AREA_FRAC:
        return None
    if float(selected.get("confidence", 0.0)) < threshold:
        return None
    return selected


def evaluate_threshold(records: list[dict[str, Any]], threshold: float) -> dict[str, Any]:
    counts = {name: Counter(tp=0, fp=0, fn=0) for name in POSITIVE}
    confusion = Counter()
    reason_counts = Counter()
    pp_false_positives = 0
    empty_false_positives = 0
    accepted = 0
    rejected = 0
    confidence_by_class: dict[str, list[float]] = {name: [] for name in (*POSITIVE, "pp_cup", "unknown")}
    for row in records:
        label = row["_report_label"]
        reason_counts[row.get("final_reason", "UNKNOWN")] += 1
        for raw in row.get("raw_detections", []):
            class_name = raw.get("class_name", "unknown")
            bucket = class_name if class_name in confidence_by_class else "unknown"
            confidence_by_class[bucket].append(float(raw.get("confidence", 0.0)))
        candidate = _candidate(row, threshold)
        predicted = candidate.get("class_name") if candidate else None
        if predicted:
            accepted += 1
        else:
            rejected += 1
        if label == "pp_cup" and predicted:
            pp_false_positives += 1
        if label == "empty" and predicted:
            empty_false_positives += 1
        if label in POSITIVE:
            for cls in POSITIVE:
                if predicted == cls and label == cls:
                    counts[cls]["tp"] += 1
                elif predicted == cls and label != cls:
                    counts[cls]["fp"] += 1
                elif label == cls and predicted != cls:
                    counts[cls]["fn"] += 1
            if predicted and predicted != label:
                confusion[(label, predicted)] += 1
    metrics = {}
    recalls = []
    precisions = []
    for cls in POSITIVE:
        tp, fp, fn = counts[cls]["tp"], counts[cls]["fp"], counts[cls]["fn"]
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        metrics[cls] = {"tp": tp, "fp": fp, "fn": fn, "precision": precision, "recall": recall}
        precisions.append(precision)
        recalls.append(recall)
    confidence_distribution = {
        name: {
            "count": len(values),
            "min": min(values) if values else None,
            "max": max(values) if values else None,
            "mean": sum(values) / len(values) if values else None,
        }
        for name, values in confidence_by_class.items()
    }
    return {
        "decision_conf": round(float(threshold), 2),
        "infer_conf": INFER_CONF,
        "min_area_frac": MIN_AREA_FRAC,
        "per_class": metrics,
        "macro_precision": sum(precisions) / len(precisions),
        "macro_recall": sum(recalls) / len(recalls),
        "macro_f1": sum(
            2 * metrics[c]["precision"] * metrics[c]["recall"] / (metrics[c]["precision"] + metrics[c]["recall"])
            if metrics[c]["precision"] + metrics[c]["recall"] else 0.0
            for c in POSITIVE
        ) / len(POSITIVE),
        "can_pet_confusion": dict(confusion),
        "pp_false_positives": pp_false_positives,
        "empty_false_positives": empty_false_positives,
        "accepted_frames": accepted,
        "rejected_frames": rejected,
        "frame_denominator": len(records),
        "trial_denominator": len({(r.get("session_id"), r.get("trial_id")) for r in records}),
        "rejection_reason_distribution": dict(sorted(reason_counts.items())),
        "confidence_distributions": confidence_distribution,
    }


def select_threshold(results: list[dict[str, Any]]) -> dict[str, Any] | None:
    safe = [
        result for result in results
        if result["pp_false_positives"] == 0
        and result["empty_false_positives"] == 0
        and all(result["per_class"][cls]["precision"] >= 0.95 for cls in POSITIVE)
    ]
    if not safe:
        return None
    return max(safe, key=lambda result: (result["macro_recall"], result["decision_conf"]))


def analyze(paths: list[Path], untouched_paths: list[Path] | None = None) -> dict[str, Any]:
    records = load_sessions(paths)
    results = [evaluate_threshold(records, threshold) for threshold in threshold_grid()]
    selected = select_threshold(results)
    untouched = None
    if untouched_paths:
        untouched_records = load_sessions(untouched_paths)
        untouched = evaluate_threshold(untouched_records, selected["decision_conf"]) if selected else None
    return {
        "schema_version": "m1-rvm-threshold-analysis-v1",
        "status": "SAFE_THRESHOLD" if selected else "NO_SAFE_THRESHOLD",
        "input_sessions": [str(path) for path in paths],
        "records": len(records),
        "thresholds": results,
        "selected": selected,
        "untouched_validation": untouched,
        "production_config_modified": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze camera-only M1 diagnostic sessions")
    parser.add_argument("--sessions", nargs="+", type=Path, required=True)
    parser.add_argument("--untouched-sessions", nargs="*", type=Path, default=[])
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = analyze([path.resolve() for path in args.sessions], [path.resolve() for path in args.untouched_sessions])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps({"status": result["status"], "selected": result["selected"]}, indent=2))
    return 0 if result["status"] == "SAFE_THRESHOLD" else 2


if __name__ == "__main__":
    raise SystemExit(main())
