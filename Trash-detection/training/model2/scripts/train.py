r"""Model 2 v4 — fine-tune YOLOv8n-OBB for 3 classes: cap / label / ring.

Usage:
  python scripts/train.py --name m2v4_caplabel_seed42_n640 --weights runs/m2v3_seed42_n640/weights/best.pt --epochs 80 --lr0 0.001
  (smoke: python scripts/train.py --name smoke_m2v4 --epochs 1 --imgsz 320 --fraction 0.05)
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
    ap.add_argument("--patience", type=int, default=25)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=24)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--fraction", type=float, default=1.0)
    ap.add_argument("--close-mosaic", type=int, default=10)
    ap.add_argument("--data", default=str(ROOT / "dataset" / "dataset.yaml"))
    ap.add_argument("--weights", default="runs/m2v3_seed42_n640/weights/best.pt",
                    help="start weights (fine-tune from m2v3 baseline or yolov8n-obb.pt)")
    ap.add_argument("--lr0", type=float, default=0.001, help="initial learning rate for fine-tuning")
    ap.add_argument("--degrees", type=float, default=0.0)
    ap.add_argument("--flipud", type=float, default=0.0)
    ap.add_argument("--fliplr", type=float, default=0.5)
    ap.add_argument("--name", default="m2v4_caplabel_seed42_n640")
    args = ap.parse_args()

    # Fallback to yolov8n-obb.pt if specified weights don't exist
    weights_path = Path(args.weights)
    if not weights_path.is_file() and not Path(ROOT / args.weights).is_file():
        if Path("yolov8n-obb.pt").is_file():
            print(f"[WARN] {args.weights} not found, falling back to yolov8n-obb.pt")
            weights_path = Path("yolov8n-obb.pt")
        elif Path(ROOT / "yolov8n-obb.pt").is_file():
            weights_path = Path(ROOT / "yolov8n-obb.pt")
        else:
            weights_path = Path("yolov8n-obb.pt")

    model = YOLO(str(weights_path))
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
        name=args.name,
        exist_ok=True,
    )
    if args.lr0 is not None:
        kwargs["lr0"] = args.lr0
    model.train(**kwargs)
    print(f"done -> runs/{args.name}/weights/best.pt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
