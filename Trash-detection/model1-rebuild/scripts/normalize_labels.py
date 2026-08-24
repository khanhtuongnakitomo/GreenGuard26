"""Phase C — normalize incoming datasets to canonical OBB classes.

Canonical (fixed by owner 2026-08-22, refactor v2):
    0=bottle  1=aluminum          (cap / wrapper classes REMOVED)
Format: YOLOv8 OBB — `class x1 y1 x2 y2 x3 y3 x4 y4`, coords normalized [0,1].

Per-source class maps:
  dataset-1 (workspace101 aluminum-cans; numeric class names verified = cans):
      0 '0', 1 '1', 2 '2', 3 can, 4 cans  -> 1 aluminum
  dataset-3 (patriks plastic-bottle-detection v5):
      0 bottle -> 0 bottle
      1 cap, 2 label, 3 liquid            -> DROP (classes removed / out of scope)
  dataset-4 (roboflow plastic-bottle-and-can v3, Public Domain):
      0 bottle -> 0 bottle, 1 can -> 1 aluminum
  dataset-5 (water-bottle-pyqmv, whole-bottle state boxes):
      0..4 bottle-* states                -> 0 bottle
      5 bottlecap, 6 bottlewrapper        -> DROP (classes removed)

  dataset-2 is EXCLUDED ENTIRELY: it annotates only cap/label and has NO bottle
  boxes on 1.5k bottle photos — keeping it would teach the model "bottle =
  background" (the partial-annotation failure mode that hurt the v1 model).

Rules applied:
  - drop annotation rows not in scope (liquid)
  - drop images whose labels become empty (counted)
  - skip label files whose image file is missing (dataset1 train/test lost images)
  - clamp coords into [0,1], counting clamped lines (rotation-augmentation drift)
  - output: dataset/normalized/images + labels, flat with <src>_ prefix
  - dataset/sources.csv: image -> source (group key for leakage-safe split)

Usage: python scripts/normalize_labels.py
"""
from __future__ import annotations

import csv
import json
import shutil
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INCOMING = ROOT / "dataset" / "incoming"
NORM = ROOT / "dataset" / "normalized"
IMG_OUT = NORM / "images"
LBL_OUT = NORM / "labels"
SOURCES_CSV = ROOT / "dataset" / "sources.csv"
REPORT_JSON = ROOT / "logs" / "normalize_report.json"

CANONICAL = {0: "bottle", 1: "aluminum"}

# dataset-2 deliberately absent — see module docstring.
CLASS_MAPS: dict[str, dict[int, int | None]] = {
    "dataset-1": {0: 1, 1: 1, 2: 1, 3: 1, 4: 1},
    "dataset-3": {0: 0, 1: None, 2: None, 3: None},  # None = drop row
    "dataset-4": {0: 0, 1: 1},
    "dataset-5": {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: None, 6: None},
}

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
CLAMP_LIMIT = 0.30  # lines exceeding frame by more than this are quarantined


def clamp_line(parts: list[str]) -> tuple[list[float], bool]:
    vals = [float(v) for v in parts[1:]]
    clamped = any(v < 0.0 or v > 1.0 for v in vals)
    vals = [min(1.0, max(0.0, v)) for v in vals]
    return vals, clamped


def main() -> int:
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    LBL_OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    rows_csv = []

    for src, cmap in CLASS_MAPS.items():
        rep = {
            "images_kept": 0, "images_dropped_empty": 0,
            "images_skipped_missing": 0, "lines_dropped": 0,
            "lines_clamped": 0, "lines_quarantined": 0,
            "instances": Counter(), "kept_per_origin_split": Counter(),
        }
        src_dir = INCOMING / src
        for split in ("train", "valid", "test"):
            img_dir = src_dir / split / "images"
            lbl_dir = src_dir / split / "labels"
            if not img_dir.is_dir():
                continue
            for img in sorted(img_dir.iterdir()):
                if img.suffix.lower() not in IMG_EXT:
                    continue
                lbl = lbl_dir / (img.stem + ".txt")
                if not lbl.is_file():
                    rep["images_skipped_missing"] += 1
                    continue
                out_lines = []
                for ln in lbl.read_text(encoding="utf-8").splitlines():
                    parts = ln.split()
                    if len(parts) != 9:
                        rep["lines_quarantined"] += 1
                        continue
                    cid = int(parts[0])
                    mapped = cmap.get(cid, "UNMAPPED")
                    if mapped is None or mapped == "UNMAPPED":
                        rep["lines_dropped"] += 1
                        continue
                    vals, clamped = clamp_line(parts)
                    if any(v < -CLAMP_LIMIT or v > 1 + CLAMP_LIMIT for v in
                           [float(x) for x in parts[1:]]):
                        rep["lines_quarantined"] += 1
                        continue
                    if clamped:
                        rep["lines_clamped"] += 1
                    rep["instances"][CANONICAL[mapped]] += 1
                    coords = " ".join(f"{v:.6f}" for v in vals)
                    out_lines.append(f"{mapped} {coords}")
                if not out_lines:
                    rep["images_dropped_empty"] += 1
                    continue
                stem = f"{src}_{img.stem}"
                shutil.copy2(img, IMG_OUT / f"{stem}{img.suffix.lower()}")
                (LBL_OUT / f"{stem}.txt").write_text(
                    "\n".join(out_lines) + "\n", encoding="utf-8"
                )
                rows_csv.append({"image": f"{stem}{img.suffix.lower()}", "source": src,
                                 "origin_split": split})
                rep["images_kept"] += 1
                rep["kept_per_origin_split"][split] += 1
        rep["instances"] = dict(rep["instances"])
        rep["kept_per_origin_split"] = dict(rep["kept_per_origin_split"])
        report[src] = rep

    with SOURCES_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["image", "source", "origin_split"])
        w.writeheader()
        w.writerows(rows_csv)

    REPORT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")

    tot = Counter()
    for rep in report.values():
        for k, v in rep["instances"].items():
            tot[k] += v
    print(json.dumps(report, indent=2))
    print("TOTAL instances:", dict(tot))
    print("TOTAL images kept:", sum(r["images_kept"] for r in report.values()))
    print(f"sources.csv -> {SOURCES_CSV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
