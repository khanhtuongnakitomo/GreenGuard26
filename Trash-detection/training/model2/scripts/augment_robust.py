r"""Model 2 — lighting + steep-angle OBB augmentation (robustness layer).

Targets the two observed failure modes on the booth camera:
  1. extreme lighting (dark / overexposed glare)  -> photometric + CLAHE
  2. steep tilt (bottle leaning far to the side)  -> large-angle OBB rotation

OBB-safe: every geometric transform recomputes the 4 polygon corners exactly
and renormalizes to [0,1]; photometric transforms leave coordinates untouched.
Deterministic per (image, variant), idempotent (existing outputs are skipped).

Runs AFTER augment_owner_live.py (geometric base set). Writes siblings with
suffix _robNN so split_dataset.py groups them with the source photo (no leak)
and dedupe.py does not cull them.

Usage (from training/model2/, model1 venv):
  python scripts/augment_robust.py                     # defaults
  python scripts/augment_robust.py --src owner-live --geom 10 --photo 10
"""
from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "dataset"
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def load_obb(lbl: Path) -> list[list[float]]:
    out = []
    if not lbl.is_file():
        return out
    for ln in lbl.read_text(encoding="utf-8").splitlines():
        p = ln.split()
        if len(p) == 9:
            try:
                out.append([int(p[0])] + [float(v) for v in p[1:]])
            except ValueError:
                continue
    return out


def save_obb(lbl: Path, rows: list[list[float]]) -> None:
    txt = "".join(
        f"{r[0]} " + " ".join(f"{min(1.0, max(0.0, v)):.6f}" for v in r[1:]) + "\n"
        for r in rows
    )
    lbl.write_text(txt, encoding="utf-8")


def affine_poly(pts: np.ndarray, M: np.ndarray, w: int, h: int) -> np.ndarray:
    px = pts.copy()
    px[:, 0] *= w
    px[:, 1] *= h
    ones = np.ones((px.shape[0], 1))
    px = np.concatenate([px, ones], axis=1) @ M.T
    px[:, 0] /= w
    px[:, 1] /= h
    return px


# Steep-angle geometric variants (degrees). Covers side-tilt far beyond the
# base augmenter's +/-12 deg. Border replicated so no black wedges.
GEOM_ANGLES = [-75, -60, -45, -30, -20, 20, 30, 45, 60, 75]


def apply_angle(img: np.ndarray, rows: list[list[float]], deg: float):
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), deg, 1.0)
    out = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
    new_rows = []
    for r in rows:
        pts = np.array(r[1:], dtype=np.float64).reshape(4, 2)
        rot = affine_poly(pts, M, w, h)
        # drop boxes rotated fully out of frame
        if ((rot >= 0) & (rot <= 1)).all():
            new_rows.append([r[0]] + rot.reshape(-1).tolist())
        else:
            rot = np.clip(rot, 0.0, 1.0)
            new_rows.append([r[0]] + rot.reshape(-1).tolist())
    return out, new_rows


# Photometric variants aimed at the lighting gap (median real brightness ~88,
# zero bright frames observed). Gamma/CLAHE/exposure/contrast/noise/blur.
def apply_photo(name: str, img: np.ndarray) -> np.ndarray:
    if name == "gamma_dark":      # simulate under-exposure
        return _gamma(img, 0.5)
    if name == "gamma_vdark":
        return _gamma(img, 0.35)
    if name == "gamma_bright":    # simulate over-exposure
        return _gamma(img, 1.8)
    if name == "gamma_vbright":
        return _gamma(img, 2.4)
    if name == "expo_down":
        return cv2.convertScaleAbs(img, alpha=0.55, beta=-18)
    if name == "expo_up":
        return cv2.convertScaleAbs(img, alpha=1.35, beta=40)
    if name == "clahe":           # local contrast (helps dark caps/labels)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        cl = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(l)
        return cv2.cvtColor(cv2.merge([cl, a, b]), cv2.COLOR_LAB2BGR)
    if name == "lowcontrast":
        return cv2.convertScaleAbs(img, alpha=0.7, beta=25)
    if name == "glare":           # bright hotspot like a lamp reflection
        out = img.astype(np.float32)
        h, w = out.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w]
        cx, cy = w * 0.7, h * 0.3
        mask = np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * (0.25 * w) ** 2)))
        out += (mask[..., None] * 90)
        return np.clip(out, 0, 255).astype(np.uint8)
    if name == "noise_strong":
        rng = np.random.default_rng(abs(hash(img.tobytes()[:64])) % (2**32))
        n = rng.normal(0, 18, img.shape).astype(np.float32)
        return np.clip(img.astype(np.float32) + n, 0, 255).astype(np.uint8)
    raise ValueError(name)


def _gamma(img: np.ndarray, g: float) -> np.ndarray:
    inv = 1.0 / g
    table = (np.linspace(0, 1, 256) ** inv * 255).astype(np.uint8)
    return cv2.LUT(img, table)


PHOTO = [
    "gamma_dark", "gamma_vdark", "gamma_bright", "gamma_vbright",
    "expo_down", "expo_up", "clahe", "lowcontrast", "glare", "noise_strong",
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="owner-live")
    ap.add_argument("--split", default="train")
    ap.add_argument("--geom", type=int, default=len(GEOM_ANGLES))
    ap.add_argument("--photo", type=int, default=len(PHOTO))
    args = ap.parse_args()

    src = DATA_ROOT / "sources" / args.src / args.split
    img_dir, lbl_dir = src / "images", src / "labels"
    if not img_dir.is_dir():
        print(f"ERROR: no {img_dir}")
        return 1

    # Augment BOTH the originals and the base _aug set for combinatorial spread.
    bases = [p for p in sorted(img_dir.iterdir())
             if p.suffix.lower() in IMG_EXT and "_rob" not in p.stem]
    angles = GEOM_ANGLES[: max(0, min(args.geom, len(GEOM_ANGLES)))]
    photos = PHOTO[: max(0, min(args.photo, len(PHOTO)))]

    made = skipped = 0
    for img_path in bases:
        stem = img_path.stem
        rows = load_obb(lbl_dir / f"{stem}.txt")
        if not rows:
            continue
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        variants = [(f"{stem}_rob{idx:02d}", ("g", a)) for idx, a in enumerate(angles)]
        variants += [(f"{stem}_rob{len(angles) + idx:02d}", ("p", p)) for idx, p in enumerate(photos)]
        for new_stem, (kind, val) in variants:
            out_img = img_dir / f"{new_stem}{img_path.suffix.lower()}"
            out_lbl = lbl_dir / f"{new_stem}.txt"
            if out_img.exists():
                skipped += 1
                continue
            if kind == "g":
                vimg, vrows = apply_angle(img, rows, float(val))
            else:
                vimg, vrows = apply_photo(val, img), rows
            cv2.imwrite(str(out_img), vimg)
            save_obb(out_lbl, vrows)
            made += 1
    print(f"bases={len(bases)} angles={len(angles)} photos={len(photos)}")
    print(f"created={made} already-existed={skipped}")
    print(f"total images now: {len(list(img_dir.glob('*')))} in {img_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
