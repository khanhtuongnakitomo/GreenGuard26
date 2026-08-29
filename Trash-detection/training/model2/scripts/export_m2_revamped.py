from __future__ import annotations

import argparse
import json
from pathlib import Path

from live_finetune_common import load_config, report_path, sha256_file, workflow_paths, write_json, write_status
from promote_m2_candidate import (
    export_candidate,
    finite_onnx_outputs,
    parity_report,
    stage_package,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Export and stage the selected revamped Model 2 candidate.")
    parser.add_argument("--config", default="config/m2_revamped.yaml")
    parser.add_argument("--dataset-run", required=True)
    args = parser.parse_args()

    cfg = load_config(args.config, run_name_override=args.dataset_run)
    evaluation_path = report_path(cfg, "revamped_evaluation_report.json")
    if not evaluation_path.is_file():
        write_status(cfg, "CRASHED", step="export", detail="revamped evaluation report is missing")
        return 1
    evaluation = json.loads(evaluation_path.read_text(encoding="utf-8"))
    weights = Path(evaluation["selected_weights"])
    if not weights.is_file():
        write_status(cfg, "CRASHED", step="export", detail=f"selected weights are missing: {weights}")
        return 1

    paths = workflow_paths(cfg)
    candidate_root = paths["candidate_export_root"]
    candidate_root.mkdir(parents=True, exist_ok=True)
    labels = list(cfg["canonical_names"])
    artifacts = {}
    for imgsz in (640, 416):
        out_dir = candidate_root / f"onnx_{imgsz}"
        artifact = export_candidate(weights, out_dir, imgsz, labels)
        artifact["validation"] = finite_onnx_outputs(out_dir / "model.onnx")
        artifact["parity"] = parity_report(
            weights,
            out_dir / "model.onnx",
            imgsz=imgsz,
            cfg=cfg,
            iou_min=float(cfg["evaluation"]["pc_polygon_iou_min"] if imgsz == 640 else cfg["evaluation"]["jetson_polygon_iou_min"]),
            conf_tolerance=float(cfg["evaluation"]["pc_conf_tolerance"]) if imgsz == 640 else None,
        )
        artifacts[str(imgsz)] = artifact

    stage_root = paths["logs_root"] / "candidate_package"
    provenance = {
        "workflow": "m2_revamped",
        "dataset_run": cfg["run_name"],
        "selected_stage": evaluation["selected_stage"],
        "weights": str(weights),
        "weights_sha256": sha256_file(weights, upper=True),
        "evaluation_report": str(evaluation_path),
    }
    package = stage_package(cfg, candidate_root, provenance, stage_root)
    report = {
        "run_name": cfg["run_name"],
        "selected_stage": evaluation["selected_stage"],
        "selected_weights": str(weights),
        "selected_weights_sha256": sha256_file(weights, upper=True),
        "candidate_export_root": str(candidate_root),
        "artifacts": artifacts,
        "staged_package": package,
        "production_ready": bool(evaluation.get("production_ready", False)),
        "automated_gates_passed": bool(evaluation.get("automated_gates_passed", all(evaluation.get("selected_gates", {}).values()))),
        "manual_machine_acceptance": bool(evaluation.get("manual_machine_acceptance", False)),
        "manual_acceptance_reason": evaluation.get("manual_acceptance_reason"),
        "production_blockers": evaluation.get("production_blockers", []),
        "production_modified": False,
        "promotion": evaluation.get("promotion", "not_requested_and_not_performed"),
    }
    write_json(report_path(cfg, "revamped_export_report.json"), report)
    write_status(cfg, "STOPPED", step="export", detail="candidate exports and staged package complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
