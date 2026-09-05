"""Train a candidate Model 1 checkpoint in an isolated run directory."""

from __future__ import annotations

import argparse
import json
import platform
import subprocess
import sys
import time
from pathlib import Path

from m1_rvm_common import atomic_json_dump, load_config, model_root, run_id, sha256_file


def _gpu_snapshot() -> dict:
    try:
        import torch

        return {
            "cuda_available": bool(torch.cuda.is_available()),
            "device_count": int(torch.cuda.device_count()),
            "device_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
            "torch": torch.__version__,
        }
    except Exception as exc:  # pragma: no cover - diagnostic only
        return {"error": repr(exc)}


def train(config: dict, run_name: str, batch: int | None = None, smoke: bool = False) -> dict:
    root = model_root()
    dataset_root = root / config["data"]["generated_root"] / run_name
    data_yaml = dataset_root / "dataset.yaml"
    checkpoint = root / config["training"]["checkpoint"]
    if not data_yaml.exists():
        raise FileNotFoundError(f"prepared dataset is missing: {data_yaml}")
    if not checkpoint.exists():
        raise FileNotFoundError(f"imported checkpoint is missing: {checkpoint}")
    log_root = root / "logs" / "rvm" / run_name
    log_root.mkdir(parents=True, exist_ok=True)
    report = {
        "schema": "m1-rvm-train-v1",
        "run_id": run_name,
        "status": "RUNNING",
        "started_at_epoch": time.time(),
        "python": sys.version,
        "platform": platform.platform(),
        "gpu": _gpu_snapshot(),
        "checkpoint": str(checkpoint),
        "checkpoint_sha256": sha256_file(checkpoint),
        "dataset_yaml": str(data_yaml),
        "smoke": smoke,
    }
    atomic_json_dump(log_root / "train_report.json", report)
    try:
        from ultralytics import YOLO

        model = YOLO(str(checkpoint))
        train_kwargs = {
            "data": str(data_yaml),
            "task": config["training"]["task"],
            "imgsz": int(config["run"]["image_size"]),
            "epochs": 1 if smoke else int(config["training"]["epochs"]),
            "patience": 1 if smoke else int(config["training"]["patience"]),
            "batch": batch or (2 if smoke else int(config["training"]["batch"])),
            "workers": 0,
            "cache": config["training"]["cache"],
            "optimizer": config["training"]["optimizer"],
            "lr0": float(config["training"]["lr0"]),
            "lrf": float(config["training"]["lrf"]),
            "weight_decay": float(config["training"]["weight_decay"]),
            "warmup_epochs": float(config["training"]["warmup_epochs"]),
            "amp": bool(config["training"]["amp"]),
            "device": config["training"]["device"],
            "pretrained": bool(config["training"]["pretrained"]),
            "seed": int(config["run"]["seed"]),
            "deterministic": True,
            "cos_lr": True,
            "mosaic": 0.0,
            "mixup": 0.0,
            "copy_paste": 0.0,
            "fliplr": 0.0,
            "flipud": 0.0,
            "hsv_h": 0.0,
            "hsv_s": 0.0,
            "hsv_v": 0.0,
            "degrees": 0.0,
            "translate": 0.0,
            "scale": 0.0,
            "shear": 0.0,
            "perspective": 0.0,
            "multi_scale": False,
            "project": str(root / "runs"),
            "name": run_name,
            "exist_ok": False,
            "plots": True,
            "save_period": 1,
        }
        result = model.train(**train_kwargs)
        save_dir = Path(getattr(result, "save_dir", root / "runs" / run_name))
        best = save_dir / "weights" / "best.pt"
        last = save_dir / "weights" / "last.pt"
        report.update({
            "status": "COMPLETED",
            "finished_at_epoch": time.time(),
            "save_dir": str(save_dir),
            "best_checkpoint": str(best) if best.exists() else None,
            "last_checkpoint": str(last) if last.exists() else None,
            "best_sha256": sha256_file(best) if best.exists() else None,
        })
    except Exception as exc:
        report.update({"status": "FAILED", "finished_at_epoch": time.time(), "error": repr(exc)})
        atomic_json_dump(log_root / "train_report.json", report)
        raise
    atomic_json_dump(log_root / "train_report.json", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path)
    parser.add_argument("--run-id")
    parser.add_argument("--batch", type=int)
    parser.add_argument("--smoke", action="store_true")
    args = parser.parse_args()
    config = load_config(args.config)
    report = train(config, args.run_id or run_id(config), batch=args.batch, smoke=args.smoke)
    print(f"TRAIN_STATUS={report['status']}")
    print(f"TRAIN_REPORT={model_root() / 'logs' / 'rvm' / report['run_id'] / 'train_report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
