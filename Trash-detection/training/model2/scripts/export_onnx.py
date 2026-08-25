r"""Export Model 2 best.pt -> ONNX FP32 for Jetson Nano / PC.

Usage:
  python scripts/export_onnx.py --run m2v4_caplabel_seed42_n640 --imgsz 640 --candidate
  python scripts/export_onnx.py --run m2v4_caplabel_seed42_n640 --imgsz 416 --candidate
  (Promote to production: omit --candidate)
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
LABELS = ["cap", "label", "ring"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="m2v4_caplabel_seed42_n640")
    ap.add_argument("--weights", default=None, help="direct path to weights file")
    ap.add_argument("--imgsz", type=int, default=416)
    ap.add_argument("--opset", type=int, default=13)
    ap.add_argument("--candidate", action="store_true", help="export to export/candidates/<run>/ instead of production")
    args = ap.parse_args()

    if args.weights:
        weights = Path(args.weights)
    else:
        weights = ROOT / "runs" / args.run / "weights" / "best.pt"

    if not weights.is_file():
        print(f"ERROR: no weights at {weights}")
        return 1

    if args.candidate:
        out_dir = ROOT / "export" / "candidates" / args.run / f"onnx_{args.imgsz}"
    else:
        out_dir = ROOT / "export" / f"onnx_{args.imgsz}"

    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Exporting {weights} to ONNX @ {args.imgsz} (opset {args.opset})...")
    model = YOLO(str(weights))
    exported = Path(model.export(format="onnx", imgsz=args.imgsz, opset=args.opset, simplify=True))
    dest = out_dir / "model.onnx"
    shutil.copy2(exported, dest)
    (out_dir / "labels.txt").write_text("\n".join(LABELS) + "\n", encoding="utf-8")
    print(f"exported -> {dest}")
    print(f"labels   -> {out_dir / 'labels.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
