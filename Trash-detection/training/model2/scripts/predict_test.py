r"""Run visual predictions on images using Model 2 (OBB).

Usage:
  python scripts/predict_test.py [--source dataset/test_locked/images] [--model auto] [--conf 0.25] [--save-dir logs/predictions]
"""
from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]

NAMES = {0: "cap", 1: "label", 2: "ring"}
COLORS = {0: (0, 0, 255), 1: (0, 255, 255), 2: (255, 0, 255)}

CANDIDATES = [
    ROOT / "runs" / "m2v4_caplabel_seed42_n640" / "weights" / "best.pt",
    ROOT / "export" / "candidates" / "m2v4_caplabel_seed42_n640" / "onnx_640" / "model.onnx",
    ROOT / "export" / "onnx_640" / "model.onnx",
    ROOT / "runs" / "m2v3_seed42_n640" / "weights" / "best.pt",
]


def resolve_model(arg: str) -> Path:
    if arg and arg != "auto":
        p = Path(arg)
        if not p.is_file():
            print(f"ERROR: Model not found at: {p}")
            raise SystemExit(1)
        return p
    for path in CANDIDATES:
        if path.is_file():
            return path
    print("ERROR: No Model 2 found.")
    raise SystemExit(1)


def main() -> int:
    parser = argparse.ArgumentParser(description="Test Model 2 visual predictions on images.")
    parser.add_argument("--source", type=str, default="",
                        help="Path to image file or directory of images (defaults to dataset/test_custom if populated, else dataset/test_locked/images)")
    parser.add_argument("--model", type=str, default="auto",
                        help="Path to .pt or .onnx model weights")
    parser.add_argument("--conf", type=float, default=0.25,
                        help="Confidence threshold (default: 0.25)")
    parser.add_argument("--save-dir", type=str, default=str(ROOT / "logs" / "predictions"),
                        help="Output directory to save annotated images")
    parser.add_argument("--max-images", type=int, default=0,
                        help="Maximum images to process (0 = all images)")
    parser.add_argument("--imgsz", type=int, default=640,
                        help="Inference image size")
    args = parser.parse_args()

    model_path = resolve_model(args.model)
    print(f"[Model 2 Tester] Loading model: {model_path}")
    model = YOLO(str(model_path), task="obb")

    # Smart default source: check test_custom first, then test_locked/images
    if args.source:
        src_path = Path(args.source)
    else:
        custom_dir = ROOT / "dataset" / "test_custom"
        if custom_dir.is_dir() and any(custom_dir.iterdir()):
            src_path = custom_dir
        else:
            src_path = ROOT / "dataset" / "test_locked" / "images"

    if src_path.is_file():
        image_files = [src_path]
    elif src_path.is_dir():
        image_files = sorted([p for p in src_path.iterdir() if p.suffix.lower() in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]])
    else:
        print(f"ERROR: Source path does not exist: {src_path}")
        return 1

    if not image_files:
        print(f"No images found in {src_path}")
        return 1

    limit = len(image_files) if args.max_images <= 0 else min(len(image_files), args.max_images)
    target_images = image_files[:limit]

    out_dir = Path(args.save_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[Model 2 Tester] Processing {len(target_images)} images from: {src_path}")
    print(f"[Model 2 Tester] Output folder: {out_dir}")
    print("-" * 60)

    total_detections = {0: 0, 1: 0, 2: 0}
    processed = 0

    for img_path in target_images:
        img = cv2.imread(str(img_path))
        if img is None:
            continue

        results = model.predict(source=img, conf=args.conf, imgsz=args.imgsz, verbose=False)
        r = results[0]

        counts = {0: 0, 1: 0, 2: 0}
        if r.obb is not None and len(r.obb) > 0:
            xyxyxyxy = r.obb.xyxyxyxy.cpu().numpy()
            confs = r.obb.conf.cpu().numpy()
            clss = r.obb.cls.cpu().numpy().astype(int)

            for poly, conf, cls_id in zip(xyxyxyxy, confs, clss):
                pts = poly.astype(np.int32).reshape((-1, 1, 2))
                color = COLORS.get(cls_id, (0, 255, 0))
                cv2.polylines(img, [pts], isClosed=True, color=color, thickness=2)

                x0, y0 = int(poly[0][0]), int(poly[0][1])
                name = NAMES.get(cls_id, str(cls_id))
                label_txt = f"{name} {conf:.2f}"
                cv2.putText(img, label_txt, (x0, max(18, y0 - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                counts[cls_id] = counts.get(cls_id, 0) + 1
                total_detections[cls_id] = total_detections.get(cls_id, 0) + 1

        out_path = out_dir / f"pred_{img_path.name}"
        cv2.imwrite(str(out_path), img)
        det_summary = ", ".join(f"{NAMES.get(k, k)}: {v}" for k, v in counts.items() if v > 0) or "None"
        print(f"  {img_path.name:<40} -> Detections: {det_summary}")
        processed += 1

    print("-" * 60)
    print(f"Processed {processed} images.")
    print("Total detected instances across batch:")
    for k, v in total_detections.items():
        print(f"  {NAMES.get(k, k)}: {v}")
    print(f"\nAll annotated test images saved to:\n  {out_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
