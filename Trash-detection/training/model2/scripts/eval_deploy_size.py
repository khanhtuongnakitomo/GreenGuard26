r"""Eval Model 2 at Jetson deploy size (imgsz 416).

Usage: python scripts/eval_deploy_size.py [run_name ...]
"""
from __future__ import annotations

import sys
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "dataset" / "dataset.yaml"
NAMES = ["cap", "label", "ring"]
TARGET = 0.70
IMGSZ = 416


def eval_one(run: str) -> bool:
    weights = ROOT / "runs" / run / "weights" / "best.pt"
    if not weights.is_file():
        print(f"ERROR: no best.pt at {weights}")
        return False

    print(f"\n=== deploy-size eval {run} @ imgsz={IMGSZ} (target mAP50>={TARGET}) ===")
    model = YOLO(str(weights))
    r = model.val(data=str(DATA), split="val", imgsz=IMGSZ, batch=16,
                  plots=False, verbose=False, device="cpu")
    metrics = getattr(r, "box", None) or getattr(r, "obb", None)
    idx = list(metrics.ap_class_index)
    seen = set()
    failed = False
    for i, cls in enumerate(idx):
        name = NAMES[int(cls)]
        seen.add(name)
        ap50 = float(metrics.ap50[i])
        ap = float(metrics.ap[i])
        ok = ap50 >= TARGET
        if not ok:
            failed = True
        print(f"  {name:<9} mAP50={ap50:.4f}  mAP50-95={ap:.4f}  "
              f"target={TARGET:.2f}  {'PASS' if ok else 'BELOW'}")
    data_gaps: list[str] = []
    for name in NAMES:
        if name not in seen:
            data_gaps.append(name)
            print(f"  {name:<9} mAP50=MISSING  DATA_GAP (no instances in val)")
    overall50 = r.results_dict.get("metrics/mAP50(B)", float("nan"))
    overall = r.results_dict.get("metrics/mAP50-95(B)", float("nan"))
    print(f"  overall   mAP50={overall50:.4f}  mAP50-95={overall:.4f}")
    if failed:
        print("DEPLOY_SIZE: FAIL")
        return False
    if data_gaps:
        print("DEPLOY_SIZE: PASS_WITH_GAP  missing classes:", ", ".join(data_gaps))
        return True
    print("DEPLOY_SIZE: PASS")
    return True


def main() -> int:
    runs = sys.argv[1:] or ["m2v4_caplabel_seed42_n640"]
    all_ok = True
    for run in runs:
        ok = eval_one(run)
        if not ok:
            all_ok = False
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
