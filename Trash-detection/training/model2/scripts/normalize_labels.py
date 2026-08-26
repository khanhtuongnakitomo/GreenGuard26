r"""Model 2 — normalize incoming datasets to canonical OBB classes.

Canonical (Model 2 v3, 2026-08-23):
    0=cap  1=label  2=ring
Format: YOLOv8 OBB — `class x1 y1 x2 y2 x3 y3 x4 y4`, normalized [0,1].

Sources under ../dataset/sources/ (shared with Model 1):
  PET-bottle-with-cap-and-label  — 0 cap -> 0, 1 label -> 1
  PET-bottle                     — 1 cap -> 0, 2 label -> 1 (drop bottle/liquid)
  owner-live                     — identity 0/1/2 when present (owner webcam /
                                   true-ring OBB; required before full train)
  PET-cap-ring                   — SKIPPED (Roboflow Instant mixed cap-or-ring)
  water-bottle-with-cap-and-wrapper — SKIPPED (audit: bottlecap n=2, wrapper
                                   mostly whole-body boxes)

Rules: wipe previous normalized output; drop out-of-scope rows; drop empty
images; clamp coords into [0,1]; prefix stems with <src>_; write sources.csv.

Usage: python scripts/normalize_labels.py   (via model1-rebuild venv)
"""
from __future__ import annotations

import csv
import json
import shutil
from collections import Counter
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "dataset"
INCOMING = DATA_ROOT / "sources"
NORM_ROOT = DATA_ROOT / "normalized"
IMG_OUT = NORM_ROOT / "images"
LBL_OUT = NORM_ROOT / "labels"
SOURCES_CSV = DATA_ROOT / "sources.csv"
REPORT_JSON = ROOT / "logs" / "normalize_report.json"

CANONICAL = {0: "cap", 1: "label", 2: "ring"}

CLASS_MAPS: dict[str, dict[int, int | None]] = {
    "PET-bottle-with-cap-and-label": {0: 0, 1: 1},
    "PET-bottle": {0: None, 1: 0, 2: 1, 3: None},  # drop bottle + liquid
    # Bottle-label: label_standard->1=label; label_defect + liquid dropped
    # (owner instruction 2026-08-23: extra classes like liquid are dropped)
    "Bottle-label": {0: None, 1: 1, 2: None},
    # Bottle-lying: lid->0=cap (horizontal bottles); bottle body dropped
    "Bottle-lying": {0: None, 1: 0},
    # owner-live-old: legacy booth captures (pre-2026-08-25), cap/label only
    "owner-live-old": {0: 0, 1: 1},
}

# Optional owner drop — only if folder + data.yaml exist
OWNER_LIVE = "owner-live"

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
CLAMP_LIMIT = 0.30
SPLITS = ("train", "valid", "test", "val")  # accept val alias


def clear_normalized() -> None:
    if IMG_OUT.exists():
        shutil.rmtree(IMG_OUT)
    if LBL_OUT.exists():
        shutil.rmtree(LBL_OUT)
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    LBL_OUT.mkdir(parents=True, exist_ok=True)


def owner_live_map(src_dir: Path) -> dict[int, int | None] | None:
    data = src_dir / "data.yaml"
    if not data.is_file():
        return None
    names = yaml.safe_load(data.read_text(encoding="utf-8")).get("names", {})
    if isinstance(names, list):
        names = {i: n for i, n in enumerate(names)}
    names = {int(k): str(v).lower() for k, v in names.items()}
    print(f"[owner-live] classes found: {names}")
    # Prefer identity when already canonical; else map by name
    by_name = {"cap": 0, "label": 1, "ring": 2, "sealant-ring": 2, "sealant_ring": 2}
    out: dict[int, int | None] = {}
    for cid, name in names.items():
        if name in by_name:
            out[cid] = by_name[name]
        elif cid in (0, 1, 2) and name in CANONICAL.values():
            out[cid] = cid
        else:
            out[cid] = None
            print(f"[owner-live] drop unmapped class {cid}:{name}")
    return out


