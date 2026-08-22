"""Phase G — train YOLOv8n-OBB (GreenGuard Model 1 rebuild).

Kit config (04-BUILD-PIPELINE Phase G), adapted to OBB:
  model yolov8n-obb.pt (pretrained) · epochs 150 · patience 30 · imgsz 640
  batch 16 · AdamW · deterministic · flipud 0.0 (caps are always up)
  mosaic on · closeMosaic 10 · two seeds: 42 and 7

Usage:
  python scripts/train.py --seed 42
  python scripts/train.py --seed 7
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
    ap.add_argument("--epochs", type=int, default=150)
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
        patience=30,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        fraction=args.fraction,
        optimizer="AdamW",
        seed=args.seed,
        deterministic=True,
        flipud=0.0,          # caps are always up
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
