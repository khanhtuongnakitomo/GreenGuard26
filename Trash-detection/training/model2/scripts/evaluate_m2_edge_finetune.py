from __future__ import annotations

import argparse
import json
import shutil
import tempfile
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import yaml

from evaluate_m2v6_live_finetune import (
    class_keys,
    clean_negative_eval,
    compare_locked_test,
    create_surface_yaml,
    evaluate_surface,
    gate_replay,
    read_gate_sequences,
)
from live_finetune_common import canonical_names, load_config, report_path, workflow_paths, write_json, write_status


def metric(surface: dict[str, Any], class_name: str, key: str) -> float | None:
    value = surface.get("classes", {}).get(class_name, {}).get(key)
    return None if value is None else float(value)


def create_stress_surface(cfg: dict[str, Any], generated_root: Path) -> Path:
    source_images = generated_root / "splits" / "live" / "holdout" / "images"
    source_labels = generated_root / "splits" / "live" / "holdout" / "labels"
    stress_root = generated_root / "surfaces" / "stress"
    if stress_root.exists():
        shutil.rmtree(stress_root)
    image_dir = stress_root / "images"
    label_dir = stress_root / "labels"
    image_dir.mkdir(parents=True, exist_ok=True)
    label_dir.mkdir(parents=True, exist_ok=True)
    for index, image_path in enumerate(sorted(source_images.iterdir())):
        if image_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
            continue
        image = cv2.imread(str(image_path))
        if image is None:
            continue
        mode = index % 3
        out = image.astype(np.float32)
        gamma = (0.74, 1.24, 0.92)[mode]
        out = np.power(np.clip(out / 255.0, 0.0, 1.0), gamma) * 255.0
        out = np.clip(out * (0.90 if mode == 0 else 1.06) + (-5 if mode == 0 else 4), 0, 255).astype(np.uint8)
        if mode == 1:
            overlay = out.copy()
            h, w = out.shape[:2]
            cv2.ellipse(overlay, (int(w * 0.62), int(h * 0.30)), (int(w * 0.14), int(h * 0.09)), -24, 0, 360, (255, 255, 255), -1)
            out = cv2.addWeighted(overlay, 0.11, out, 0.89, 0)
        if mode == 2:
            rng = np.random.default_rng(1000 + index)
            noise = rng.normal(0.0, 4.0, out.shape)
            out = np.clip(out.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        target_name = f"stress_{index:03d}_{image_path.stem}.jpg"
        cv2.imwrite(str(image_dir / target_name), out, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
        shutil.copy2(source_labels / f"{image_path.stem}.txt", label_dir / f"{Path(target_name).stem}.txt")
    yaml_path = stress_root / "data.yaml"
    yaml_path.write_text(
        yaml.safe_dump(
            {
                "path": str(stress_root.resolve()),
                "train": "images",
                "val": "images",
                "test": "images",
                "names": {index: name for index, name in enumerate(canonical_names(cfg))},
            },
            sort_keys=False,
        ),
        encoding="utf-8",
    )
    return yaml_path


def recall_regressions(baseline: dict[str, Any], candidate: dict[str, Any], names: list[str]) -> dict[str, float | None]:
    out: dict[str, float | None] = {}
    for name in names:
        base = metric(baseline, name, "recall")
        cand = metric(candidate, name, "recall")
        out[name] = None if base is None or cand is None else round(cand - base, 6)
    return out


def non_regression_gate(baseline: dict[str, Any], candidate: dict[str, Any], names: list[str], max_drop: float, key: str) -> tuple[bool, dict[str, float | None]]:
    differences: dict[str, float | None] = {}
    passed = True
    for name in names:
        base = metric(baseline, name, key)
        cand = metric(candidate, name, key)
        differences[name] = None if base is None or cand is None else round(cand - base, 6)
        if differences[name] is None or differences[name] < -max_drop:
            passed = False
    return passed, differences


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--run", default=None)
    parser.add_argument("--weights", default=None)
    parser.add_argument("--device", default="0")
    args = parser.parse_args()

    cfg = load_config(args.config, run_name_override=args.run)
    generated_root = workflow_paths(cfg)["generated_root"]
    prepare_path = report_path(cfg, "prepare_report.json")
    if not prepare_path.is_file():
        write_status(cfg, "CRASHED", step="evaluate", detail="prepare_report.json is missing")
        return 1
    prepare = json.loads(prepare_path.read_text(encoding="utf-8"))
    weights = Path(args.weights) if args.weights else Path(cfg["_resolved"]["model2_root"]) / "runs" / cfg["run_name"] / "weights" / "best.pt"
    baseline = cfg["_resolved"]["baseline_checkpoint"]
    if not weights.is_file():
        write_status(cfg, "CRASHED", step="evaluate", detail=f"candidate weights not found: {weights}")
        return 1
    names = canonical_names(cfg)
    batch = int(cfg["training"]["val_batch"])
    imgsz = int(cfg["training"]["imgsz"])
    write_status(cfg, "VALIDATING", step="evaluate", candidate_weights=str(weights))

    edge_val = generated_root / "live_val.yaml"
    edge_holdout = generated_root / "live_holdout.yaml"
    locked = create_surface_yaml(Path(cfg["_resolved"]["model2_root"]) / "dataset", "test_locked/images", names)
    surfaces: dict[str, Any] = {}
    for label, surface_yaml in (("edge_val", edge_val), ("edge_holdout", edge_holdout), ("locked_test", locked)):
        candidate = evaluate_surface(weights, surface_yaml, imgsz, batch, args.device, names)
        base = evaluate_surface(baseline, surface_yaml, imgsz, batch, args.device, names)
        surfaces[label] = {"candidate": candidate, "baseline": base}

    previous = cfg["evaluation"]
    previous_paths = {
        "previous_machine_val": Path(cfg["_resolved"]["model2_root"]) / previous["previous_machine_val_yaml"],
        "previous_machine_holdout": Path(cfg["_resolved"]["model2_root"]) / previous["previous_machine_holdout_yaml"],
    }
    for label, surface_yaml in previous_paths.items():
        if not surface_yaml.is_file():
            surfaces[label] = {"missing": True, "path": str(surface_yaml)}
            continue
        surfaces[label] = {
            "candidate": evaluate_surface(weights, surface_yaml, imgsz, batch, args.device, names),
            "baseline": evaluate_surface(baseline, surface_yaml, imgsz, batch, args.device, names),
            "path": str(surface_yaml),
        }

    stress_yaml = create_stress_surface(cfg, generated_root)
    surfaces["stress"] = {
        "candidate": evaluate_surface(weights, stress_yaml, imgsz, batch, args.device, names),
        "baseline": evaluate_surface(baseline, stress_yaml, imgsz, batch, args.device, names),
        "path": str(stress_yaml),
    }
    surfaces["clean_negative"] = {
        "candidate": clean_negative_eval(weights, cfg),
        "baseline": clean_negative_eval(baseline, cfg),
    }
    sequences = read_gate_sequences(generated_root)
    surfaces["gate_replay"] = {
        "candidate": gate_replay(weights, sequences, cfg),
        "baseline": gate_replay(baseline, sequences, cfg),
    }

    edge_candidate = surfaces["edge_holdout"]["candidate"]
    edge_baseline = surfaces["edge_holdout"]["baseline"]
    edge_recall_delta = recall_regressions(edge_baseline, edge_candidate, names)
    edge_class_non_regression, edge_class_deltas = non_regression_gate(
        edge_baseline, edge_candidate, names, float(previous["edge_max_per_class_recall_drop"]), "recall"
    )
    prev_gates = {}
    prev_diffs = {}
    for label in ("previous_machine_val", "previous_machine_holdout"):
        if surfaces[label].get("missing"):
            prev_gates[label] = False
            prev_diffs[label] = None
        else:
            prev_gates[label], prev_diffs[label] = non_regression_gate(
                surfaces[label]["baseline"], surfaces[label]["candidate"], names,
                float(previous["previous_machine_max_per_class_regression"]), "mAP50"
            )
    locked_ok, locked_diffs = compare_locked_test(
        surfaces["locked_test"]["baseline"], surfaces["locked_test"]["candidate"],
        float(previous["locked_test_max_per_class_regression"]), names
    )
    negative = surfaces["clean_negative"]
    clean_negative_ok = (
        not negative["candidate"].get("missing") and not negative["baseline"].get("missing")
        and negative["candidate"]["false_reject_rate"] <= negative["baseline"]["false_reject_rate"]
    )
    gate_ok = surfaces["gate_replay"]["candidate"]["positive_reject_rate"] >= surfaces["gate_replay"]["baseline"]["positive_reject_rate"]
    stress_ok = surfaces["stress"]["candidate"]["macro_recall"] >= edge_candidate["macro_recall"] - float(previous["stress_recall_drop_max"])
    gates = {
        "prepare_data_prereqs": not prepare.get("promotion_prereq_failures"),
        "edge_class_recall_non_regression": edge_class_non_regression,
        "edge_macro_recall_improved": edge_candidate["macro_recall"] >= edge_baseline["macro_recall"] + float(previous["edge_macro_recall_improvement"]),
        "edge_ring_recall_improved": (
            metric(edge_candidate, "ring", "recall") is not None and metric(edge_baseline, "ring", "recall") is not None
            and metric(edge_candidate, "ring", "recall") >= metric(edge_baseline, "ring", "recall") + float(previous["edge_ring_recall_improvement"])
        ),
        "locked_test_regression_ok": locked_ok,
        "previous_machine_val_regression_ok": prev_gates["previous_machine_val"],
        "previous_machine_holdout_regression_ok": prev_gates["previous_machine_holdout"],
        "clean_negative_not_worse": clean_negative_ok,
        "gate_replay_preserved": gate_ok,
        "stress_recall_drop_ok": stress_ok,
        "class_coverage_edge_holdout": class_keys(edge_candidate) == set(names),
    }
    blockers = sorted(name for name, passed in gates.items() if not passed)
    report = {
        "run_name": cfg["run_name"],
        "candidate_weights": str(weights),
        "baseline_weights": str(baseline),
        "prepare_report": str(prepare_path),
        "surfaces": surfaces,
        "comparisons": {
            "edge_holdout_recall_delta": edge_recall_delta,
            "edge_holdout_recall_delta_checked": edge_class_deltas,
            "previous_machine_mAP50_delta": prev_diffs,
            "locked_test_mAP50_delta": locked_diffs,
        },
        "gates": gates,
        "gate_blockers": blockers,
        "production_ready": not blockers,
        "promotion": "candidate_only",
        "production_modified": False,
        "jetson_modified": False,
        "edge_negative_surface": {"included": False, "reason": "No reviewed empty-machine edge frames were supplied; existing clean negatives remain a gate."},
    }
    write_json(report_path(cfg, "edge_evaluation_report.json"), report)
    write_status(cfg, "STOPPED", step="evaluate", detail=f"edge evaluation completed with {len(blockers)} blockers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