def process_source(src: str, cmap: dict[int, int | None]) -> tuple[dict, list[dict]]:
    rep = {
        "images_kept": 0,
        "images_dropped_empty": 0,
        "lines_dropped": 0,
        "lines_clamped": 0,
        "lines_quarantined": 0,
        "instances": Counter(),
        "kept_per_origin_split": Counter(),
    }
    rows_csv: list[dict] = []
    src_dir = INCOMING / src
    if not src_dir.is_dir():
        print(f"[WARN] missing source dir: {src_dir}")
        return rep, rows_csv

    for split in SPLITS:
        img_dir = src_dir / split / "images"
        lbl_dir = src_dir / split / "labels"
        if not img_dir.is_dir():
            continue
        origin = "val" if split == "valid" else split
        for img in sorted(img_dir.iterdir()):
            if img.suffix.lower() not in IMG_EXT:
                continue
            lbl = lbl_dir / (img.stem + ".txt")
            if not lbl.is_file():
                # bare-bottle negatives: keep empty label if owner-live
                if src == OWNER_LIVE:
                    out_lines: list[str] = []
                else:
                    continue
            else:
                out_lines = []
                for ln in lbl.read_text(encoding="utf-8").splitlines():
                    parts = ln.split()
                    if len(parts) != 9:
                        rep["lines_quarantined"] += 1
                        continue
                    cid = int(parts[0])
                    if cid not in cmap or cmap[cid] is None:
                        rep["lines_dropped"] += 1
                        continue
                    mapped = int(cmap[cid])  # type: ignore[arg-type]
                    vals = [float(v) for v in parts[1:]]
                    if any(v < -CLAMP_LIMIT or v > 1 + CLAMP_LIMIT for v in vals):
                        rep["lines_quarantined"] += 1
                        continue
                    if any(v < 0 or v > 1 for v in vals):
                        rep["lines_clamped"] += 1
                    vals = [min(1.0, max(0.0, v)) for v in vals]
                    rep["instances"][CANONICAL[mapped]] += 1
                    out_lines.append(f"{mapped} " + " ".join(f"{v:.6f}" for v in vals))

            if not out_lines and src != OWNER_LIVE:
                rep["images_dropped_empty"] += 1
                continue
            # owner-live empty labels = negatives (bare bottle / empty frame)
            stem = f"{src}_{img.stem}"
            shutil.copy2(img, IMG_OUT / f"{stem}{img.suffix.lower()}")
            (LBL_OUT / f"{stem}.txt").write_text(
                ("\n".join(out_lines) + "\n") if out_lines else "",
                encoding="utf-8",
            )
            rows_csv.append({
                "image": f"{stem}{img.suffix.lower()}",
                "source": src,
                "origin_split": origin,
            })
            rep["images_kept"] += 1
            rep["kept_per_origin_split"][origin] += 1

    rep["instances"] = dict(rep["instances"])
    rep["kept_per_origin_split"] = dict(rep["kept_per_origin_split"])
    return rep, rows_csv


def main() -> int:
    clear_normalized()
    maps = dict(CLASS_MAPS)

    skipped = []
    if (INCOMING / "PET-cap-ring" / "data.yaml").is_file():
        skipped.append("PET-cap-ring (mixed Instant auto-label — not true ring)")
    if (INCOMING / "water-bottle-with-cap-and-wrapper" / "data.yaml").is_file():
        skipped.append("water-bottle-with-cap-and-wrapper (audit: n≈0 usable part boxes)")

    owner_dir = INCOMING / OWNER_LIVE
    ol_map = owner_live_map(owner_dir) if owner_dir.is_dir() else None
    if ol_map is not None:
        maps[OWNER_LIVE] = ol_map
    else:
        print("[WARN] no owner-live/ yet — ring class will be empty until you add it")

    report: dict = {"skipped_sources": skipped}
    rows_csv: list[dict] = []
    for src, cmap in maps.items():
        rep, rows = process_source(src, cmap)
        report[src] = rep
        rows_csv.extend(rows)

    SOURCES_CSV.parent.mkdir(parents=True, exist_ok=True)
    with SOURCES_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["image", "source", "origin_split"])
        w.writeheader()
        w.writerows(rows_csv)
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")

    tot: Counter = Counter()
    for key, rep in report.items():
        if key == "skipped_sources" or not isinstance(rep, dict):
            continue
        for k, v in rep.get("instances", {}).items():
            tot[k] += v
    print(json.dumps(report, indent=2))
    print("TOTAL instances:", dict(tot))
    print("TOTAL images kept:", sum(
        r["images_kept"] for k, r in report.items()
        if k != "skipped_sources" and isinstance(r, dict)
    ))
    if tot.get("ring", 0) == 0:
        print("DATA_GAP: ring instances = 0 — add dataset/sources/owner-live/ "
              "(true ring OBB + live camera photos) before full 4h train.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
