r"""Model 2 v3 — train YOLOv8n-OBB, 3 classes: cap / label / ring.

4h budget on RTX 3060 12GB (owner, 2026-08-23):
  imgsz 640, batch 24, epochs 200, patience 50, AdamW + cosine.
GPU is for TRAINING only; Jetson deploy uses ONNX @416 (see export_onnx.py).

Usage:
  python scripts/train.py --seed 42
  (smoke: --epochs 1 --imgsz 320 --fraction 0.05 --workers 0 --name smoke_m2v3)
"""
from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--epochs", type=int, default=200)
    ap.add_argument("--patience", type=int, default=50)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=24)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--fraction", type=float, default=1.0)
    ap.add_argument("--close-mosaic", type=int, default=20)
    ap.add_argument("--data", default=str(ROOT / "dataset" / "dataset.yaml"))
    ap.add_argument("--weights", default="yolov8n-obb.pt",
                    help="start weights; runs/m2v3_seed42_n640/weights/best.pt for fine-tune")
    ap.add_argument("--lr0", type=float, default=None, help="override initial LR (fine-tune ~0.001)")
    ap.add_argument("--degrees", type=float, default=0.0,
                    help="rotation augmentation (90 for orientation fine-tune)")
    ap.add_argument("--flipud", type=float, default=0.0)
    ap.add_argument("--fliplr", type=float, default=0.5)
    ap.add_argument("--name", default=None)
    args = ap.parse_args()

    name = args.name or f"m2v3_seed{args.seed}_n{args.imgsz}"
    model = YOLO(args.weights)
    kwargs = dict(
        data=args.data,
        epochs=args.epochs,
        patience=args.patience,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        fraction=args.fraction,
        optimizer="AdamW",
        cos_lr=True,
        seed=args.seed,
        deterministic=True,
        degrees=args.degrees,
        flipud=args.flipud,
        fliplr=args.fliplr,
        mosaic=1.0,
        close_mosaic=args.close_mosaic,
        project=str(ROOT / "runs"),
        name=name,
        exist_ok=False,
    )
    if args.lr0 is not None:
        kwargs["lr0"] = args.lr0
    model.train(**kwargs)
    print(f"done -> runs/{name}/weights/best.pt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
