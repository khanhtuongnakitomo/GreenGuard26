"""Run the trained cap/label model on a folder of images and save overlays."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import cv2
import numpy as np


REPO_ROOT = Path(__file__).resolve().parents[1]
os.chdir(REPO_ROOT)

from component_detector import ComponentDetector
from decision import inspect_components


CLASS_COLORS = {
    "cap": (0, 140, 255),
    "label": (255, 180, 0),
}


def parse_args():
    parser = argparse.ArgumentParser(description="Preview Model 2 detections on a folder of images.")
    parser.add_argument("--model", default="models/best.pt")
    parser.add_argument("--source", default="data/dataset-2/test/images")
    parser.add_argument("--out", default="runs/preview")
    parser.add_argument("--conf", type=float, default=0.75)
    parser.add_argument("--limit", type=int, default=0, help="Optional max number of images")
    return parser.parse_args()


def draw_inspection(image, inspection):
    annotated = image.copy()
    for item in inspection["detections"]:
        color = CLASS_COLORS.get(item["class_name"], (0, 255, 255))
        points = item.get("polygon")
        if points:
            contour = np.array([(int(x), int(y)) for x, y in points], dtype=np.int32)
            cv2.polylines(annotated, [contour], True, color, 2)
        x1, y1, x2, y2 = [int(v) for v in item["bbox"]]
        cv2.putText(
            annotated,
            f"{item['class_name']} {item['confidence']:.2f}",
            (x1, max(20, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2,
        )

    status = "ACCEPT" if inspection["decision"] == "accept" else f"REJECT {inspection['reason']}"
    color = (0, 200, 0) if inspection["decision"] == "accept" else (0, 0, 255)
    cv2.putText(annotated, status, (12, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
    return annotated


def main():
    args = parse_args()
    model_path = Path(args.model)
    source = Path(args.source)
    out_dir = Path(args.out)
    if not model_path.is_absolute():
        model_path = REPO_ROOT / model_path
    if not source.is_absolute():
        source = REPO_ROOT / source
    if not out_dir.is_absolute():
        out_dir = REPO_ROOT / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    detector = ComponentDetector(model_path)
    images = sorted(
        [path for path in source.iterdir() if path.suffix.lower() in {".jpg", ".jpeg", ".png"}]
    )
    if args.limit:
        images = images[: args.limit]

    summary = []
    for image_path in images:
        frame = cv2.imread(str(image_path))
        if frame is None:
            continue
        detections = detector.predict(frame)
        inspection = inspect_components(detections, args.conf)
        annotated = draw_inspection(frame, inspection)
        dest = out_dir / image_path.name
        cv2.imwrite(str(dest), annotated)
        summary.append(
            {
                "image": image_path.name,
                "decision": inspection["decision"],
                "reason": inspection["reason"],
                "cap_confidence": inspection["cap_confidence"],
                "label_confidence": inspection["label_confidence"],
            }
        )
        print(f"{image_path.name}: {inspection['decision']} ({inspection['reason']})")

    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Wrote {len(summary)} previews to {out_dir}")


if __name__ == "__main__":
    main()
