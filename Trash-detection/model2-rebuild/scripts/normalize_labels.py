r"""Model 2 — normalize incoming datasets to canonical OBB classes.

Canonical (Model 2, 2026-08-23):
    0=cap  1=label  2=ring
Format: YOLOv8 OBB — `class x1 y1 x2 y2 x3 y3 x4 y4`, normalized [0,1].

Sources (under dataset/incoming/):
  cap-label/dataset-2  (mohammed-essam bottle-cap-label-detection v3, OBB):
      0 cap -> 0 cap, 1 label -> 1 label
  ring-dataset/        (kittyunees PET-Cap-Ring-Detection v3, Roboflow Instant
                       auto-label, single generic class 'Object-Detection'):
      VERIFIED 2026-08-23 by renders + geometry (aspect median 2.81, area ~0.3%):
      boxes sit on the CAP of capped bottles AND on the RING of uncapped
      bottles — one merged class, inseparable from the labels. Mapped to
      2=ring, read as "cap-or-ring neck obstruction". For the ACCEPT/REJECT
      gate this is functionally equivalent (both trigger REJECT).

Rules: drop out-of-scope rows; drop images that become empty; clamp coords
into [0,1]; output flat normalized/images+labels with <src>_ prefix;
dataset/sources.csv for grouped splitting.

Usage: python scripts/normalize_labels.py   (run via model1-rebuild venv)
"""
from __future__ import annotations

import csv
import json
import shutil
from collections import Counter
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
INCOMING = ROOT / "dataset" / "incoming"
IMG_OUT = ROOT / "dataset" / "normalized" / "images"
LBL_OUT = ROOT / "dataset" / "normalized" / "labels"
SOURCES_CSV = ROOT / "dataset" / "sources.csv"
REPORT_JSON = ROOT / "logs" / "normalize_report.json"

CANONICAL = {0: "cap", 1: "label", 2: "ring"}

# fixed maps for known datasets; ring-dataset is auto-mapped (see docstring)
CLASS_MAPS: dict[str, dict[int, int | None]] = {
    "dataset-2": {0: 0, 1: 1},
}
# source id -> directory under dataset/incoming/
SRC_DIRS: dict[str, str] = {
    "dataset-2": "cap-label/dataset-2",
    "ring-dataset": "ring-dataset",
}

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
CLAMP_LIMIT = 0.30


def ring_map(ring_dir: Path) -> dict[int, int | None]:
    names = yaml.safe_load((ring_dir / "data.yaml").read_text(encoding="utf-8"))["names"]
    names = {int(k): str(v) for k, v in names.items()}
    print(f"[ring-dataset] classes found: {names} -> ALL map to 2=ring")
    if len(set(names.values())) > 1:
        print("[ring-dataset] WARNING: multiple distinct classes — verify before trusting")
    return {cid: 2 for cid in names}


def main() -> int:
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    LBL_OUT.mkdir(parents=True, exist_ok=True)
    maps = dict(CLASS_MAPS)
    ring_dir = INCOMING / "ring-dataset"
    if (ring_dir / "data.yaml").is_file():
        maps["ring-dataset"] = ring_map(ring_dir)
    else:
        print("[WARN] no ring-dataset yet — normalizing cap/label only")

    report, rows_csv = {}, []
    for src, cmap in maps.items():
        rep = {"images_kept": 0, "images_dropped_empty": 0, "lines_dropped": 0,
               "lines_clamped": 0, "lines_quarantined": 0,
               "instances": Counter(), "kept_per_origin_split": Counter()}
        src_dir = INCOMING / SRC_DIRS.get(src, src)
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
                    continue
                out_lines = []
                for ln in lbl.read_text(encoding="utf-8").splitlines():
                    parts = ln.split()
                    if len(parts) != 9:
                        rep["lines_quarantined"] += 1
                        continue
                    cid = int(parts[0])
                    mapped = cmap.get(cid)
                    if mapped is None or cid not in cmap:
                        rep["lines_dropped"] += 1
                        continue
                    vals = [float(v) for v in parts[1:]]
                    if any(v < -CLAMP_LIMIT or v > 1 + CLAMP_LIMIT for v in vals):
                        rep["lines_quarantined"] += 1
                        continue
                    if any(v < 0 or v > 1 for v in vals):
                        rep["lines_clamped"] += 1
                    vals = [min(1.0, max(0.0, v)) for v in vals]
                    rep["instances"][CANONICAL[mapped]] += 1
                    out_lines.append(f"{mapped} " + " ".join(f"{v:.6f}" for v in vals))
                if not out_lines:
                    rep["images_dropped_empty"] += 1
                    continue
                stem = f"{src}_{img.stem}"
                shutil.copy2(img, IMG_OUT / f"{stem}{img.suffix.lower()}")
                (LBL_OUT / f"{stem}.txt").write_text("\n".join(out_lines) + "\n", encoding="utf-8")
                rows_csv.append({"image": f"{stem}{img.suffix.lower()}",
                                 "source": src, "origin_split": split})
                rep["images_kept"] += 1
                rep["kept_per_origin_split"][split] += 1
        rep["instances"] = dict(rep["instances"])
        rep["kept_per_origin_split"] = dict(rep["kept_per_origin_split"])
        report[src] = rep

    with SOURCES_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["image", "source", "origin_split"])
        w.writeheader()
        w.writerows(rows_csv)
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")
    tot = Counter()
    for rep in report.values():
        for k, v in rep["instances"].items():
            tot[k] += v
    print(json.dumps(report, indent=2))
    print("TOTAL instances:", dict(tot))
    print("TOTAL images kept:", sum(r["images_kept"] for r in report.values()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
