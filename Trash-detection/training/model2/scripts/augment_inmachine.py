r"""Model 2 v6 — in-machine domain-transfer OBB augmentation.

Transfers every source into the geometry + lighting domain measured from the
40 reference frames in dataset/incoming/InMachine (the actual booth webcam):

  GEOMETRY (corners recomputed exactly):
    * angle retargeting: bottle long-axis lands in the measured band
      {-32,-25,-18, 148,155,162} deg (incl. end-for-end flip), NOT blind rot.
    * upward keystone perspective (below-the-rail viewpoint) + small roll.
    * scale retargeting: cap long-edge ~0.07-0.13 of frame W, ring ~0.22-0.39.
    * off-center placement: object centroid pushed into right 45% / upper 55%.
    * 16:9 letterbox to 1280x720 so the field of view matches the webcam.

  LIGHTING (coords unchanged) — incl. the bonus-light regime that does NOT
  exist in the current 40 frames (today: highlight clip ~0.26%):
    * dim (gamma/exposure) -> shadow clip 7-25%
    * bonus-light overexposure: global gain + directional gradient + specular
      blowout blobs -> highlight clip 5-25%
    * veiling glare (LED near lens), cool steel white balance, webcam
      artifacts (JPEG, sensor noise, motion blur along bottle axis).

Deterministic per (image, variant): variant i of <stem> is always the same
transform; re-running skips existing _imNN files. Suffix _im so
split_dataset.py groups siblings with the parent photo (no train/val leak).

Replaces the generic studio _aug variants: use --purge-studio-aug (default on)
to delete studio *_aug* first, keeping owner-live*/owner-live-old aug intact.

Usage (from training/model2/, model1 venv):
  python scripts/augment_inmachine.py                     # full default run
  python scripts/augment_inmachine.py --dry-run           # plan + counts only
  python scripts/augment_inmachine.py --src owner-live --variants 14
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "dataset"
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
SPLITS = ("train", "valid", "test", "val")

# Real booth webcam captures. owner-live = the 40 actual in-machine frames.
REAL_SOURCES = ("owner-live", "owner-live-old")
# Purge generic prior aug (_aug/_rob) from ALL sources before generating _im,
# so in-machine variants REPLACE (not stack on) the old generic ones and the
# pool stays tight for the 3-hour budget. Originals are never touched.
PURGE_SOURCES = STUDIO_SOURCES = (
    "bottle-defect-detection", "Bottle-label", "bottle-label-detection",
    "bottle-label-inspection", "Bottle-lying", "PET-bottle",
    "PET-bottle-with-cap-and-label", "owner-live", "owner-live-old",
)

# Measured from dataset/sources/owner-live/train/labels (ring OBB long axis).
TARGET_ANGLES = (-32.0, -25.0, -18.0, 148.0, 155.0, 162.0)
FRAME_W, FRAME_H = 1280, 720  # 16:9 webcam frame


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
    p = pts.copy(); p[:, 0] *= w; p[:, 1] *= h
    return p


def _to_norm(pts: np.ndarray, w: int, h: int) -> np.ndarray:
    p = pts.copy(); p[:, 0] /= w; p[:, 1] /= h
    return p


def _long_axis_angle_deg(pts_norm: np.ndarray, w: int, h: int) -> float:
    """Angle of an OBB's long edge in degrees, in [-90, 90)."""
    p = _to_px(pts_norm.reshape(4, 2), w, h)
    edges = [(p[1] - p[0]), (p[2] - p[1])]
    i = 0 if np.hypot(*edges[0]) >= np.hypot(*edges[1]) else 1
    ang = math.degrees(math.atan2(edges[i][1], edges[i][0]))
    return (ang + 90.0) % 180.0 - 90.0


def _dominant_angle(rows: list[list[float]], w: int, h: int) -> float | None:
    """Long-axis angle of the largest instance (the bottle body / ring)."""
    if not rows:
        return None
    best, best_area = None, -1.0
    for r in rows:
        pts = np.array(r[1:], dtype=np.float64).reshape(4, 2)
        p = _to_px(pts, w, h)
        a = abs(p[1] - p[0]); b = abs(p[2] - p[1])
        area = float(np.hypot(*a) * np.hypot(*b))
        if area > best_area:
            best_area = area
            best = _long_axis_angle_deg(pts, w, h)
    return best


