from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path
from typing import Any

import cv2
from ultralytics import YOLO

from live_finetune_common import canonical_names, load_config, report_path, sha256_file, workflow_paths, write_json, write_status
from promote_m2_candidate import export_candidate, finite_onnx_outputs, parity_report


def benchmark(model_path: Path, images: list[Path], imgsz: int) -> dict[str, Any]:
    model = YOLO(str(model_path), task="obb")
    usable = [item for item in images if cv2.imread(str(item)) is not None]
    for image_path in usable[:3]:
        model.predict(cv2.imread(str(image_path)), imgsz=imgsz, conf=0.10, device="cpu", verbose=False)
    samples = []
    for image_path in usable:
        image = cv2.imread(str(image_path))
        start = time.perf_counter()
        model.predict(image, imgsz=imgsz, conf=0.10, device="cpu", verbose=False)
        samples.append((time.perf_counter() - start) * 1000.0)
    if not samples:
        return {"image_count": 0, "p50_ms": None, "p95_ms": None}
    samples.sort()
    p50 = samples[len(samples) // 2]
    p95 = samples[min(len(samples) - 1, int(len(samples) * 0.95))]
    return {"image_count": len(samples), "p50_ms": round(p50, 3), "p95_ms": round(p95, 3), "all_ms": [round(value, 3) for value in samples]}


def main() -> int:
    parser = argparse.ArgumentParser(description="Export and validate a PC-only Model 2 edge candidate.")
    parser.add_argument("--config", required=True)
    parser.add_argument("--run", default=None)
    parser.add_argument("--weights", default=None)
    args = parser.parse_args()

    cfg = load_config(args.config, run_name_override=args.run)
    names = canonical_names(cfg)
    weights = Path(args.weights) if args.weights else Path(cfg["_resolved"]["model2_root"]) / "runs" / cfg["run_name"] / "weights" / "best.pt"
    if not weights.is_file():
        write_status(cfg, "CRASHED", step="export", detail=f"candidate weights not found: {weights}")
        return 1
    candidate_root = workflow_paths(cfg)["candidate_export_root"]
    onnx_dir = candidate_root / "onnx_640"
    write_status(cfg, "EXPORTING", step="export", candidate_weights=str(weights))
    exported = export_candidate(weights, onnx_dir, int(cfg["training"]["imgsz"]), names)
    finite = finite_onnx_outputs(Path(exported["model"]))
    parity = parity_report(
        weights,
        Path(exported["model"]),
        imgsz=int(cfg["training"]["imgsz"]),
        cfg=cfg,
        iou_min=float(cfg["evaluation"]["pc_polygon_iou_min"]),
        conf_tolerance=float(cfg["evaluation"]["pc_conf_tolerance"]),
    )

    generated_root = workflow_paths(cfg)["generated_root"]
    holdout_images = sorted((generated_root / "splits" / "live" / "holdout" / "images").glob("*"))
    active_onnx = cfg["_resolved"]["promotion"]["pc_package_dir"] / "m2_obb_640.onnx"
    baseline_latency = benchmark(active_onnx, holdout_images, int(cfg["training"]["imgsz"]))
    candidate_latency = benchmark(Path(exported["model"]), holdout_images, int(cfg["training"]["imgsz"]))
    if baseline_latency.get("p95_ms") and candidate_latency.get("p95_ms"):
        latency_ratio = candidate_latency["p95_ms"] / baseline_latency["p95_ms"]
    else:
        latency_ratio = None
    latency_ok = latency_ratio is not None and latency_ratio <= 1.0 + float(cfg["evaluation"]["cpu_latency_regression_max"])

    pc_config_path = cfg["_resolved"]["detection_root"] / "pc-demo" / "config" / "edge_candidate.json"
    default_path = pc_config_path.parent / "default.json"
    runtime_cfg = json.loads(default_path.read_text(encoding="utf-8"))
    runtime_cfg["m2"]["path"] = f"../training/model2/export/candidates/{cfg['run_name']}/onnx_640/model.onnx"
    runtime_cfg["m2"]["candidate_only"] = True
    runtime_cfg["m2"]["candidate_run"] = cfg["run_name"]
    runtime_cfg["m2"]["candidate_sha256"] = exported["sha256"]
    pc_config_path.write_text(json.dumps(runtime_cfg, indent=2) + "\n", encoding="utf-8")

    evaluation_path = report_path(cfg, "edge_evaluation_report.json")
    evaluation = json.loads(evaluation_path.read_text(encoding="utf-8")) if evaluation_path.is_file() else {}
    export_gates = {
        "onnx_finite_outputs": bool(finite["finite_outputs"]),
        "pc_parity": bool(parity["passed"]),
        "cpu_latency_regression_ok": latency_ok,
    }
    export_blockers = [name for name, passed in export_gates.items() if not passed]
    report = {
        "run_name": cfg["run_name"],
        "candidate_weights": str(weights),
        "candidate_export_root": str(candidate_root),
        "onnx_640": exported,
        "onnx_validation": finite,
        "pc_parity": parity,
        "cpu_benchmark": {"baseline_active": baseline_latency, "candidate": candidate_latency, "p95_ratio": latency_ratio},
        "export_gates": export_gates,
        "export_blockers": export_blockers,
        "pc_test_config": str(pc_config_path),
        "production_ready": bool(evaluation.get("production_ready", False)) and not export_blockers,
        "promotion": "candidate_only",
        "production_modified": False,
        "jetson_modified": False,
    }
    write_json(report_path(cfg, "edge_export_report.json"), report)
    if evaluation_path.is_file():
        evaluation["export"] = report
        evaluation["production_ready"] = bool(evaluation.get("production_ready", False)) and not export_blockers
        write_json(evaluation_path, evaluation)
    write_status(cfg, "STOPPED", step="export", detail=f"PC candidate export completed with {len(export_blockers)} export blockers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
