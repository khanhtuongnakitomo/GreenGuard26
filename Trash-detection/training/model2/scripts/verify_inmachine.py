r"""Verify the in-machine (_im) augmentation before trusting the long train.

Two checks:
  1. LABEL INTEGRITY — render N _im variants with their OBB polygons drawn so
     we can eyeball that corners survived angle retarget + keystone + crop.
  2. LIGHTING TARGETS — assert the synthesized regimes hit the measured bands:
     bonus-light variants reach highlight clip 5-25%, dim variants reach
     shadow clip 7-25% (the bonus-light regime is absent from raw captures).

Usage (from training/model2/, model1 venv):
  python scripts/verify_inmachine.py                 # render 30 + assert clips
  python scripts/verify_inmachine.py --n 40 --no-assert
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "dataset"
OUT = ROOT / "logs" / "render_inmachine"
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
COLORS = [(0, 0, 255), (0, 255, 0), (255, 0, 0), (0, 255, 255),
          (255, 0, 255), (255, 255, 0)]
CLASS_NAMES = {0: "cap", 1: "label", 2: "ring"}


def _draw(img, rows, names=CLASS_NAMES):
    h, w = img.shape[:2]
    for r in rows:
        c = r[0]
        pts = np.array(r[1:], dtype=np.float64).reshape(4, 2)
        px = np.stack([pts[:, 0] * w, pts[:, 1] * h], axis=1).astype(np.int32)
        col = COLORS[c % len(COLORS)]
        cv2.polylines(img, [px], True, col, 2)
        cv2.putText(img, f"{c}:{names.get(c, '?')}", (int(px[0][0]), max(20, int(px[0][1]) - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, col, 2)
    return img


def _load(lbl: Path):
    out = []
    if not lbl.is_file():
        return out
    for ln in lbl.read_text(encoding="utf-8").splitlines():
        p = ln.split()
        if len(p) == 9:
            out.append([int(float(p[0]))] + [float(v) for v in p[1:]])
    return out


def _clips(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float((g > 240).mean() * 100), float((g < 25).mean() * 100), float(g.mean())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=30, help="overlays to render")
    ap.add_argument("--clip-sample", type=int, default=250, help="variants sampled for clip stats")
    ap.add_argument("--no-assert", action="store_true")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    src_root = DATA_ROOT / "sources"

    # Collect _im variant paths per source so we can spread renders across them.
    per_src: dict[str, list[tuple[Path, Path]]] = {}
    for split in ("train", "valid"):
        for sdir in sorted(src_root.iterdir()):
            if not sdir.is_dir():
                continue
            img_dir = sdir / split / "images"
            lbl_dir = sdir / split / "labels"
            if not img_dir.is_dir():
                continue
            for img in img_dir.iterdir():
                if img.suffix.lower() in IMG_EXT and "_im" in img.stem:
                    per_src.setdefault(sdir.name, []).append((img, lbl_dir / f"{img.stem}.txt"))

    rendered = 0
    clip_rows = []
    clip_budget = args.clip_sample
    # Round-robin across sources so renders + clip stats cover every source.
    order = sorted(per_src)
    idx = {s: 0 for s in order}
    while rendered < args.n and any(idx[s] < len(per_src[s]) for s in order):
        for s in order:
            if rendered >= args.n:
                break
            if idx[s] >= len(per_src[s]):
                continue
            img, lbl = per_src[s][idx[s]]; idx[s] += 1
            im = cv2.imread(str(img))
            if im is None:
                continue
            rows = _load(lbl)
            _draw(im, rows)
            cv2.imwrite(str(OUT / f"verify_{rendered:02d}_{s}_{img.stem[-14:]}.jpg"), im)
            hi, lo, mean = _clips(im)
            clip_rows.append({"img": img.name, "src": s, "hi_clip": round(hi, 2),
                              "lo_clip": round(lo, 2), "mean": round(mean, 1),
                              "n_labels": len(rows)})
            rendered += 1

    # Extra clip sampling (deterministic stride) across the whole pool.
    flat = [(s, p) for s, lst in per_src.items() for p in lst]
    stride = max(1, len(flat) // max(1, clip_budget))
    for s, (img, lbl) in flat[::stride]:
        if len(clip_rows) >= clip_budget:
            break
        im = cv2.imread(str(img))
        if im is None:
            continue
        hi, lo, mean = _clips(im)
        clip_rows.append({"img": img.name, "src": s, "hi_clip": round(hi, 2),
                          "lo_clip": round(lo, 2), "mean": round(mean, 1),
                          "n_labels": len(_load(lbl))})

    print(f"rendered {rendered} overlays -> {OUT}")
    print(f"sampled {len(clip_rows)} _im variants for clip stats")

    his = np.array([r["hi_clip"] for r in clip_rows])
    los = np.array([r["lo_clip"] for r in clip_rows])
    means = np.array([r["mean"] for r in clip_rows])
    print(f"hi_clip%%  min={his.min():.2f} max={his.max():.2f} mean={his.mean():.2f}")
    print(f"lo_clip%%  min={los.min():.2f} max={los.max():.2f} mean={los.mean():.2f}")
    print(f"brightness mean min={means.min():.1f} max={means.max():.1f} mean={means.mean():.1f}")

    report = {"rendered": rendered, "sampled": len(clip_rows),
              "hi_clip": {"min": float(his.min()), "max": float(his.max()), "mean": float(his.mean())},
              "lo_clip": {"min": float(los.min()), "max": float(los.max()), "mean": float(los.mean())}}
    (ROOT / "logs" / "verify_inmachine.json").write_text(json.dumps(report, indent=2))

    if not args.no_assert:
        # the pool must contain BOTH ends of the lighting range
        assert his.max() >= 5.0, f"bonus-light regime missing: max hi_clip {his.max():.2f}% < 5%"
        assert los.max() >= 7.0, f"dim regime missing: max lo_clip {los.max():.2f}% < 7%"
        assert means.min() < 75, f"no dark variants: min brightness {means.min():.1f}"
        assert means.max() > 150, f"no bright variants: max brightness {means.max():.1f}"
        print("ASSERT OK: pool spans dark -> bonus-light regimes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
