"""G1 QA — render N random normalized images with canonical OBB boxes drawn.

Output: dataset/audits/qa_render_20/*.jpg + a listing file.
Usage: python scripts/qa_render.py [n]
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "dataset" / "normalized" / "images"
LBL_DIR = ROOT / "dataset" / "normalized" / "labels"
OUT_DIR = ROOT / "dataset" / "audits" / "qa_render_20"

NAMES = {0: "bottle", 1: "aluminum"}
COLORS = {0: (255, 80, 0), 1: (0, 255, 0)}


def main() -> int:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    rng = random.Random(42)
    images = sorted(IMG_DIR.glob("*.jpg"))
    picks = rng.sample(images, min(n, len(images)))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    listing = []
    for i, img_path in enumerate(picks):
        lbl = LBL_DIR / (img_path.stem + ".txt")
        im = cv2.imread(str(img_path))
        if im is None:
            continue
        h, w = im.shape[:2]
        classes = set()
        for ln in lbl.read_text(encoding="utf-8").splitlines():
            p = ln.split()
            if len(p) != 9:
                continue
            c = int(p[0])
            pts = np.array(
                [(float(p[1 + 2 * k]) * w, float(p[2 + 2 * k]) * h) for k in range(4)],
                dtype=np.int32,
            )
            cv2.polylines(im, [pts], True, COLORS.get(c, (255, 255, 255)), 3)
            cv2.putText(im, NAMES.get(c, str(c)), (int(pts[0][0]), max(20, int(pts[0][1]) - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, COLORS.get(c, (255, 255, 255)), 2)
            classes.add(NAMES.get(c, str(c)))
        out = OUT_DIR / f"qa_{i:02d}.jpg"
        cv2.imwrite(str(out), im)
        listing.append(f"{out.name}  <-  {img_path.name}  classes={sorted(classes)}")
        print(listing[-1])
    (OUT_DIR / "LISTING.txt").write_text("\n".join(listing) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
