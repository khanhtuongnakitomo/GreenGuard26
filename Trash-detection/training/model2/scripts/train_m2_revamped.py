from __future__ import annotations

import argparse
import csv
import time
from pathlib import Path

import torch
from ultralytics import YOLO

from live_finetune_common import (
    load_config,
    report_path,
    sha256_file,
    verify_baseline_checkpoint,
    workflow_paths,
    write_json,
    write_status,
)


def result_rows(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        return []
    with path.open("r", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run one bounded Model 2 revamped training stage.")
    parser.add_argument("--config", default="config/m2_revamped.yaml")
    parser.add_argument("--dataset-run", required=True)
    parser.add_argument("--run", required=True)
    parser.add_argument("--weights", default=None)
    parser.add_argument("--device", default="0")
    parser.add_argument("--batch", type=int, default=None)
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--patience", type=int, default=None)
    parser.add_argument("--lr0", type=float, default=None)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--smoke", action="store_true")
    args = parser.parse_args()

    cfg = load_config(args.config, run_name_override=args.dataset_run)
    generated_root = workflow_paths(cfg)["generated_root"]
    dataset_yaml = generated_root / "dataset.yaml"
    if not dataset_yaml.is_file():
        write_status(cfg, "CRASHED", step="train", detail=f"missing prepared dataset yaml: {dataset_yaml}")
        return 1
    if not torch.cuda.is_available():
        write_status(cfg, "CRASHED", step="train", detail="CUDA GPU is required for full training")
        return 1

    baseline_ok, baseline = verify_baseline_checkpoint(cfg)
    if not baseline_ok:
        write_json(report_path(cfg, f"{args.run}_train_failure.json"), {"baseline": baseline})
        write_status(cfg, "CRASHED", step="train", detail="baseline checkpoint missing or hash mismatch")
        return 1

    train_cfg = dict(cfg["training"])
    if args.run.endswith("_stage_b"):
        train_cfg.update(cfg.get("stage_b", {}))
    if args.batch is not None:
        train_cfg["batch"] = args.batch
    if args.epochs is not None:
        train_cfg["epochs"] = args.epochs
    if args.patience is not None:
        train_cfg["patience"] = args.patience
    if args.lr0 is not None:
        train_cfg["lr0"] = args.lr0
    if args.smoke:
        train_cfg.update({"epochs": 1, "patience": 1, "batch": min(int(train_cfg["batch"]), 8), "imgsz": 320, "fraction": 0.10})

    run_dir = Path(cfg["_resolved"]["model2_root"]) / "runs" / args.run
    results_csv = run_dir / "results.csv"
    best_pt = run_dir / "weights" / "best.pt"
    if run_dir.exists() and not args.resume and results_csv.is_file():
        write_status(cfg, "CRASHED", step="train", detail=f"run already exists; use --resume: {run_dir}")
        return 1

    start_weights = Path(args.weights) if args.weights else Path(cfg["_resolved"]["baseline_checkpoint"])
    if not start_weights.is_file():
        write_status(cfg, "CRASHED", step="train", detail=f"starting checkpoint missing: {start_weights}")
        return 1
    start_time = time.time()
    write_status(cfg, "RUNNING", step=args.run, trainer_pid=__import__("os").getpid(), target_epochs=int(train_cfg["epochs"]))

    model = YOLO(str(start_weights))
    augmentation = {
        "degrees": 3.0,
        "translate": 0.02,
        "scale": 0.06,
        "shear": 0.3,
        "perspective": 0.0,
        "fliplr": 0.10,
        "flipud": 0.0,
        "hsv_h": 0.006,
        "hsv_s": 0.20,
        "hsv_v": 0.20,
        "mosaic": 0.15,
        "mixup": 0.0,
        "copy_paste": 0.0,
    }
    augmentation.update(cfg.get("augmentation", {}))
    train_kwargs = {
        "data": str(dataset_yaml),
        "project": str(Path(cfg["_resolved"]["model2_root"]) / "runs"),
        "name": args.run,
        "epochs": int(train_cfg["epochs"]),
        "patience": int(train_cfg["patience"]),
        "imgsz": int(train_cfg["imgsz"]),
        "batch": int(train_cfg["batch"]),
        "workers": int(train_cfg["workers"]),
        "fraction": float(train_cfg["fraction"]),
        "cache": train_cfg["cache"],
        "optimizer": train_cfg["optimizer"],
        "lr0": float(train_cfg["lr0"]),
        "seed": int(train_cfg["seed"]),
        "save_period": int(train_cfg["save_period"]),
        "deterministic": False,
        "multi_scale": False,
        "cos_lr": True,
        "close_mosaic": int(train_cfg["close_mosaic"]),
        "device": args.device,
        "exist_ok": True,
        "save": True,
        "plots": False,
    }
    train_kwargs.update(augmentation)
    if args.resume:
        model = YOLO(str(run_dir / "weights" / "last.pt"))
        model.train(resume=True)
    else:
        model.train(**train_kwargs)

    rows = result_rows(results_csv)
    report = {
        "run_name": args.run,
        "dataset_run": args.dataset_run,
        "starting_weights": str(start_weights),
        "starting_weights_sha256": sha256_file(start_weights, upper=True),
        "best_weights": str(best_pt),
        "results_csv": str(results_csv),
        "duration_seconds": round(time.time() - start_time, 3),
        "epochs_completed": len(rows),
        "target_epochs": int(train_cfg["epochs"]),
        "training_arguments": train_kwargs,
        "smoke": bool(args.smoke),
        "best_exists": best_pt.is_file(),
    }
    write_json(report_path(cfg, f"{args.run}_train_report.json"), report)
    if not best_pt.is_file():
        write_status(cfg, "CRASHED", step=args.run, detail="training finished without best.pt")
        return 1
    write_status(cfg, "STOPPED", step=args.run, detail=f"training completed with {len(rows)} result rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
