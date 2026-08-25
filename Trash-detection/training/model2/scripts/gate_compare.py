r"""Promotion gate: baseline m2v3_seed42_n640 vs candidate (default m2_orient).

Rules (horizontal-robustness plan, section 8):
  - candidate per-class mAP50 on val: no regression > 2 pts vs baseline,
    and >= 0.80 for every class (AP50 gate)
  - per-class precision >= 0.90 on val (precision is a hard gate: a false
    ring causes a false REJECT)
  - classes with zero val instances (ring until owner-live lands) are
    reported as NOT MEASURED and do not block promotion

Exit 0 = PASS (promotable), 1 = FAIL (keep current deploy).
Usage: python scripts/gate_compare.py [candidate_run]
"""
from __future__ import annotations

import sys
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT.parent / "dataset" / "model2" / "dataset.yaml"
NAMES = ["cap", "label", "ring"]
MAX_REGRESS = 2.0     # percentage points
MIN_MAP50 = 0.80
MIN_PRECISION = 0.90


def val_metrics(weights: Path) -> dict[str, dict[str, float]]:
    r = YOLO(str(weights)).val(data=str(DATA), split="val", imgsz=640, batch=16,
                               plots=False, verbose=False)
    m = getattr(r, "box", None) or getattr(r, "obb", None)
    out = {}
    for i, c in enumerate(m.ap_class_index):
        out[NAMES[int(c)]] = {
            "ap50": float(m.ap50[i]),
            "precision": float(m.p[i]) if hasattr(m, "p") else float("nan"),
        }
    return out


def main() -> int:
    cand = sys.argv[1] if len(sys.argv) > 1 else "m2_orient_seed42_n640"
    base_w = ROOT / "runs" / "m2v3_seed42_n640" / "weights" / "best.pt"
    cand_w = ROOT / "runs" / cand / "weights" / "best.pt"
    if not cand_w.is_file():
        print(f"GATE FAIL: no candidate weights {cand_w}")
        return 1

    base = val_metrics(base_w)
    new = val_metrics(cand_w)
    ok = True
    print("=== val per-class: baseline vs candidate ===")
    for cls in NAMES:
        if cls not in new:
            print(f"  {cls:<7} NOT MEASURED (no val instances — class absent)")
            continue
        b = base.get(cls, {"ap50": 0.0, "precision": float("nan")})
        n = new[cls]
        reg = (b["ap50"] - n["ap50"]) * 100
        line = (f"  {cls:<7} ap50 {b['ap50']:.4f}->{n['ap50']:.4f} ({reg:+.2f}pts)  "
                f"prec {n['precision']:.3f}")
        if reg > MAX_REGRESS:
            line += "  REGRESSION FAIL"; ok = False
        if n["ap50"] < MIN_MAP50:
            line += "  AP50<0.80 FAIL"; ok = False
        if n["precision"] == n["precision"] and n["precision"] < MIN_PRECISION:
            line += "  PREC<0.90 FAIL"; ok = False
        print(line)

    print(f"\nGATE {'PASS' if ok else 'FAIL'} — candidate {cand}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
