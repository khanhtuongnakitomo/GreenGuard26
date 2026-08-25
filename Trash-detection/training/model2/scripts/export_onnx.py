r"""Export Model 2 best.pt -> ONNX FP32 @416 for Jetson Nano B01.

Static imgsz 416 (Nano 4GB cannot run 640 reliably). Copies to
export/onnx_416/model.onnx + labels.txt.

Usage:
  python scripts/export_onnx.py
  python scripts/export_onnx.py --weights runs/m2v3_seed42_n640/weights/best.pt
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
    ap.add_argument("--weights", default=str(ROOT / "runs" / "m2v3_seed42_n640" / "weights" / "best.pt"))
    ap.add_argument("--imgsz", type=int, default=416)
    ap.add_argument("--opset", type=int, default=13)
    args = ap.parse_args()

    weights = Path(args.weights)
    if not weights.is_file():
        print(f"ERROR: no weights at {weights}")
        return 1

    out_dir = ROOT / "export" / f"onnx_{args.imgsz}"
    out_dir.mkdir(parents=True, exist_ok=True)

    model = YOLO(str(weights))
    exported = Path(model.export(format="onnx", imgsz=args.imgsz, opset=args.opset, simplify=True))
    dest = out_dir / "model.onnx"
    shutil.copy2(exported, dest)
    (out_dir / "labels.txt").write_text("\n".join(LABELS) + "\n", encoding="utf-8")
    if dest.stat().st_mtime <= weights.stat().st_mtime:
        raise SystemExit(f"ERROR: {dest} is not newer than {weights} - stale export artifact")
    print(f"exported -> {dest}")
    print(f"labels   -> {out_dir / 'labels.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
