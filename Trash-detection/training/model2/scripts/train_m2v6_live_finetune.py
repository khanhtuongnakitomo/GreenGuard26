from __future__ import annotations

import argparse
import csv
import os
import time
from pathlib import Path
from typing import Any

import torch
from ultralytics import YOLO

from live_finetune_common import (
    load_config,
    log_event,
    report_path,
    verify_baseline_checkpoint,
    workflow_paths,
    write_json,
    write_status,
)


def read_results(results_csv: Path) -> list[dict[str, Any]]:
    if not results_csv.is_file():
        return []
    with results_csv.open("r", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    return [{key.strip(): value for key, value in row.items()} for row in rows]


def final_epoch(rows: list[dict[str, Any]]) -> int:
    return len(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=None)
    parser.add_argument("--run", default=None)
    parser.add_argument("--name", default=None)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--device", default="0")
    args = parser.parse_args()

    requested_run_name = args.run or args.name
    cfg = load_config(args.config, run_name_override=requested_run_name)
    paths = workflow_paths(cfg)
    dataset_yaml = paths["generated_root"] / "dataset.yaml"
    if not dataset_yaml.is_file():
        write_status(cfg, "CRASHED", step="train", detail=f"missing prepared dataset yaml: {dataset_yaml}")
        return 1

    baseline_ok, baseline = verify_baseline_checkpoint(cfg)
    if not baseline_ok:
        write_json(report_path(cfg, "train_failure.json"), {"baseline": baseline})
        write_status(cfg, "CRASHED", step="train", detail="baseline checkpoint missing or hash mismatch")
        return 1

    if not torch.cuda.is_available():
        write_status(cfg, "CRASHED", step="train", detail="CUDA GPU is required for the live fine-tune workflow")
        return 1

    train_cfg = dict(cfg["training"])
    run_name = cfg["run_name"]
    if args.smoke and not run_name.endswith("_smoke"):
        run_name = f"{run_name}_smoke"
        train_cfg["epochs"] = 1
        train_cfg["batch"] = min(int(train_cfg["batch"]), 8)
        train_cfg["imgsz"] = 320
        train_cfg["time_hours"] = 0.0
        train_cfg["patience"] = 1
        train_cfg["fraction"] = 0.10

    requested_time_hours = float(train_cfg["time_hours"])
    effective_time_hours = 0.0 if requested_time_hours > 0 and int(train_cfg["epochs"]) > 0 else requested_time_hours

    run_dir = Path(cfg["_resolved"]["model2_root"]) / "runs" / run_name
    results_csv = run_dir / "results.csv"
    last_pt = run_dir / "weights" / "last.pt"
    best_pt = run_dir / "weights" / "best.pt"

    start_time = time.time()
    write_status(
        cfg,
        "RUNNING",
        step="train",
        trainer_pid=os.getpid(),
        target_epochs=int(train_cfg["epochs"]),
        dataset_yaml=str(dataset_yaml),
        resume=bool(args.resume),
    )
    log_event(cfg, f"starting training run {run_name}", status="RUNNING", trainer_pid=os.getpid())
    if requested_time_hours > 0 and effective_time_hours == 0.0:
        log_event(
            cfg,
            "ignoring configured time_hours because Ultralytics time budgets override fixed epoch training",
            requested_time_hours=requested_time_hours,
            effective_time_hours=effective_time_hours,
            target_epochs=int(train_cfg["epochs"]),
        )

    if args.resume and last_pt.is_file():
        model = YOLO(str(last_pt))
        model.train(resume=True)
    else:
        model = YOLO(str(cfg["_resolved"]["baseline_checkpoint"]))
        model.train(
            data=str(dataset_yaml),
            project=str(Path(cfg["_resolved"]["model2_root"]) / "runs"),
            name=run_name,
            epochs=int(train_cfg["epochs"]),
            time=(effective_time_hours if effective_time_hours > 0 else None),
            patience=int(train_cfg["patience"]),
            imgsz=int(train_cfg["imgsz"]),
            batch=int(train_cfg["batch"]),
            workers=int(train_cfg["workers"]),
            fraction=float(train_cfg["fraction"]),
            cache=train_cfg["cache"],
            optimizer=train_cfg["optimizer"],
            lr0=float(train_cfg["lr0"]),
            seed=int(train_cfg["seed"]),
            save_period=int(train_cfg["save_period"]),
            deterministic=False,
            multi_scale=False,
            cos_lr=True,
            degrees=4.0,
            translate=0.03,
            scale=0.08,
            shear=0.5,
            perspective=0.0,
            fliplr=0.15,
            flipud=0.0,
            hsv_h=0.008,
            hsv_s=0.25,
            hsv_v=0.25,
            mosaic=0.20,
            close_mosaic=int(train_cfg["close_mosaic"]),
            mixup=0.0,
            copy_paste=0.0,
            device=args.device,
            exist_ok=True,
            save=True,
            plots=False,
        )

    duration_seconds = time.time() - start_time
    rows = read_results(results_csv)
    epoch_count = final_epoch(rows)
    if not best_pt.is_file():
        write_json(
            report_path(cfg, "train_failure.json"),
            {
                "run_name": run_name,
                "duration_seconds": round(duration_seconds, 3),
                "epochs_completed": epoch_count,
                "results_csv": str(results_csv),
            },
        )
        write_status(cfg, "CRASHED", step="train", detail="training finished without best.pt")
        return 1

    if epoch_count < int(train_cfg["epochs"]):
        terminal_state = "TIME_LIMITED" if duration_seconds >= (effective_time_hours * 3600.0 * 0.95) and effective_time_hours > 0 else "EARLY_STOPPED"
    else:
        terminal_state = "STOPPED"

    report = {
        "run_name": run_name,
        "best_weights": str(best_pt),
        "last_weights": str(last_pt) if last_pt.is_file() else None,
        "results_csv": str(results_csv),
        "duration_seconds": round(duration_seconds, 3),
        "duration_hours": round(duration_seconds / 3600.0, 4),
        "epochs_completed": epoch_count,
        "target_epochs": int(train_cfg["epochs"]),
        "requested_time_hours": requested_time_hours,
        "effective_time_hours": effective_time_hours,
        "terminal_state": terminal_state,
    }
    write_json(report_path(cfg, "train_report.json"), report)
    write_status(cfg, terminal_state, step="train", detail=f"training finished after {epoch_count} epochs", run_name=run_name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
