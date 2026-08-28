"""Validate and export the supplied three-class Model 1 detector."""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WEIGHTS = ROOT / "imported" / "bki_dt3_three_class" / "best.pt"
NAMES = ("metal_can", "pet_bottle", "pp_cup")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", default=str(DEFAULT_WEIGHTS))
    parser.add_argument("--opset", type=int, default=13)
    args = parser.parse_args()

    weights = Path(args.weights).resolve()
    if not weights.is_file():
        print(f"ERROR: weights not found: {weights}")
        return 1

    model = YOLO(str(weights))
    if getattr(model, "task", None) != "detect":
        print(f"ERROR: expected detect model, got {getattr(model, 'task', None)!r}")
        return 1
    names = {int(key): str(value).lower() for key, value in model.names.items()}
    if tuple(names.get(index) for index in range(3)) != NAMES:
        print(f"ERROR: expected class order {NAMES}, got {names}")
        return 1

    export_root = ROOT / "export"
    export_root.mkdir(parents=True, exist_ok=True)
    for imgsz in (640, 416):
        print(f"Exporting {weights} to ONNX at {imgsz}...")
        exported = Path(model.export(format="onnx", imgsz=imgsz, opset=args.opset, simplify=True, nms=False))
        out_dir = export_root / f"detect_{imgsz}"
        out_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(exported, out_dir / "model.onnx")
        (out_dir / "labels.txt").write_text("\n".join(NAMES) + "\n", encoding="utf-8")
        print(f"exported -> {out_dir / 'model.onnx'}")

    manifest = {
        "weights": str(weights),
        "task": "detect",
        "names": {str(index): name for index, name in enumerate(NAMES)},
        "visible_class_ids": [0, 1],
        "ignored_class_ids": [2],
        "exports": {str(size): str(export_root / f"detect_{size}" / "model.onnx") for size in (640, 416)},
    }
    (export_root / "source_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
