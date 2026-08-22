"""Phase G eval — per-class mAP on val + seed-stability check.

Run after training (one or both seeds). Reads best.pt of each run, evaluates on
the val split, prints per-class mAP@50 / mAP@50-95, and — when both seeds exist —
the per-class gap (gate G3 requires <= 3.0 points).

Usage: python scripts/eval_val.py [run_name ...]
  default runs: seed42_n640 seed7_n640
"""
from __future__ import annotations

import sys
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "dataset" / "dataset.yaml"
NAMES = ["bottle", "aluminum"]
TARGETS = {"bottle": 0.90, "aluminum": 0.90}


def evaluate(run: str) -> dict[str, tuple[float, float]] | None:
    weights = ROOT / "runs" / run / "weights" / "best.pt"
    if not weights.is_file():
        print(f"[skip] {run}: no best.pt at {weights}")
        return None
    print(f"\n=== {run} ===")
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
    runs = sys.argv[1:] or ["seed42_n640"]
    results = {run: evaluate(run) for run in runs}
    trained = {k: v for k, v in results.items() if v}
    if len(trained) == 2:
        (a, b) = trained.keys()
        print(f"\n=== seed stability ({a} vs {b}) — gate <= 3.0 pts ===")
        worst = ("", 0.0)
        for cls in NAMES:
            if cls in trained[a] and cls in trained[b]:
                gap = abs(trained[a][cls][0] - trained[b][cls][0]) * 100
                print(f"  {cls:<9} gap={gap:.2f} pts {'OK' if gap <= 3.0 else 'FAIL'}")
                if gap > worst[1]:
                    worst = (cls, gap)
        if worst[1] > 3.0:
            print(f"  -> seed instability on {worst[0]} ({worst[1]:.2f} pts) — see escape E-4")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