def _centroid(rows: list[list[float]]) -> tuple[float, float] | None:
    if not rows:
        return None
    xs, ys = [], []
    for r in rows:
        pts = np.array(r[1:], dtype=np.float64).reshape(4, 2)
        xs.append(float(pts[:, 0].mean())); ys.append(float(pts[:, 1].mean()))
    return float(np.mean(xs)), float(np.mean(ys))


# --------------------------------------------------------------------------- #
#  GEOMETRY — replicate the machine camera                                    #
# --------------------------------------------------------------------------- #
def _max_bbox_frac(rows: list[list[float]]) -> float:
    """Largest instance bounding-box area as a fraction of the frame (0-1)."""
    best = 0.0
    for r in rows:
        pts = np.array(r[1:], dtype=np.float64).reshape(4, 2)
        ww = pts[:, 0].max() - pts[:, 0].min()
        hh = pts[:, 1].max() - pts[:, 1].min()
        best = max(best, float(ww * hh))
    return best


def geom_machine(img: np.ndarray, rows: list[list[float]], target_deg: float,
                 tilt: float, roll: float, scale: float,
                 tx: float, ty: float):
    """Retarget pose to the machine view: angle -> keystone -> scale -> place.

    All steps recomputed exactly each step. For source boxes that already fill
    much of the frame (whole-bottle studio labels), the keystone + off-center
    shift is damped so corners don't get clamped into inflated boxes.
    Returns (image, rows) at the SAME w,h (16:9 ensured by caller).
    """
    h, w = img.shape[:2]

    # Damp keystone + placement for already-large boxes to avoid corner clamp.
    frac = _max_bbox_frac(rows)
    if frac > 0.35:
        damp = max(0.0, 1.0 - (frac - 0.35) / 0.35)  # 1.0 at .35 -> 0.0 at .70
        tilt *= damp
        scale = 1.0 + (scale - 1.0) * damp
        # keep large boxes near centre (no aggressive off-centre push)
        tx = 0.5 + (tx - 0.5) * damp
        ty = 0.5 + (ty - 0.5) * damp

    cur = _dominant_angle(rows, w, h)
    rot = 0.0 if cur is None else (target_deg - cur)

    # 1) rotation about centre (angle retarget + roll)
    M = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), rot + roll, scale)
    out = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
    rows = _apply_affine_rows(rows, M, w, h)

    # 2) upward keystone (camera below, looking up) — vertical foreshorten top
    if abs(tilt) > 1e-4:
        M2 = _keystone_matrix(w, h, tilt)
        out = cv2.warpPerspective(out, M2, (w, h), borderMode=cv2.BORDER_REPLICATE)
        rows = _apply_persp_rows(rows, M2, w, h)

    # 3) off-center placement (translate so centroid hits right/upper region)
    cen = _centroid(rows)
    if cen is not None:
        # target centroid: right 45% (x ~0.62-0.80), upper 55% (y ~0.20-0.45)
        dx = (tx - cen[0]) * w
        dy = (ty - cen[1]) * h
        M3 = np.array([[1.0, 0.0, dx], [0.0, 1.0, dy]], dtype=np.float64)
        out = cv2.warpAffine(out, M3, (w, h), borderMode=cv2.BORDER_REPLICATE)
        rows = _apply_affine_rows(rows, M3, w, h)

    # drop degenerate / fully-out-of-frame boxes, keep the rest
    rows = [r for r in rows if _obb_ok(r)]
    return out, rows


def _apply_affine_rows(rows, M, w, h):
    out = []
    for r in rows:
        p = _to_px(np.array(r[1:], dtype=np.float64).reshape(4, 2), w, h)
        p = np.concatenate([p, np.ones((4, 1))], axis=1) @ M.T
        out.append([r[0]] + _to_norm(p, w, h).reshape(-1).tolist())
    return out


def _apply_persp_rows(rows, M, w, h):
    out = []
    for r in rows:
        p = _to_px(np.array(r[1:], dtype=np.float64).reshape(4, 2), w, h)
        p = cv2.perspectiveTransform(p.reshape(1, 4, 2).astype(np.float32), M).reshape(4, 2)
        out.append([r[0]] + _to_norm(p.astype(np.float64), w, h).reshape(-1).tolist())
    return out


