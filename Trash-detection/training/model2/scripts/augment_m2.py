r"""Model 2 v5 — all-angle / all-light offline OBB augmentation.

Targets the two measured failure modes of m2v4:
  * dark / over-bright lighting   (owner-live originals: brightness 50-114, no bright frames)
  * tilted / off-center bottles    (train.py had degrees=0.0, no perspective/translate/scale)

Two families, every transform recomputes the 4 OBB corners exactly so labels stay valid:

  LIGHTING (coords unchanged): gamma, exposure, CLAHE, highlight rolloff,
      Gaussian/Poisson noise, motion blur, HSV jitter.
  POSE     (corners recomputed): rot90/180/270, arbitrary rotate +-35 deg,
      perspective warp, scale 0.6-1.4, translate, hflip, vflip.

Deterministic + idempotent: variant i of image <stem> is always the same
transform; re-running skips files that already exist (suffix _augNN). Grouped
split keeps each photo's variants in one split (no train/val leakage).

Usage (from training/model2/, model1 venv):
  python scripts/augment_m2.py                          # defaults
  python scripts/augment_m2.py --src owner-live --light 6 --pose 8
  python scripts/augment_m2.py --all-sources --real-only   # only owner-live*
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "dataset"
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

# Sources that are real booth webcam captures (get the heaviest augmentation).
# NOTE: owner-live-old is a Roboflow augmented export, not raw webcam — studio.
REAL_SOURCES = ("owner-live",)


# --------------------------------------------------------------------------- #
#  OBB label I/O                                                              #
# --------------------------------------------------------------------------- #
def load_obb(lbl: Path) -> list[list[float]]:
    out: list[list[float]] = []
    if not lbl.is_file():
        return out
    for ln in lbl.read_text(encoding="utf-8").splitlines():
        p = ln.split()
        if len(p) == 9:
            try:
                out.append([int(float(p[0]))] + [float(v) for v in p[1:]])
            except ValueError:
                continue
    return out


def save_obb(lbl: Path, rows: list[list[float]]) -> None:
    txt = "".join(
        f"{r[0]} " + " ".join(f"{min(1.0, max(0.0, v)):.6f}" for v in r[1:]) + "\n"
        for r in rows
    )
    lbl.write_text(txt, encoding="utf-8")


def _to_px(pts: np.ndarray, w: int, h: int) -> np.ndarray:
    p = pts.copy()
    p[:, 0] *= w
    p[:, 1] *= h
    return p


def _to_norm(pts: np.ndarray, w: int, h: int) -> np.ndarray:
    p = pts.copy()
    p[:, 0] /= w
    p[:, 1] /= h
    return p


# --------------------------------------------------------------------------- #
#  POSE family (geometry)                                                     #
# --------------------------------------------------------------------------- #
def pose_rot90(img, rows, k):
    h, w = img.shape[:2]
    out = np.rot90(img, k).copy()
    nw, nh = (h, w) if k % 2 == 1 else (w, h)
    new = []
    for r in rows:
        p = _to_px(np.array(r[1:], dtype=np.float64).reshape(4, 2), w, h)
        ww, hh = w, h
        for _ in range(k % 4):
            p = np.stack([p[:, 1], (ww - 1) - p[:, 0]], axis=1)
            ww, hh = hh, ww
        new.append([r[0]] + _to_norm(p, nw, nh).reshape(-1).tolist())
    return out, new


def pose_hflip(img, rows):
    out = cv2.flip(img, 1)
    new = []
    for r in rows:
        p = np.array(r[1:], dtype=np.float64).reshape(4, 2).copy()
        p[:, 0] = 1.0 - p[:, 0]
        new.append([r[0]] + p.reshape(-1).tolist())
    return out, new


def pose_vflip(img, rows):
    out = cv2.flip(img, 0)
    new = []
    for r in rows:
        p = np.array(r[1:], dtype=np.float64).reshape(4, 2).copy()
        p[:, 1] = 1.0 - p[:, 1]
        new.append([r[0]] + p.reshape(-1).tolist())
    return out, new


def _affine(img, rows, M):
    h, w = img.shape[:2]
    out = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
    new = []
    for r in rows:
        p = _to_px(np.array(r[1:], dtype=np.float64).reshape(4, 2), w, h)
        p = np.concatenate([p, np.ones((4, 1))], axis=1) @ M.T
        new.append([r[0]] + _to_norm(p, w, h).reshape(-1).tolist())
    return out, new


def pose_rotate(img, rows, deg):
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), deg, 1.0)
    return _affine(img, rows, M)


def pose_scale(img, rows, s):
    h, w = img.shape[:2]
    M = np.array([[s, 0, w * (1 - s) / 2.0], [0, s, h * (1 - s) / 2.0]], dtype=np.float64)
    return _affine(img, rows, M)


def pose_translate(img, rows, fx, fy):
    h, w = img.shape[:2]
    M = np.array([[1, 0, w * fx], [0, 1, h * fy]], dtype=np.float64)
    return _affine(img, rows, M)


def pose_perspective(img, rows, tilt):
    h, w = img.shape[:2]
    d = tilt
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([[w * d, h * d], [w * (1 - d), h * d * 0.5],
                      [w * (1 - d), h * (1 - d)], [w * d, h * (1 - d * 0.5)]])
    M = cv2.getPerspectiveTransform(src, dst)
    out = cv2.warpPerspective(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
    new = []
    for r in rows:
        p = _to_px(np.array(r[1:], dtype=np.float64).reshape(4, 2), w, h)
        p = cv2.perspectiveTransform(p.reshape(1, 4, 2).astype(np.float32), M).reshape(4, 2)
        new.append([r[0]] + _to_norm(p.astype(np.float64), w, h).reshape(-1).tolist())
    return out, new


POSE = [
    lambda im, r: pose_rot90(im, r, 1),
    lambda im, r: pose_rot90(im, r, 2),
    lambda im, r: pose_rot90(im, r, 3),
    pose_hflip,
    pose_vflip,
    lambda im, r: pose_rotate(im, r, 35),
    lambda im, r: pose_rotate(im, r, -35),
    lambda im, r: pose_scale(im, r, 1.3),
    lambda im, r: pose_scale(im, r, 0.7),
    lambda im, r: pose_translate(im, r, 0.12, -0.08),
    lambda im, r: pose_translate(im, r, -0.12, 0.08),
    lambda im, r: pose_perspective(im, r, 0.10),
    lambda im, r: pose_perspective(im, r, -0.08),
]


# --------------------------------------------------------------------------- #
#  LIGHTING family (photometric, coords unchanged)                            #
# --------------------------------------------------------------------------- #
def _gamma(img, g):
    inv = 1.0 / max(1e-3, g)
    table = (np.clip((np.arange(256) / 255.0) ** inv, 0, 1) * 255).astype(np.uint8)
    return cv2.LUT(img, table)


def _clahe(img, clip=3.0):
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    cl = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8)).apply(l)
    return cv2.cvtColor(cv2.merge([cl, a, b]), cv2.COLOR_LAB2BGR)


def _rolloff(img):
    # tame blown highlights: compress top end smoothly
    x = img.astype(np.float32) / 255.0
    y = np.where(x > 0.8, 0.8 + (x - 0.8) * 0.4, x)
    return (np.clip(y, 0, 1) * 255).astype(np.uint8)


def _noise(img, sigma):
    rng = np.random.default_rng(abs(hash(img.tobytes()[:64])) % (2**32))
    n = rng.normal(0, sigma, img.shape).astype(np.float32)
    return np.clip(img.astype(np.float32) + n, 0, 255).astype(np.uint8)


def _motion_blur(img, k=9, deg=20):
    ksize = max(3, k | 1)
    kernel = np.zeros((ksize, ksize), dtype=np.float32)
    kernel[ksize // 2, :] = 1.0
    M = cv2.getRotationMatrix2D((ksize / 2, ksize / 2), deg, 1.0)
    kernel = cv2.warpAffine(kernel, M, (ksize, ksize))
    kernel /= kernel.sum()
    return cv2.filter2D(img, -1, kernel)


def _hsv(img, dh=8, ds=1.2, dv=1.0):
    out = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.int16)
    out[..., 0] = (out[..., 0] + dh) % 180
    out[..., 1] = np.clip(out[..., 1] * ds, 0, 255)
    out[..., 2] = np.clip(out[..., 2] * dv, 0, 255)
    return cv2.cvtColor(out.astype(np.uint8), cv2.COLOR_HSV2BGR)


LIGHTING = [
    lambda im: _gamma(im, 0.45),          # strong dark
    lambda im: _gamma(im, 0.65),          # mild dark
    lambda im: _gamma(im, 1.8),           # bright
    lambda im: cv2.convertScaleAbs(im, alpha=1.0, beta=-45),  # exposure down
    lambda im: cv2.convertScaleAbs(im, alpha=1.0, beta=45),   # exposure up
    _clahe,                               # contrast normalize (helps dark)
    _rolloff,                             # highlight compress
    lambda im: _noise(im, 12),            # sensor noise
    lambda im: _motion_blur(im, 9, 20),   # motion blur
    lambda im: _hsv(im, 8, 1.2, 1.0),     # hue/sat shift
]


def process_source(src: str, split: str, n_light: int, n_pose: int) -> tuple[int, int]:
    img_dir = DATA_ROOT / "sources" / src / split / "images"
    lbl_dir = DATA_ROOT / "sources" / src / split / "labels"
    if not img_dir.is_dir():
        return 0, 0
    originals = [p for p in sorted(img_dir.iterdir())
                 if p.suffix.lower() in IMG_EXT and "_aug" not in p.stem]
    lights = LIGHTING[: max(0, min(n_light, len(LIGHTING)))]
    poses = POSE[: max(0, min(n_pose, len(POSE)))]
    made = skipped = 0
    for img_path in originals:
        stem = img_path.stem
        rows = load_obb(lbl_dir / f"{stem}.txt")
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        variants = [(fn, "light") for fn in lights] + [(fn, "pose") for fn in poses]
        for idx, (fn, kind) in enumerate(variants):
            new_stem = f"{stem}_aug{idx:02d}"
            out_img = img_dir / f"{new_stem}{img_path.suffix.lower()}"
            out_lbl = lbl_dir / f"{new_stem}.txt"
            if out_img.exists():
                skipped += 1
                continue
            if kind == "light":
                vimg, vrows = fn(img), rows
            else:
                vimg, vrows = fn(img, rows)
            cv2.imwrite(str(out_img), vimg)
            save_obb(out_lbl, vrows)
            made += 1
    return made, skipped


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=None, help="single source (default: all under sources/)")
    ap.add_argument("--split", default="train")
    ap.add_argument("--light", type=int, default=6, help="lighting variants per image (max %d)" % len(LIGHTING))
    ap.add_argument("--pose", type=int, default=8, help="pose variants per image (max %d)" % len(POSE))
    ap.add_argument("--real-only", action="store_true", help="only owner-live* sources")
    ap.add_argument("--all-sources", action="store_true", help="explicitly all sources")
    args = ap.parse_args()

    src_root = DATA_ROOT / "sources"
    if args.src:
        sources = [args.src]
    else:
        sources = [p.name for p in sorted(src_root.iterdir()) if p.is_dir()]
        if args.real_only:
            sources = [s for s in sources if s in REAL_SOURCES]

    total_made = total_skip = 0
    print(f"sources: {sources}")
    for src in sources:
        # Real webcam sources: full lighting + pose (that's where m2v4 failed).
        # Studio (Roboflow) sources are already rotated/clean -> lighting only,
        # so we don't flood training with synthetic pose of synthetic images.
        if src in REAL_SOURCES:
            light, pose = args.light, args.pose          # real webcam: 6 light + 8 pose = x15
        else:
            light, pose = min(2, args.light), 0           # studio: 2 lighting variants = x3
        made, skip = process_source(src, args.split, light, pose)
        total_made += made
        total_skip += skip
        if made or skip:
            print(f"  {src:<32} +{made:<5} (skip {skip})  [light={light} pose={pose}]")
    print(f"TOTAL created={total_made} already-existed={total_skip}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
