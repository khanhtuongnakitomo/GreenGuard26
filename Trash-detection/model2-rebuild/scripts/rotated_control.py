r"""Build rotated-control test sets: old test split at exact 0/90/180/270.

Transforms OBB corner coordinates along with the image so rotation
equivariance can be measured on identical content.

Usage:
  python scripts\rotated_control.py            # M1
  python scripts\rotated_control.py --model 2  # M2
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parent / "dataset"
ANGLES = (0, 90, 180, 270)
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def rotate_frame(img: np.ndarray, angle: int) -> np.ndarray:
    if angle == 0:
        return img
    if angle == 90:
        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    if angle == 180:
        return cv2.rotate(img, cv2.ROTATE_180)
    return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)


def rotate_obb(line: str, angle: int) -> str:
    p = line.split()
    if len(p) != 9:
        return ""
    v = [float(x) for x in p[1:9]]
    pts = [(v[i], v[i + 1]) for i in range(0, 8, 2)]
    if angle == 0:
        out = pts
    elif angle == 90:      # clockwise: x'=1-y, y'=x
        out = [(1.0 - y, x) for x, y in pts]
    elif angle == 180:
        out = [(1.0 - x, 1.0 - y) for x, y in pts]
    else:                  # 270 cw = 90 ccw: x'=y, y'=1-x
        out = [(y, 1.0 - x) for x, y in pts]
    coords = " ".join(f"{min(1.0, max(0.0, a)):.6f}" for pt in out for a in pt)
    return f"{p[0]} {coords}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", type=int, default=1, choices=[1, 2])
    args = ap.parse_args()
    src = DATA_ROOT / f"model{args.model}" / "splits" / "test"
    out = DATA_ROOT / f"model{args.model}" / "orientation_test" / "rotated_control"
    n = 0
    for angle in ANGLES:
        (out / f"r{angle}" / "images").mkdir(parents=True, exist_ok=True)
        (out / f"r{angle}" / "labels").mkdir(parents=True, exist_ok=True)
    for img_path in sorted((src / "images").iterdir()):
        if img_path.suffix.lower() not in IMG_EXT:
            continue
        img = cv2.imread(str(img_path))
        if img is None:
            print("WARN unreadable", img_path.name)
            continue
        lbl = src / "labels" / (img_path.stem + ".txt")
        lines = lbl.read_text(encoding="utf-8").splitlines() if lbl.is_file() else []
        for angle in ANGLES:
            cv2.imwrite(str(out / f"r{angle}" / "images" / img_path.name),
                        rotate_frame(img, angle))
            new_lines = [rl for ln in lines if (rl := rotate_obb(ln, angle))]
            (out / f"r{angle}" / "labels" / (img_path.stem + ".txt")).write_text(
                "\n".join(new_lines) + ("\n" if new_lines else ""), encoding="utf-8")
        n += 1
    print(f"rotated control built: {n} images x {len(ANGLES)} angles -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
