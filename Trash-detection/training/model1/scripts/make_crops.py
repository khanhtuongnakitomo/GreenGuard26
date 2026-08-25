r"""Build YOLO classification crops from Model 1 OBB splits (Fix B).

Reads dataset/model1/splits/{train,val,test} and writes:
  dataset/model1/crops/{train,val,test}/{pet,can}/*.jpg

Rules:
  - Crops inherit the parent image split (no leakage).
  - Skip crops whose short side < --min-px (default 64).
  - Train split only: cap the majority class to match the minority count.

Usage:
  python scripts/make_crops.py
  python scripts/make_crops.py --margin 0.12 --min-px 64
"""
from __future__ import annotations

import argparse
import random
import shutil
from collections import Counter
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT.parent / "dataset" / "model1"
SPLITS = DATA / "splits"
OUT = DATA / "crops"
CLASS_DIRS = {0: "pet", 1: "can"}
SPLIT_NAMES = ("train", "val", "test")


def obb_to_crop(img: np.ndarray, coords: list[float], margin: float) -> np.ndarray | None:
    h, w = img.shape[:2]
    xs = [coords[i] * w for i in (0, 2, 4, 6)]
    ys = [coords[i] * h for i in (1, 3, 5, 7)]
    x1, x2 = min(xs), max(xs)
    y1, y2 = min(ys), max(ys)
    bw, bh = x2 - x1, y2 - y1
    if bw < 1 or bh < 1:
        return None
    x1 = max(0, int(x1 - bw * margin))
    y1 = max(0, int(y1 - bh * margin))
    x2 = min(w, int(x2 + bw * margin))
    y2 = min(h, int(y2 + bh * margin))
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    if min(crop.shape[:2]) < 1:
        return None
    return crop


def extract_split(split: str, margin: float, min_px: int) -> dict[str, list[Path]]:
    img_dir = SPLITS / split / "images"
    lbl_dir = SPLITS / split / "labels"
    buckets: dict[str, list[Path]] = {v: [] for v in CLASS_DIRS.values()}

    for lbl_path in sorted(lbl_dir.glob("*.txt")):
        stem = lbl_path.stem
        img_path = img_dir / f"{stem}.jpg"
        if not img_path.is_file():
            for ext in (".jpeg", ".png", ".webp"):
                alt = img_dir / f"{stem}{ext}"
                if alt.is_file():
                    img_path = alt
                    break
            else:
                continue
        img = cv2.imread(str(img_path))
        if img is None:
            continue

        for idx, line in enumerate(lbl_path.read_text(encoding="utf-8").splitlines()):
            parts = line.split()
            if len(parts) < 9:
                continue
            cls = int(float(parts[0]))
            if cls not in CLASS_DIRS:
                continue
            coords = [float(x) for x in parts[1:9]]
            crop = obb_to_crop(img, coords, margin)
            if crop is None:
                continue
            if min(crop.shape[:2]) < min_px:
                continue
            out_dir = OUT / split / CLASS_DIRS[cls]
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{stem}_{idx:02d}.jpg"
            cv2.imwrite(str(out_path), crop)
            buckets[CLASS_DIRS[cls]].append(out_path)
    return buckets


def balance_train(buckets: dict[str, list[Path]], seed: int) -> None:
    rng = random.Random(seed)
    n_pet, n_can = len(buckets["pet"]), len(buckets["can"])
    target = min(n_pet, n_can)
    if n_pet <= target and n_can <= target:
        return
    for name, paths in buckets.items():
        if len(paths) <= target:
            continue
        rng.shuffle(paths)
        for p in paths[target:]:
            p.unlink(missing_ok=True)
        buckets[name] = paths[:target]
    print(f"  train balanced -> pet={len(buckets['pet'])} can={len(buckets['can'])} "
          f"(was pet={n_pet} can={n_can})")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--margin", type=float, default=0.10,
                    help="fractional margin around OBB axis-aligned crop")
    ap.add_argument("--min-px", type=int, default=64,
                    help="skip crops whose short side is below this")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--no-balance", action="store_true",
                    help="keep all train crops (no majority cap)")
    args = ap.parse_args()

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True, exist_ok=True)

    totals: Counter = Counter()
    for split in SPLIT_NAMES:
        if not (SPLITS / split / "labels").is_dir():
            print(f"skip missing split: {split}")
            continue
        buckets = extract_split(split, args.margin, args.min_px)
        if split == "train" and not args.no_balance:
            balance_train(buckets, args.seed)
        for name, paths in buckets.items():
            totals[f"{split}/{name}"] = len(paths)
            print(f"  {split}/{name}: {len(paths)}")

    (OUT / "README.txt").write_text(
        "YOLO cls layout: crops/{train,val,test}/{pet,can}/*.jpg\n"
        f"margin={args.margin} min_px={args.min_px}\n",
        encoding="utf-8",
    )
    print(f"\nDONE -> {OUT}")
    print("counts:", dict(totals))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
