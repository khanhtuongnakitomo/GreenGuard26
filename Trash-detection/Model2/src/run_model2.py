"""Run current Model 2 by itself — no Model 1, no crop gate.

Use this to see what the PET inspection YOLO actually detects on a webcam,
video, image, or folder. The kiosk pipeline is not involved.

From Model2/:

    python src/run_model2.py
    python src/run_model2.py --source 0 --conf 0.5
    python src/run_model2.py --source data/dataset-3/test/images
    python src/run_model2.py --source path/to/bottle.jpg

Keys: Q quit, S save a snapshot, SPACE pause (camera/video).
"""

from __future__ import annotations

import argparse
import os
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np


REPO_ROOT = Path(__file__).resolve().parents[1]
os.chdir(REPO_ROOT)
Path(os.environ.setdefault("YOLO_CONFIG_DIR", str(REPO_ROOT / ".ultralytics"))).mkdir(
    parents=True, exist_ok=True
)
Path(os.environ.setdefault("MPLCONFIGDIR", str(REPO_ROOT / ".matplotlib"))).mkdir(
    parents=True, exist_ok=True
)

from component_detector import ComponentDetector
from decision import inspect_components


CLASS_COLORS = {
    "cap": (0, 140, 255),
    "label": (255, 180, 0),
    "liquid": (255, 80, 80),
    "water": (255, 80, 80),
    "bottle": (0, 200, 0),
}
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_SUFFIXES = {".mp4", ".avi", ".mov", ".mkv", ".wmv"}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run current Model 2 (cap/label/liquid) without Model 1."
    )
    parser.add_argument(
        "--model",
        default="models/best.pt",
        help="Path to Model 2 weights (YOLO OBB .pt)",
    )
    parser.add_argument(
        "--source",
        default="0",
        help="Webcam index, image file, video file, or folder of images",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.5,
        help="Decision threshold: cap, label, or liquid at/above this → REJECT",
    )
    parser.add_argument(
        "--min-conf",
        type=float,
        default=0.05,
        help="Draw every detection at/above this score (even if below --conf)",
    )
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument(
        "--save-dir",
        default="runs/live_model2",
        help="Folder for S-key snapshots",
    )
    return parser.parse_args()


def resolve_path(path):
    candidate = Path(path)
    if candidate.exists() or candidate.is_absolute():
        return candidate
    repo_candidate = REPO_ROOT / path
    if repo_candidate.exists():
        return repo_candidate
    return candidate


def source_kind(source):
    text = str(source).strip()
    if text.isdigit():
        return "camera"
    path = resolve_path(text)
    if path.is_dir():
        return "folder"
    suffix = path.suffix.lower()
    if suffix in IMAGE_SUFFIXES:
        return "image"
    if suffix in VIDEO_SUFFIXES:
        return "video"
    if path.exists():
        return "image"
    raise FileNotFoundError(f"Source not found: {source}")


def list_images(folder):
    return sorted(
        path
        for path in Path(folder).iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
    )


def draw_polygon(image, points, color, thickness):
    if not points:
        return
    contour = np.array([(int(x), int(y)) for x, y in points], dtype=np.int32)
    cv2.polylines(image, [contour], True, color, thickness)


