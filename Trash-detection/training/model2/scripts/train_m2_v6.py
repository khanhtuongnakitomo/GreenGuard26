r"""Model 2 v6 — YOLO11s-OBB, in-machine domain, hard 3-hour wall clock.

Difference vs v5 ([train_m2_v5.py]):
  * offline augmentation now carries the machine domain (augment_inmachine.py),
    so in-training aug is LIGHTER (workers=0 makes CPU aug the bottleneck).
  * imgsz 640 (was 768) + trimmed studio pool (SOURCE_CAP) to fit the clock.
  * HARD time cap: Ultralytics `time` arg (confirmed in default.yaml:
    "time: # (float, optional) max hours to train; overrides epochs if set").
  * fine-tune from m2v5 best.pt (keeps cap/label skill), not m2v4.

Deploy target: Jetson Orin Nano 8GB (JetPack 6 / TensorRT 10). GPU trains here;
export to ONNX for the Orin runtime (export_onnx.py / package_models.py).

Usage (from training/model2/, model1 venv):
  python scripts/train_m2_v6.py                 # fine-tune from m2v5, time-capped
  python scripts/train_m2_v6.py --smoke         # 1-epoch sanity
  python scripts/train_m2_v6.py --resume        # restart from last.pt
"""
from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "dataset" / "dataset.yaml"
# Fine-tune seed: v5's best (all-angle/all-light). Falls back to pretrained.
BASELINE = ROOT / "runs" / "m2v5_allangle_seed42_n768" / "weights" / "best.pt"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--name", default="m2v6_inmachine_seed42_n640")
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--epochs", type=int, default=110)
    ap.add_argument("--time", type=float, default=2.1,
                    help="HARD wall-clock cap in hours (overrides epochs)")
    ap.add_argument("--patience", type=int, default=25)
    # batch 24 @640 uses ~6-7GB of the 12GB card (was 16 using only ~3.9GB) —
    # more VRAM per step = fewer steps/epoch = faster. Override with --batch.
    ap.add_argument("--batch", type=int, default=24)
    # workers=0 is the Windows-safe default: >0 spawns dataloader subprocesses
    # that deadlock on large OBB datasets + heavy augmentation (the m2v5 hang).
    ap.add_argument("--workers", type=int, default=0)
    # cache="disk" decodes images to SSD once then reads that — removes the
    # per-epoch disk/decode bottleneck at workers=0 WITHOUT needing ~22GB free
    # RAM (cache=True gets refused if RAM is low; disk only needs ~20GB disk).
    ap.add_argument("--cache", default="disk", help="'disk' (default) | true | false")
    ap.add_argument("--fraction", type=float, default=1.0)
    ap.add_argument("--lr0", type=float, default=0.001)
    ap.add_argument("--full", action="store_true", help="train from yolo11s-obb.pt, not m2v5")
    ap.add_argument("--smoke", action="store_true", help="1 epoch, 5% data, imgsz 320")
    ap.add_argument("--resume", action="store_true", help="resume from runs/<name>/weights/last.pt")
    ap.add_argument("--weights", default=None, help="override start weights")
    args = ap.parse_args()

    if args.smoke:
        args.epochs, args.imgsz, args.fraction = 1, 320, 0.05
        args.batch, args.workers, args.patience = 8, 0, 1
        args.time = 0.0  # no wall-clock cap on the smoke (1 epoch)
        args.cache = "false"
        args.name = "smoke_m2v6"

    # normalise cache flag: Ultralytics wants True | False | "disk"
    cache = {"true": True, "1": True, "yes": True, "disk": "disk"}.get(
        str(args.cache).lower(), False)

    if args.weights:
        start = args.weights
    elif args.full:
        start = "yolo11s-obb.pt"
    else:
        start = str(BASELINE) if BASELINE.is_file() else "yolo11s-obb.pt"
        if not BASELINE.is_file():
            print(f"[WARN] m2v5 baseline not found at {BASELINE} — using yolo11s-obb.pt")

    print(f"[train_m2_v6] start weights: {start}")
    print(f"[train_m2_v6] data: {DATA}  imgsz={args.imgsz}  epochs={args.epochs}  "
          f"time_cap={args.time}h  workers={args.workers}")

    if args.resume:
        last = ROOT / "runs" / args.name / "weights" / "last.pt"
        if last.is_file():
            print(f"[train_m2_v6] RESUMING from {last}")
            model = YOLO(str(last))
            model.train(resume=True)
            print(f"done -> runs/{args.name}/weights/best.pt")
            return 0
        print(f"[WARN] --resume set but no {last}; starting fresh")

    model = YOLO(start)
    model.train(
        data=str(DATA),
        epochs=args.epochs,
        time=args.time if args.time and args.time > 0 else None,   # HARD 3h cap
        patience=args.patience,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        fraction=args.fraction,
        cache=cache,                 # "disk" = decoded cache on SSD (removes disk bottleneck)
        multi_scale=False,           # OFF: it thrashes VRAM and slows ~10-15% (was the wrong lever)
        optimizer="AdamW",
        cos_lr=True,
        lr0=args.lr0,
        seed=args.seed,
        deterministic=False,   # True forces cudnn deterministic -> slower + can hang on Win
        # ---- LIGHT in-training pose aug (offline pass already carries domain) ----
        degrees=12.0,          # small jitter only; the machine band is baked in
        translate=0.10,
        scale=0.35,
        shear=1.0,
        perspective=0.0005,
        fliplr=0.5,
        flipud=0.05,
        # ---- LIGHT in-training lighting aug (offline pass covers the extremes) ----
        hsv_h=0.012,
        hsv_s=0.5,
        hsv_v=0.45,
        # ---- composition (mixup/copy_paste off: implicated in the v5 dataloader hang) ----
        mosaic=0.5,
        close_mosaic=10,
        mixup=0.0,
        copy_paste=0.0,
        project=str(ROOT / "runs"),
        name=args.name,
        exist_ok=True,
    )
    print(f"done -> runs/{args.name}/weights/best.pt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
