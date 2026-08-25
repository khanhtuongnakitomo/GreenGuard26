"""Render sample images with OBB polygons drawn, for visual class verification.

Usage:
  python scripts/render_samples.py <dataset> <split> <class_id> <n> [out_prefix]
Writes to logs/render/<out_prefix>_<class_id>_<i>.jpg
"""
from __future__ import annotations

import sys
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[1]
INCOMING = ROOT.parent / "dataset" / "sources"
OUT = ROOT / "logs" / "render"

COLORS = [
    (0, 0, 255), (0, 255, 0), (255, 0, 0), (0, 255, 255),
    (255, 0, 255), (255, 255, 0), (128, 128, 255), (128, 255, 128),
]


def main() -> int:
    ds, split, cls, n = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    prefix = sys.argv[5] if len(sys.argv) > 5 else ds
    ds_dir = INCOMING / ds
    import yaml  # noqa: PLC0415

    names = {int(k): v for k, v in yaml.safe_load((ds_dir / "data.yaml").read_text(encoding="utf-8"))["names"].items()}
    img_dir = ds_dir / split / "images"
    lbl_dir = ds_dir / split / "labels"
    OUT.mkdir(parents=True, exist_ok=True)

    drawn = 0
    for img in sorted(img_dir.iterdir()):
        if drawn >= n:
            break
        lbl = lbl_dir / (img.stem + ".txt")
        if not lbl.is_file():
            continue
        lines = [ln.split() for ln in lbl.read_text(encoding="utf-8").splitlines() if ln.strip()]
        if not any(int(p[0]) == cls for p in lines):
            continue
        im = cv2.imread(str(img))
        if im is None:
            continue
        h, w = im.shape[:2]
        for p in lines:
            c = int(p[0])
            pts = [(float(p[1 + 2 * i]) * w, float(p[2 + 2 * i]) * h) for i in range(4)]
            color = COLORS[c % len(COLORS)]
            cv2.polylines(im, [np_int(pts)], True, color, 3)
            x, y = int(pts[0][0]), int(pts[0][1])
            cv2.putText(im, f"{c}:{names.get(c, '?')}", (x, max(20, y - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
        out_file = OUT / f"{prefix}_c{cls}_{drawn:02d}.jpg"
        cv2.imwrite(str(out_file), im)
        print(f"{out_file.name}  <- {img.name} (classes present: {sorted({int(p[0]) for p in lines})})")
        drawn += 1
    if drawn == 0:
        print(f"no images with class {cls} found in {ds}/{split}")
    return 0


def np_int(pts: list[tuple[float, float]]):
    import numpy as np  # noqa: PLC0415

    return np.array(pts, dtype=np.int32)


if __name__ == "__main__":
    raise SystemExit(main())
