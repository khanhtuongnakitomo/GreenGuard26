r"""Train-only appearance simulation (deterministic, OpenCV, labels unchanged).

Applies up to 25% of TRAIN images: 720p downscale/upscale, JPEG 55-85,
mild blur, sensor noise, brightness/white-balance jitter. Generated copies
carry the source stem + "_asim" suffix so the grouped split keeps them with
their originals (run this BEFORE split_dataset.py, never on val/test).

Usage:
  python scripts\appearance_sim.py            # M1
  python scripts\appearance_sim.py --model 2  # M2
  python scripts\appearance_sim.py --fraction 0.25 --seed 42
"""
from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parent / "dataset"
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def degrade(img: np.ndarray, rng: random.Random) -> np.ndarray:
    h, w = img.shape[:2]
    out = img
    # 720p downscale -> upscale
    if rng.random() < 0.5:
        scale = 720.0 / max(h, w) * rng.uniform(0.5, 1.0)
        small = cv2.resize(out, (max(8, int(w * scale)), max(8, int(h * scale))))
        out = cv2.resize(small, (w, h))
    # mild blur
    if rng.random() < 0.4:
        k = rng.choice([3, 5])
        if rng.random() < 0.5:
            out = cv2.GaussianBlur(out, (k, k), 0)
        else:
            ksize = rng.randint(3, 9)
            kern = np.zeros((ksize, ksize)); kern[ksize // 2] = 1.0 / ksize
            out = cv2.filter2D(out, -1, kern)
    # sensor noise
    if rng.random() < 0.4:
        noise = np.random.default_rng(rng.randint(0, 2**31)).normal(
            0, rng.uniform(3, 9), out.shape)
        out = np.clip(out.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    # brightness / white balance
    if rng.random() < 0.5:
        alpha = rng.uniform(0.85, 1.15)   # contrast
        beta = rng.uniform(-25, 25)       # brightness
        out = cv2.convertScaleAbs(out, alpha=alpha, beta=beta)
        gains = np.array([rng.uniform(0.95, 1.05) for _ in range(3)])
        out = np.clip(out.astype(np.float32) * gains, 0, 255).astype(np.uint8)
    # JPEG artifact (always, quality 55-85)
    q = rng.randint(55, 85)
    _, enc = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, q])
    return cv2.imdecode(enc, cv2.IMREAD_COLOR)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", type=int, default=1, choices=[1, 2])
    ap.add_argument("--fraction", type=float, default=0.25)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    img_dir = DATA_ROOT / f"model{args.model}" / "normalized" / "images"
    lbl_dir = DATA_ROOT / f"model{args.model}" / "normalized" / "labels"
    rng = random.Random(args.seed)
    images = sorted(p for p in img_dir.iterdir()
                    if p.suffix.lower() in IMG_EXT and "_asim" not in p.stem)
    n_gen = int(len(images) * args.fraction)
    rng.shuffle(images)
    made = 0
    for p in images[:n_gen]:
        img = cv2.imread(str(p))
        if img is None:
            continue
        stem = p.stem + "_asim"
        cv2.imwrite(str(img_dir / (stem + ".jpg")), degrade(img, rng),)
        lbl = lbl_dir / (p.stem + ".txt")
        if lbl.is_file():
            (lbl_dir / (stem + ".txt")).write_text(
                lbl.read_text(encoding="utf-8"), encoding="utf-8")
        else:
            (lbl_dir / (stem + ".txt")).write_text("", encoding="utf-8")
        made += 1
    print(f"appearance sim: {made} train-only degraded copies ("
          f"{100*args.fraction:.0f}% of {len(images)}) in normalized/, "
          f"labels copied, suffix _asim")
    return 0


if __name__ == "__main__":
    sys.exit(main())
