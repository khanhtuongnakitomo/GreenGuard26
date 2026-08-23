r"""Model 2 — train YOLOv8n-OBB, 3 classes: cap / label / ring.

FAST config (owner budget ~3h total for both models, 2026-08-23):
small dataset (~2k imgs) -> 50 epochs, patience 15, cosine LR, batch 24.
GPU is for TRAINING only; the application runs this model on CPU (ONNX).

Usage:
  python scripts/train.py --seed 42
  (smoke: --epochs 1 --imgsz 320 --fraction 0.05 --workers 0 --name smoke_test)
"""
from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--epochs", type=int, default=50)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=24)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--fraction", type=float, default=1.0)
    ap.add_argument("--data", default=str(ROOT / "dataset" / "dataset.yaml"))
    ap.add_argument("--name", default=None)
    args = ap.parse_args()

    model = YOLO("yolov8n-obb.pt")
    model.train(
        data=args.data,
        epochs=args.epochs,
        patience=15,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        fraction=args.fraction,
        optimizer="AdamW",
        cos_lr=True,
        seed=args.seed,
        deterministic=True,
        flipud=0.0,
        mosaic=1.0,
        close_mosaic=10,
        project=str(ROOT / "runs"),
        name=args.name or f"m2_seed{args.seed}_n{args.imgsz}",
        exist_ok=True,
    )
    print(f"done -> runs/{args.name or f'm2_seed{args.seed}_n{args.imgsz}'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