def _keystone_matrix(w: int, h: int, tilt: float) -> np.ndarray:
    # narrow the top edge (far side) to fake looking up at the bottle
    d = tilt
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([[w * d, h * d * 0.4], [w * (1 - d), h * d * 0.4],
                      [w, h], [0, h]])
    return cv2.getPerspectiveTransform(src, dst)


def _obb_ok(r) -> bool:
    pts = np.array(r[1:], dtype=np.float64).reshape(4, 2)
    cx, cy = pts[:, 0].mean(), pts[:, 1].mean()
    if not (-0.2 <= cx <= 1.2 and -0.2 <= cy <= 1.2):
        return False
    e0 = np.hypot(pts[1, 0] - pts[0, 0], pts[1, 1] - pts[0, 1])
    e1 = np.hypot(pts[2, 0] - pts[1, 0], pts[2, 1] - pts[1, 1])
    return e0 > 0.004 and e1 > 0.004  # not collapsed


def to_169(img: np.ndarray, rows: list[list[float]]):
    """Center-crop to 16:9 then resize to FRAME_W x FRAME_H (webcam FOV)."""
    h, w = img.shape[:2]
    target = FRAME_W / FRAME_H
    if (w / h) > target:      # too wide -> crop width
        nw = int(h * target); x0 = (w - nw) // 2
        img = img[:, x0:x0 + nw]
        rows = [([r[0]] + _shift_norm(r[1:], -x0 / nw, 0.0, w / nw, 1.0)) for r in rows]
    elif (w / h) < target:    # too tall -> crop height
        nh = int(w / target); y0 = (h - nh) // 2
        img = img[y0:y0 + nh, :]
        rows = [([r[0]] + _shift_norm(r[1:], 0.0, -y0 / nh, 1.0, h / nh)) for r in rows]
    img = cv2.resize(img, (FRAME_W, FRAME_H), interpolation=cv2.INTER_LINEAR)
    return img, rows


def _shift_norm(vals, dx, dy, sx, sy):
    pts = np.array(vals, dtype=np.float64).reshape(4, 2)
    pts[:, 0] = pts[:, 0] * sx + dx
    pts[:, 1] = pts[:, 1] * sy + dy
    return pts.reshape(-1).tolist()


# --------------------------------------------------------------------------- #
#  LIGHTING — machine conditions incl. the bonus light                        #
# --------------------------------------------------------------------------- #
def _gamma(img, g):
    inv = 1.0 / max(1e-3, g)
    table = (np.clip((np.arange(256) / 255.0) ** inv, 0, 1) * 255).astype(np.uint8)
    return cv2.LUT(img, table)


def _cool_wb(img, sat=0.62, blue=1.10):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    out[..., 0] = np.clip(out[..., 0] * blue, 0, 255)   # boost blue channel
    return out.astype(np.uint8)


# Cache the normalised coordinate mesh per image shape — allocating it per
# variant was the throughput bottleneck (25k warps + mgrid allocations).
_MESH: dict[tuple[int, int], tuple[np.ndarray, np.ndarray]] = {}


def _mesh(h: int, w: int) -> tuple[np.ndarray, np.ndarray]:
    key = (h, w)
    if key not in _MESH:
        yy, xx = np.mgrid[0:h, 0:w]
        _MESH[key] = (xx.astype(np.float32) / w, yy.astype(np.float32) / h)
    return _MESH[key]


def _grad_light(img, cx=0.66, cy=0.30, strength=95.0, sigma=0.30):
    out = img.astype(np.float32)
    h, w = out.shape[:2]
    xn, yn = _mesh(h, w)
    mask = np.exp(-(((xn - cx) ** 2 + (yn - cy) ** 2) / (2 * sigma ** 2)))
    out += mask[..., None] * strength
    return np.clip(out, 0, 255).astype(np.uint8)


def _specular_blobs(img, n=3, seed=0):
    rng = np.random.default_rng(seed)
    out = img.astype(np.float32)
    h, w = out.shape[:2]
    xn, yn = _mesh(h, w)
    for _ in range(n):
        cx, cy = rng.uniform(0.55, 0.9), rng.uniform(0.1, 0.45)
        r = rng.uniform(0.03, 0.09)
        m = np.exp(-(((xn - cx) ** 2 + (yn - cy) ** 2) / (2 * r ** 2)))
        out += m[..., None] * rng.uniform(120, 200)
    return np.clip(out, 0, 255).astype(np.uint8)


