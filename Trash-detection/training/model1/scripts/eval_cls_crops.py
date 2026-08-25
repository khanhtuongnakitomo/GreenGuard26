r"""Sanity-check PET/can classifier on val crops (not a pass/fail gate).

Usage:
  python scripts/eval_cls_crops.py
"""
from __future__ import annotations

from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
CROPS = ROOT.parent / "dataset" / "model1" / "crops" / "val"
WEIGHTS = ROOT / "runs" / "cls_pet_can_seed42_n224" / "weights" / "best.pt"


def main() -> int:
    if not WEIGHTS.is_file():
        print(f"ERROR: missing {WEIGHTS}")
        return 1
    if not CROPS.is_dir():
        print(f"ERROR: missing val crops at {CROPS}; run make_crops.py")
        return 1

    model = YOLO(str(WEIGHTS))
    r = model.val(data=str(CROPS.parent), split="val", imgsz=224, device="cpu", verbose=False)
    top1 = float(r.top1) if hasattr(r, "top1") else float(getattr(r, "results_dict", {}).get("metrics/accuracy_top1", 0))
    print(f"CLS_VAL: top1={top1:.4f} on {CROPS}")
    print("(informational only — judge live on real webcam frames)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
