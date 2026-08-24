r"""Train YOLOv8n-cls for PET vs aluminum on OBB crops (Fix B).

Expects dataset/model1/crops/{train,val}/{pet,can}/ from make_crops.py.

Usage:
  python scripts/train_cls.py
  python scripts/train_cls.py --epochs 1 --fraction 0.05 --name smoke_cls
"""
from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
CROPS = ROOT.parent / "dataset" / "model1" / "crops"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--patience", type=int, default=15)
    ap.add_argument("--imgsz", type=int, default=224)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--fraction", type=float, default=1.0,
                    help="fraction of train data (smoke tests)")
    ap.add_argument("--data", default=str(CROPS))
    ap.add_argument("--name", default=None)
    args = ap.parse_args()

    data = Path(args.data)
    if not (data / "train" / "pet").is_dir():
        print(f"ERROR: missing crops at {data}. Run scripts/make_crops.py first.")
        return 1

    model = YOLO("yolov8n-cls.pt")
    name = args.name or f"cls_pet_can_seed{args.seed}_n{args.imgsz}"
    model.train(
        data=str(data),
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
        # Strong aug for domain gap (webcam-ish variability)
        hsv_h=0.02,
        hsv_s=0.7,
        hsv_v=0.5,
        degrees=20.0,
        translate=0.1,
        scale=0.5,
        shear=5.0,
        perspective=0.0005,
        flipud=0.0,
        fliplr=0.5,
        erasing=0.4,
        auto_augment="randaugment",
        dropout=0.1,
        project=str(ROOT / "runs"),
        name=name,
        exist_ok=True,
    )
    print(f"done -> runs/{name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
