r"""Export PET/can classifier to ONNX for Jetson / CPU demo.

Usage:
  python scripts/export_classifier_onnx.py
  python scripts/export_classifier_onnx.py --weights runs/cls_pet_can_seed42_n224/weights/best.pt
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WEIGHTS = ROOT / "runs" / "cls_pet_can_seed42_n224" / "weights" / "best.pt"
OUT_DIR = ROOT / "export" / "cls_onnx_224"
LABELS = ("pet", "can")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", default=str(DEFAULT_WEIGHTS))
    ap.add_argument("--imgsz", type=int, default=224)
    ap.add_argument("--opset", type=int, default=13)
    args = ap.parse_args()

    weights = Path(args.weights)
    if not weights.is_file():
        print(f"ERROR: weights not found: {weights}")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    model = YOLO(str(weights))
    exported = Path(
        model.export(format="onnx", imgsz=args.imgsz, opset=args.opset, simplify=True)
    )
    dest = OUT_DIR / "model.onnx"
    shutil.copy2(exported, dest)
    (OUT_DIR / "labels.txt").write_text("\n".join(LABELS) + "\n", encoding="utf-8")
    print(f"exported -> {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
