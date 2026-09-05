"""Export candidate ONNX artifacts without touching production model paths."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from m1_rvm_common import atomic_json_dump, load_config, model_root, run_id, sha256_file


def export_candidate(config: dict, run_name: str, checkpoint: Path | None = None) -> dict:
    root = model_root()
    candidate_root = root / "export" / "candidates" / run_name
    report_root = root / "logs" / "rvm" / run_name
    report_root.mkdir(parents=True, exist_ok=True)
    candidate_root.mkdir(parents=True, exist_ok=True)
    if checkpoint is None:
        checkpoint = root / "runs" / run_name / "weights" / "best.pt"
    if not checkpoint.exists():
        report = {"schema": "m1-rvm-export-v1", "run_id": run_name, "status": "BLOCKED", "reason": f"missing checkpoint: {checkpoint}"}
        atomic_json_dump(report_root / "export_report.json", report)
        return report
    try:
        from ultralytics import YOLO

        model = YOLO(str(checkpoint))
        artifacts = []
        for size in config["export"]["imgsz"]:
            exported = model.export(
                format=config["export"]["format"],
                imgsz=int(size),
                opset=int(config["export"]["opset"]),
                half=bool(config["export"]["half"]),
                simplify=bool(config["export"]["simplify"]),
                dynamic=False,
            )
            source = Path(exported)
            target = candidate_root / f"m1_rvm_{int(size)}.onnx"
            shutil.copy2(source, target)
            artifacts.append({"path": str(target), "sha256": sha256_file(target), "imgsz": int(size)})
        report = {"schema": "m1-rvm-export-v1", "run_id": run_name, "status": "EXPORTED", "checkpoint": str(checkpoint), "artifacts": artifacts, "production_touched": False}
    except Exception as exc:
        report = {"schema": "m1-rvm-export-v1", "run_id": run_name, "status": "FAILED", "error": repr(exc), "production_touched": False}
    atomic_json_dump(report_root / "export_report.json", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path)
    parser.add_argument("--run-id")
    parser.add_argument("--checkpoint", type=Path)
    args = parser.parse_args()
    config = load_config(args.config)
    report = export_candidate(config, args.run_id or run_id(config), args.checkpoint)
    print(f"EXPORT_STATUS={report['status']}")
    return 0 if report["status"] == "EXPORTED" else 5


if __name__ == "__main__":
    raise SystemExit(main())