def _veiling_glare(img, amt=0.22):
    out = img.astype(np.float32)
    out = out * (1 - amt) + 255.0 * amt
    out = cv2.convertScaleAbs(out.astype(np.uint8), alpha=0.9)  # local contrast loss
    return out


def _jpeg(img, q=65):
    enc = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, q])[1]
    return cv2.imdecode(enc, cv2.IMREAD_COLOR)


def _noise(img, sigma=11):
    rng = np.random.default_rng(abs(hash(img.tobytes()[:64])) % (2 ** 32))
    n = rng.normal(0, sigma, img.shape).astype(np.float32)
    return np.clip(img.astype(np.float32) + n, 0, 255).astype(np.uint8)


def _motion_blur_axis(img, rows, k=9):
    # blur along the bottle long axis (the gripper / camera motion direction)
    ang = _dominant_angle(rows, img.shape[1], img.shape[0])
    if ang is None:
        ang = -25.0
    ksize = max(3, k | 1)
    kernel = np.zeros((ksize, ksize), dtype=np.float32)
    kernel[ksize // 2, :] = 1.0
    M = cv2.getRotationMatrix2D((ksize / 2, ksize / 2), ang, 1.0)
    kernel = cv2.warpAffine(kernel, M, (ksize, ksize))
    kernel /= kernel.sum()
    return cv2.filter2D(img, -1, kernel)


def lighting_variant(name: str, img: np.ndarray, rows) -> np.ndarray:
    if name == "dim":
        return _gamma(img, 0.58)
    if name == "dim_deep":
        return _gamma(img, 0.42)
    if name == "expo_down":
        return cv2.convertScaleAbs(img, alpha=0.62, beta=-20)
    if name == "bonus_gain":
        # modest global gain — bright but NOT clipped-to-white (keep texture)
        return cv2.convertScaleAbs(img, alpha=1.35, beta=25)
    if name == "bonus_blowout":
        # directional lamp gradient + a few specular hotspots on the steel
        return _specular_blobs(_grad_light(img, strength=120), n=3, seed=7)
    if name == "bonus_glare":
        return _veiling_glare(cv2.convertScaleAbs(img, alpha=1.3, beta=20), 0.22)
    if name == "cool":
        return _cool_wb(img)
    if name == "cool_dim":
        return _cool_wb(_gamma(img, 0.55))
    if name == "noise":
        return _noise(img, 12)
    if name == "blur":
        return _motion_blur_axis(img, rows, 9)
    if name == "jpeg":
        return _jpeg(img, 60)
    if name == "noisy_jpeg":
        return _jpeg(_noise(img, 9), 62)
    raise ValueError(name)


# Lighting recipe per variant index. Studio gets the 3 core regimes; the real
# booth source gets the full spread.
LIGHT_STUDIO = ["dim", "bonus_blowout", "noisy_jpeg"]
LIGHT_REAL = ["dim", "dim_deep", "expo_down", "bonus_gain", "bonus_blowout",
              "bonus_glare", "cool", "cool_dim", "noise", "blur", "jpeg",
              "noisy_jpeg"]


# --------------------------------------------------------------------------- #
#  Purge generic studio _aug (they get replaced by _im domain variants)       #
# --------------------------------------------------------------------------- #
def purge_generic_aug(dry: bool) -> int:
    """Delete prior generic augmentation (_aug/_rob) so _im replaces them."""
    removed = 0
    for src in PURGE_SOURCES:
        sdir = DATA_ROOT / "sources" / src
        if not sdir.is_dir():
            continue
        for split in SPLITS:
            img_dir = sdir / split / "images"
            if not img_dir.is_dir():
                continue
            for img in img_dir.iterdir():
                if img.suffix.lower() not in IMG_EXT:
                    continue
                if "_aug" in img.stem or "_rob" in img.stem:
                    removed += 1
                    if not dry:
                        img.unlink()
                        lbl = img_dir.parent / "labels" / f"{img.stem}.txt"
                        if lbl.is_file():
                            lbl.unlink()
    return removed


# --------------------------------------------------------------------------- #
#  Per-source variant generation                                              #
# --------------------------------------------------------------------------- #
def _variant_params(idx: int, real: bool) -> dict:
    """Deterministic (geometry, lighting) recipe for variant index idx."""
    lights = LIGHT_REAL if real else LIGHT_STUDIO
    li = idx % len(lights)
    gi = idx // len(lights)
    return {
        "target": TARGET_ANGLES[(idx + gi) % len(TARGET_ANGLES)],
        "tilt": 0.08 + 0.02 * ((idx * 7) % 4),          # 0.08 - 0.14
        "roll": -4.0 + 2.0 * ((idx * 5) % 5),           # -4..+4
        "scale": 0.9 + 0.08 * ((idx * 3) % 6),          # 0.90 - 1.30
        "tx": 0.62 + 0.045 * ((idx * 11) % 4),          # right 45%  (0.62-0.75)
        "ty": 0.20 + 0.08 * ((idx * 13) % 4),           # upper 55%  (0.20-0.44)
        "light": lights[li],
    }


def process_source(src: str, n_variants: int, dry: bool, force: bool) -> tuple[int, int, int]:
    """Returns (bases, made, skipped)."""
    made = skipped = bases = 0
    real = src in REAL_SOURCES
    for split in SPLITS:
        img_dir = DATA_ROOT / "sources" / src / split / "images"
        lbl_dir = DATA_ROOT / "sources" / src / split / "labels"
        if not img_dir.is_dir():
            continue
        # Generate _im ONLY from originals (no stacking _im on _aug/_rob/_im).
        originals = [p for p in sorted(img_dir.iterdir())
                     if p.suffix.lower() in IMG_EXT
                     and "_im" not in p.stem and "_rob" not in p.stem
                     and "_aug" not in p.stem]
        for img_path in originals:
            stem = img_path.stem
            bases += 1
            if dry:
                made += n_variants
                continue
            rows = load_obb(lbl_dir / f"{stem}.txt")
            img = cv2.imread(str(img_path))
            if img is None:
                skipped += n_variants
                continue
            base_img, base_rows = to_169(img, rows)
            for idx in range(n_variants):
                new_stem = f"{stem}_im{idx:02d}"
                out_img = img_dir / f"{new_stem}{img_path.suffix.lower()}"
                out_lbl = lbl_dir / f"{new_stem}.txt"
                if out_img.exists() and not force:
                    skipped += 1
                    continue
                prm = _variant_params(idx, real)
                vimg, vrows = geom_machine(
                    base_img, base_rows, prm["target"], prm["tilt"], prm["roll"],
                    prm["scale"], prm["tx"], prm["ty"])
                vimg = lighting_variant(prm["light"], vimg, vrows)
                cv2.imwrite(str(out_img), vimg)
                save_obb(out_lbl, vrows)
                made += 1
    return bases, made, skipped


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=None, help="single source (default: all)")
    ap.add_argument("--studio-variants", type=int, default=3)
    ap.add_argument("--real-variants", type=int, default=14,
                    help="owner-live (real booth frames)")
    ap.add_argument("--old-variants", type=int, default=4, help="owner-live-old")
    ap.add_argument("--variants", type=int, default=None,
                    help="override for --src regardless of kind")
    ap.add_argument("--purge-studio-aug", action="store_true", default=True)
    ap.add_argument("--no-purge", dest="purge_studio_aug", action="store_false")
    ap.add_argument("--force", action="store_true", help="regenerate existing _im variants")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    summary = {}
    if args.purge_studio_aug:
        n = purge_generic_aug(args.dry_run)
        summary["purged_generic_aug"] = n
        print(f"[purge] generic _aug/_rob removed: {n}{' (dry)' if args.dry_run else ''}")

    if args.src:
        sources = [args.src]
    else:
        sources = [p.name for p in sorted((DATA_ROOT / "sources").iterdir()) if p.is_dir()]

    total_made = total_skip = 0
    for src in sources:
        if src in REAL_SOURCES:
            nv = args.variants or (args.real_variants if src == "owner-live" else args.old_variants)
        else:
            nv = args.variants or args.studio_variants
        bases, made, skip = process_source(src, nv, args.dry_run, args.force)
        summary[src] = {"bases": bases, "made": made, "skipped": skip, "variants_per_base": nv}
        total_made += made; total_skip += skip
        print(f"  {src:<34} bases={bases:<5} variants/base={nv:<3} "
              f"made={made:<6} skip={skip}")

    summary["TOTAL"] = {"made": total_made, "skipped": total_skip}
    print(json.dumps(summary, indent=2))
    print(f"TOTAL created={total_made} skipped={total_skip}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
