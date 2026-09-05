"""Evaluate candidate and baseline metrics, then apply fail-closed gates."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from m1_rvm_common import CLASS_NAMES, atomic_json_dump, load_config, model_root, run_id


def _metric_value(metrics: dict[str, Any], name: str, class_name: str) -> float | None:
    per_class = metrics.get("per_class", {}).get(class_name, {})
    if name in per_class:
        return float(per_class[name])
    return None


def apply_gates(config: dict, baseline: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    evaluation = config["evaluation"]
    failures: list[str] = []
    rows: dict[str, dict[str, Any]] = {}
    for class_name in CLASS_NAMES.values():
        row = {}
        for metric_name in ("precision", "recall"):
            current = _metric_value(candidate, metric_name, class_name)
            previous = _metric_value(baseline, metric_name, class_name)
            row[metric_name] = {"baseline": previous, "candidate": current}
            if current is None or current < float(evaluation[f"minimum_per_class_{metric_name}"]):
                failures.append(f"{class_name} {metric_name} below minimum")
            if previous is not None and current is not None and current - previous < -float(evaluation["maximum_class_regression"]):
                failures.append(f"{class_name} {metric_name} regressed beyond allowed threshold")
        rows[class_name] = row
    baseline_macro = baseline.get("macro", {}).get("f1")
    candidate_macro = candidate.get("macro", {}).get("f1")
    if baseline_macro is None or candidate_macro is None:
        failures.append("macro F1 comparison is missing")
    elif baseline_macro < 0.95 and candidate_macro - baseline_macro < float(evaluation["minimum_macro_improvement"]):
        failures.append("macro F1 did not improve by the required amount")
    for gate_name in ("cross_confusion", "bright_dim", "empty_machine", "legacy_regression", "temporal_replay"):
        if not candidate.get("gates", {}).get(gate_name, False):
            failures.append(f"gate not satisfied: {gate_name}")
    return {"status": "PASS" if not failures else "FAIL", "failures": failures, "per_class": rows}


def evaluate(config: dict, run_name: str, baseline_path: Path | None = None, candidate_path: Path | None = None) -> dict[str, Any]:
    root = model_root()
    report_root = root / "logs" / "rvm" / run_name
    report_root.mkdir(parents=True, exist_ok=True)
    if baseline_path is None:
        baseline_path = report_root / "baseline_metrics.json"
    if candidate_path is None:
        candidate_path = report_root / "candidate_metrics.json"
    if not baseline_path.exists() or not candidate_path.exists():
        report = {
            "schema": "m1-rvm-evaluation-v1",
            "run_id": run_name,
            "status": "UNVERIFIED",
            "blocking_reasons": ["baseline_metrics.json and candidate_metrics.json are both required before promotion"],
            "baseline_path": str(baseline_path),
            "candidate_path": str(candidate_path),
        }
        atomic_json_dump(report_root / "evaluation_report.json", report)
        return report
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
    gates = apply_gates(config, baseline, candidate)
    report = {"schema": "m1-rvm-evaluation-v1", "run_id": run_name, **gates}
    atomic_json_dump(report_root / "evaluation_report.json", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path)
    parser.add_argument("--run-id")
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--candidate", type=Path)
    args = parser.parse_args()
    config = load_config(args.config)
    report = evaluate(config, args.run_id or run_id(config), args.baseline, args.candidate)
    print(f"EVALUATION_STATUS={report['status']}")
    print(f"EVALUATION_REPORT={model_root() / 'logs' / 'rvm' / report['run_id'] / 'evaluation_report.json'}")
    return 0 if report["status"] == "PASS" else 4


if __name__ == "__main__":
    raise SystemExit(main())
