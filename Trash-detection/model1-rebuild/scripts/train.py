r"""Phase G (refactor v2) — train YOLOv8n-OBB, 2 classes: bottle + aluminum.

Fast + anti-overfit config (owner directive 2026-08-22): the v1 model overfit
with 150 epochs on partially-annotated data. v2 changes:
  - clean 2-class data (dataset-2 excluded; every appearance annotated)
  - fewer epochs (80), patience 20, cosine LR — stop when val stops improving
  - single seed (42); the 2-seed stability check is not worth 2x time here
  - kept: imgsz 640 train, AdamW, deterministic, flipud 0.0, mosaic + closeMosaic

Usage:
  python scripts/train.py --seed 42
  (smoke: --epochs 1 --imgsz 320 --fraction 0.03 --name smoke_test)
"""
from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--epochs", type=int, default=80)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--fraction", type=float, default=1.0,
                    help="use only a fraction of train data (smoke tests)")
    ap.add_argument("--data", default=str(ROOT / "dataset" / "dataset.yaml"))
    ap.add_argument("--name", default=None)
    args = ap.parse_args()

    model = YOLO("yolov8n-obb.pt")  # auto-downloads pretrained weights on first run
    model.train(
        data=args.data,
        epochs=args.epochs,
        patience=20,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        fraction=args.fraction,
        optimizer="AdamW",
        cos_lr=True,
        seed=args.seed,
        deterministic=True,
        flipud=0.0,          # bottles/cans stay upright in the bin
        mosaic=1.0,
        close_mosaic=10,
        project=str(ROOT / "runs"),
        name=args.name or f"seed{args.seed}_n{args.imgsz}",
        exist_ok=True,
    )
    print(f"done -> runs/{args.name or f'seed{args.seed}_n{args.imgsz}'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
