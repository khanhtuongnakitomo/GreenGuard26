"""Phase G eval — per-class mAP on val split.

Usage: python scripts/eval_val.py [run_name ...]
"""
from __future__ import annotations

import sys
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "dataset" / "dataset.yaml"
NAMES = ["cap", "label", "ring"]
TARGETS = {"cap": 0.80, "label": 0.80, "ring": 0.80}


def evaluate(run: str) -> dict[str, tuple[float, float]] | None:
    weights = ROOT / "runs" / run / "weights" / "best.pt"
    if not weights.is_file():
        print(f"[skip] {run}: no best.pt at {weights}")
        return None
    print(f"\n=== {run} (Val Split @640) ===")
    model = YOLO(str(weights))
    r = model.val(data=str(DATA), split="val", imgsz=640, batch=16,
                  plots=False, verbose=False)
    per_class: dict[str, tuple[float, float]] = {}
    metrics = getattr(r, "box", None) or getattr(r, "obb", None)
    idx = list(metrics.ap_class_index)
    for i, cls in enumerate(idx):
        ap50 = float(metrics.ap50[i])
        ap = float(metrics.ap[i])
        per_class[NAMES[int(cls)]] = (ap50, ap)
        print(f"  {NAMES[int(cls)]:<9} mAP50={ap50:.4f}  mAP50-95={ap:.4f}  "
              f"target={TARGETS[NAMES[int(cls)]]:.2f}  "
              f"{'PASS' if ap50 >= TARGETS[NAMES[int(cls)]] else 'BELOW'}")
    print(f"  overall mAP50={r.results_dict.get('metrics/mAP50(B)', float('nan')):.4f}  "
          f"mAP50-95={r.results_dict.get('metrics/mAP50-95(B)', float('nan')):.4f}")
    return per_class


def main() -> int:
    runs = sys.argv[1:] or ["m2v4_caplabel_seed42_n640"]
    for run in runs:
        evaluate(run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