def annotate(frame, detections, inspection, fps=None):
    overlay = frame.copy()
    decision_conf = inspection["conf_threshold"]

    for item in detections:
        color = CLASS_COLORS.get(item["class_name"], (0, 255, 255))
        above = item["confidence"] >= decision_conf
        thickness = 3 if above else 1
        draw_polygon(overlay, item.get("polygon"), color, thickness)
        x1, y1, _, _ = [int(value) for value in item["bbox"]]
        marker = "" if above else " (below)"
        cv2.putText(
            overlay,
            f"{item['class_name']} {item['confidence']:.2f}{marker}",
            (x1, max(24, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            color,
            2,
        )

    if inspection["decision"] == "accept":
        verdict = "ACCEPT / NO VIOLATION"
        color = (0, 200, 0)
    else:
        verdict = f"REJECT / {inspection['reason'].upper()}"
        color = (0, 0, 255)

    cv2.rectangle(overlay, (0, 0), (overlay.shape[1], 78), (0, 0, 0), -1)
    cv2.putText(overlay, verdict, (16, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.95, color, 2)
    hud = (
        f"Model 2 only  cap>={inspection['cap_confidence']:.2f}  "
        f"label>={inspection['label_confidence']:.2f}  "
        f"liquid>={inspection['liquid_confidence']:.2f}  "
        f"thresh={decision_conf:.2f}"
    )
    if fps is not None:
        hud += f"  {fps:.1f} fps"
    cv2.putText(overlay, hud, (16, 64), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (220, 220, 220), 1)
    return overlay


def save_snapshot(save_dir, frame):
    save_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    path = save_dir / f"model2_{stamp}.jpg"
    cv2.imwrite(str(path), frame)
    print(f"Saved {path}")


def inspect_frame(detector, frame, conf):
    detections = detector.predict(frame)
    inspection = inspect_components(detections, conf)
    return detections, inspection


def wait_or_quit(paused=False):
    delay = 0 if paused else 1
    key = cv2.waitKey(delay) & 0xFF
    if key in (ord("q"), ord("Q"), 27):
        return "quit"
    if key in (ord("s"), ord("S")):
        return "save"
    if key == 32:
        return "pause"
    return None


def run_camera_or_video(detector, capture, args, save_dir, title):
    if not capture.isOpened():
        raise RuntimeError("Could not open camera/video source")

    capture.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
    cv2.namedWindow(title, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(title, args.width, args.height)

    fps_ema = None
    paused = False
    last_overlay = None
    print("Model 2 only. Q quit, S snapshot, SPACE pause.")
    try:
        while True:
            if not paused:
                ok, frame = capture.read()
                if not ok:
                    print("End of stream or failed to read a frame.")
                    break
                start = cv2.getTickCount()
                detections, inspection = inspect_frame(detector, frame, args.conf)
                elapsed = (cv2.getTickCount() - start) / cv2.getTickFrequency()
                instant_fps = 1.0 / elapsed if elapsed > 0 else 0.0
                fps_ema = instant_fps if fps_ema is None else (0.85 * fps_ema + 0.15 * instant_fps)
                last_overlay = annotate(frame, detections, inspection, fps_ema)
            if last_overlay is None:
                continue
            cv2.imshow(title, last_overlay)
            action = wait_or_quit(paused)
            if action == "quit":
                break
            if action == "save" and last_overlay is not None:
                save_snapshot(save_dir, last_overlay)
            if action == "pause":
                paused = not paused
    finally:
        capture.release()
        cv2.destroyAllWindows()


def run_images(detector, images, args, save_dir, title):
    if not images:
        raise FileNotFoundError("No images found in the source")

    cv2.namedWindow(title, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(title, args.width, args.height)
    print(f"Model 2 only on {len(images)} image(s). Q quit, S snapshot, any other key next.")
    try:
        for image_path in images:
            frame = cv2.imread(str(image_path))
            if frame is None:
                print(f"Skip unreadable file: {image_path}")
                continue
            detections, inspection = inspect_frame(detector, frame, args.conf)
            overlay = annotate(frame, detections, inspection)
            print(
                f"{image_path.name}: {inspection['decision']} "
                f"({inspection['reason']}) cap={inspection['cap_confidence']:.2f} "
                f"label={inspection['label_confidence']:.2f} "
                f"liquid={inspection['liquid_confidence']:.2f}"
            )
            cv2.imshow(title, overlay)
            key = cv2.waitKey(0) & 0xFF
            if key in (ord("q"), ord("Q"), 27):
                break
            if key in (ord("s"), ord("S")):
                save_snapshot(save_dir, overlay)
    finally:
        cv2.destroyAllWindows()


def main():
    args = parse_args()
    model_path = resolve_path(args.model)
    if not model_path.exists():
        raise FileNotFoundError(f"Model 2 weights not found: {model_path}")

    save_dir = resolve_path(args.save_dir)
    kind = source_kind(args.source)
    detector = ComponentDetector(model_path, min_conf=args.min_conf)
    title = "Model 2 only — cap / label / liquid"

    print(f"Weights: {model_path}")
    print(f"Source:  {args.source} ({kind})")
    print(f"Decision threshold: {args.conf}  draw from: {args.min_conf}")
    print("cap OR label OR liquid at threshold → REJECT; none of the three → ACCEPT")

    if kind == "camera":
        run_camera_or_video(
            detector, cv2.VideoCapture(int(args.source)), args, save_dir, title
        )
        return 0
    if kind == "video":
        run_camera_or_video(
            detector, cv2.VideoCapture(str(resolve_path(args.source))), args, save_dir, title
        )
        return 0
    if kind == "folder":
        run_images(detector, list_images(resolve_path(args.source)), args, save_dir, title)
        return 0
    run_images(detector, [resolve_path(args.source)], args, save_dir, title)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
