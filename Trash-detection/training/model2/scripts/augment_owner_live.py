r"""Model 2 — offline OBB-aware augmentation for small sources (owner-live).

Multiplies images in dataset/sources/<src>/<split>/{images,labels} while keeping
YOLOv8-OBB labels correct. Two families:

  geometric  — rot90/180/270, hflip, vflip, small-angle rotate, scale,
               translate+crop. Polygon corners are recomputed exactly and
               renormalized; labels stay valid OBB quads.
  photometric— brightness/contrast/HSV/noise/blur. Coordinates unchanged.

Deterministic: variant i of image <stem> is always the same transform, so
re-running is idempotent (existing augmented files are skipped, not doubled).

Leakage safety: augmented stems keep the original stem + suffix `_augNN`, and
split_dataset.py groups by (source, original-stem) — siblings of one photo
land in the SAME split.

Usage (from training/model2/, model1 venv):
  python scripts/augment_owner_live.py                  # defaults below
  python scripts/augment_owner_live.py --src owner-live --split train `
      --geom 8 --photo 4                                # 35 -> 35*(1+12)=455
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "dataset"   # training/model2/dataset/
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def load_obb(lbl: Path) -> list[list[float]]:
    out = []
    if not lbl.is_file():
        return out
    for ln in lbl.read_text(encoding="utf-8").splitlines():
        p = ln.split()
        if len(p) == 9:
            out.append([int(p[0])] + [float(v) for v in p[1:]])
    return out


def save_obb(lbl: Path, rows: list[list[float]]) -> None:
    txt = "".join(
        f"{r[0]} " + " ".join(f"{min(1.0, max(0.0, v)):.6f}" for v in r[1:]) + "\n"
        for r in rows
    )
    lbl.write_text(txt, encoding="utf-8")


def rot90_poly(pts: np.ndarray, k: int, w: int, h: int) -> tuple[np.ndarray, int, int]:
    """Rotate normalized poly k*90 deg CCW. Returns (pts, new_w, new_h)."""
    px = pts.copy()
    px[:, 0] *= w
    px[:, 1] *= h
    for _ in range(k % 4):
        px = np.stack([px[:, 1], (w - 1) - px[:, 0]], axis=1)
        w, h = h, w
    px[:, 0] /= w
    px[:, 1] /= h
    return px, w, h


def hflip_poly(pts: np.ndarray) -> np.ndarray:
    pts = pts.copy()
    pts[:, 0] = 1.0 - pts[:, 0]
    return pts  # NMS/decoder use the quad as a set of corners; winding irrelevant


def vflip_poly(pts: np.ndarray) -> np.ndarray:
    pts = pts.copy()
    pts[:, 1] = 1.0 - pts[:, 1]
    return pts


def affine_poly(pts: np.ndarray, M: np.ndarray, w: int, h: int) -> np.ndarray:
    px = pts.copy()
    px[:, 0] *= w
    px[:, 1] *= h
    ones = np.ones((px.shape[0], 1))
    px = np.concatenate([px, ones], axis=1) @ M.T
    px[:, 0] /= w
    px[:, 1] /= h
    return px


GEOM = [
    "rot90", "rot180", "rot270", "hflip", "vflip",
    "rot+12", "rot-12", "scale1.15", "scale0.85", "shift",
]


def apply_geom(name: str, img: np.ndarray, rows: list[list[float]]):
    h, w = img.shape[:2]
    pts = [np.array(r[1:], dtype=np.float64).reshape(4, 2) for r in rows]
    cls = [r[0] for r in rows]

    if name.startswith("rot") and name[3:].lstrip("+-").isdigit() and name in ("rot90", "rot180", "rot270"):
        k = {"rot90": 1, "rot180": 2, "rot270": 3}[name]
        out = np.rot90(img, k).copy()
        new_pts = []
        for p in pts:
            np_pts, _, _ = rot90_poly(p, k, w, h)
            new_pts.append(np_pts)
        return out, [[c] + p.reshape(-1).tolist() for c, p in zip(cls, new_pts)]
    if name == "hflip":
        return cv2.flip(img, 1), [[c] + hflip_poly(p).reshape(-1).tolist() for c, p in zip(cls, pts)]
    if name == "vflip":
        return cv2.flip(img, 0), [[c] + vflip_poly(p).reshape(-1).tolist() for c, p in zip(cls, pts)]
    if name in ("rot+12", "rot-12"):
        ang = 12.0 if name == "rot+12" else -12.0
        M = cv2.getRotationMatrix2D((w / 2, h / 2), ang, 1.0)
        out = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
        return out, [[c] + affine_poly(p, M, w, h).reshape(-1).tolist() for c, p in zip(cls, pts)]
    if name.startswith("scale"):
        s = float(name[5:])
        M = np.array([[s, 0, w * (1 - s) / 2], [0, s, h * (1 - s) / 2]], dtype=np.float64)
        out = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
        return out, [[c] + affine_poly(p, M, w, h).reshape(-1).tolist() for c, p in zip(cls, pts)]
    if name == "shift":
        M = np.array([[1, 0, w * 0.05], [0, 1, -h * 0.05]], dtype=np.float64)
        out = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
        return out, [[c] + affine_poly(p, M, w, h).reshape(-1).tolist() for c, p in zip(cls, pts)]
    raise ValueError(name)


PHOTO = ["bright", "dark", "contrast", "noise", "blur", "hsv"]


def apply_photo(name: str, img: np.ndarray) -> np.ndarray:
    if name == "bright":
        return cv2.convertScaleAbs(img, alpha=1.0, beta=28)
    if name == "dark":
        return cv2.convertScaleAbs(img, alpha=1.0, beta=-28)
    if name == "contrast":
        return cv2.convertScaleAbs(img, alpha=1.25, beta=-20)
    if name == "noise":
        rng = np.random.default_rng(abs(hash(img.tobytes()[:64])) % (2**32))
        n = rng.normal(0, 9, img.shape).astype(np.float32)
        return np.clip(img.astype(np.float32) + n, 0, 255).astype(np.uint8)
    if name == "blur":
        return cv2.GaussianBlur(img, (5, 5), 0)
    if name == "hsv":
        out = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.int16)
        out[..., 0] = (out[..., 0] + 8) % 180
        out[..., 1] = np.clip(out[..., 1] * 1.15, 0, 255)
        return cv2.cvtColor(out.astype(np.uint8), cv2.COLOR_HSV2BGR)
    raise ValueError(name)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="owner-live")
    ap.add_argument("--split", default="train")
    ap.add_argument("--geom", type=int, default=8, help="geometric variants per image (max %d)" % len(GEOM))
    ap.add_argument("--photo", type=int, default=4, help="photometric variants per image (max %d)" % len(PHOTO))
    args = ap.parse_args()

    src = DATA_ROOT / "sources" / args.src / args.split
    img_dir, lbl_dir = src / "images", src / "labels"
    if not img_dir.is_dir():
        print(f"ERROR: no {img_dir}")
        return 1

    originals = [p for p in sorted(img_dir.iterdir())
                 if p.suffix.lower() in IMG_EXT and "_aug" not in p.stem]
    geoms = GEOM[: max(0, min(args.geom, len(GEOM)))]
    photos = PHOTO[: max(0, min(args.photo, len(PHOTO)))]

    made = skipped = 0
    for img_path in originals:
        stem = img_path.stem
        rows = load_obb(lbl_dir / f"{stem}.txt")
        img = cv2.imread(str(img_path))
        if img is None:
            print(f"[skip] unreadable {img_path.name}")
            continue
        variants = [(f"{stem}_aug{idx:02d}", g, "geom") for idx, g in enumerate(geoms)]
        variants += [(f"{stem}_aug{len(geoms) + idx:02d}", p, "photo") for idx, p in enumerate(photos)]
        for new_stem, tname, kind in variants:
            out_img = img_dir / f"{new_stem}{img_path.suffix.lower()}"
            out_lbl = lbl_dir / f"{new_stem}.txt"
            if out_img.exists():
                skipped += 1
                continue
            if kind == "geom":
                vimg, vrows = apply_geom(tname, img, rows)
            else:
                vimg, vrows = apply_photo(tname, img), rows
            cv2.imwrite(str(out_img), vimg)
            save_obb(out_lbl, vrows)
            made += 1
    print(f"originals={len(originals)} geom={len(geoms)} photo={len(photos)}")
    print(f"created={made} already-existed={skipped}")
    print(f"total images now: {len(list(img_dir.glob('*')))} in {img_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
