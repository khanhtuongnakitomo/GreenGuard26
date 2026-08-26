r"""Model 2 v5 — YOLO11s-OBB, all-angle / all-light (cap / label / ring).

Rebuild targeted at the two measured m2v4 failures:
  * dark / over-bright lighting  -> hsv + gamma/exposure augmented offline,
    plus in-training hsv jitter here.
  * tilted / off-center bottles  -> degrees=180 (full rotation), perspective,
    translate, scale, flips — all absent in the old train.py (degrees was 0.0).

Deploy target: Jetson Orin Nano 8GB (JetPack 6 / TensorRT 10). GPU trains here;
export to ONNX for the Orin runtime (see export_onnx.py / package_models.py).

Usage (from training/model2/, model1 venv):
  python scripts/train_m2_v5.py                                  # fine-tune from m2v4
  python scripts/train_m2_v5.py --full                           # from yolo11s-obb.pt scratch
  python scripts/train_m2_v5.py --smoke                          # 1-epoch sanity
"""
from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "dataset" / "dataset.yaml"
BASELINE = ROOT / "runs" / "m2v4_caplabel_seed42_n640" / "weights" / "best.pt"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--name", default="m2v5_allangle_seed42_n768")
    ap.add_argument("--imgsz", type=int, default=768)
    ap.add_argument("--epochs", type=int, default=150)
    ap.add_argument("--patience", type=int, default=40)
    ap.add_argument("--batch", type=int, default=16)
    # workers=0 is the Windows-safe default: >0 spawns dataloader subprocesses
    # that deadlock on large OBB datasets + heavy augmentation (the m2v5 hang).
    ap.add_argument("--workers", type=int, default=0)
    ap.add_argument("--fraction", type=float, default=1.0)
    ap.add_argument("--lr0", type=float, default=0.002)
    ap.add_argument("--full", action="store_true", help="train from yolo11s-obb.pt, not m2v4")
    ap.add_argument("--smoke", action="store_true", help="1 epoch, 5% data, imgsz 320")
    ap.add_argument("--resume", action="store_true", help="resume from runs/<name>/weights/last.pt")
    ap.add_argument("--weights", default=None, help="override start weights")
    args = ap.parse_args()

    if args.smoke:
        args.epochs, args.imgsz, args.fraction = 1, 320, 0.05
        args.batch, args.workers, args.patience = 8, 0, 1
        args.name = "smoke_m2v5"

    # Start weights: m2v4 fine-tune by default (preserves cap/label skill),
    # else yolo11s-obb pretrained backbone.
    if args.weights:
        start = args.weights
    elif args.full:
        start = "yolo11s-obb.pt"
    else:
        start = str(BASELINE) if BASELINE.is_file() else "yolo11s-obb.pt"
        if not BASELINE.is_file():
            print(f"[WARN] m2v4 baseline not found at {BASELINE} — using yolo11s-obb.pt")

    # If fine-tuning from an m2v4 (yolov8 head), Ultralytics will re-init the
    # head to 3 classes automatically; backbone weights transfer.
    print(f"[train_m2_v5] start weights: {start}")
    print(f"[train_m2_v5] data: {DATA}  imgsz={args.imgsz}  epochs={args.epochs}  workers={args.workers}")

    # Resume from the run's last.pt if asked (e.g. after a crash/hang).
    if args.resume:
        last = ROOT / "runs" / args.name / "weights" / "last.pt"
        if last.is_file():
            print(f"[train_m2_v5] RESUMING from {last}")
            model = YOLO(str(last))
            model.train(resume=True)
            print(f"done -> runs/{args.name}/weights/best.pt")
            return 0
        print(f"[WARN] --resume set but no {last}; starting fresh")

    model = YOLO(start)
    model.train(
        data=str(DATA),
        epochs=args.epochs,
        patience=args.patience,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        fraction=args.fraction,
        optimizer="AdamW",
        cos_lr=True,
        lr0=args.lr0,
        seed=args.seed,
        deterministic=False,   # True forces cudnn deterministic -> slower + can hang on Win
        # ---- POSE augmentation (the tilt fix — was all zero/off before) ----
        degrees=180.0,       # full rotation: bottle can be any orientation
        translate=0.15,
        scale=0.5,
        shear=2.0,
        perspective=0.001,
        fliplr=0.5,
        flipud=0.1,
        # ---- LIGHTING augmentation (the dark/bright fix) ----
        hsv_h=0.015,
        hsv_s=0.6,
        hsv_v=0.5,           # large value jitter -> dark + bright robustness
        # ---- composition ----
        mosaic=1.0,
        close_mosaic=15,
        mixup=0.1,
        copy_paste=0.05,
        project=str(ROOT / "runs"),
        name=args.name,
        exist_ok=True,
    )
    print(f"done -> runs/{args.name}/weights/best.pt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
