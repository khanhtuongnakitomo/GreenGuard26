r"""Orientation audit — derive long-axis angle from each OBB and bucket it.

Buckets: upright (0-30deg from vertical), diagonal (30-60), horizontal (60-90).
Works for M1 (bottle/aluminum) and M2 (cap/label/ring) normalized corpora.

Usage:
  python scripts\orientation_audit.py            # M1 default
  python scripts\orientation_audit.py --model 2  # M2
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parent / "dataset"


def obb_angle(parts: list[str]) -> float:
    """Angle of the LONGER polygon edge vs the vertical axis, degrees 0..90."""
    v = [float(x) for x in parts[1:9]]
    pts = [(v[i], v[i + 1]) for i in range(0, 8, 2)]
    edges = []
    for i in range(4):
        a, b = pts[i], pts[(i + 1) % 4]
        dx, dy = b[0] - a[0], b[1] - a[1]
        edges.append((math.hypot(dx, dy), math.atan2(dx, dy)))  # atan2(dx,dy): 0 = vertical
    length, ang = max(edges, key=lambda e: e[0])
    deg = abs(math.degrees(ang)) % 180.0
    return min(deg, 180.0 - deg)


def bucket(deg: float) -> str:
    if deg < 30:
        return "upright"
    if deg < 60:
        return "diagonal"
    return "horizontal"


def audit(lbl_dir: Path, names: dict[int, str], source_csv: Path | None) -> dict:
    per_class = {n: Counter() for n in names.values()}
    per_source: dict[str, Counter] = defaultdict(Counter)
    src_of = {}
    if source_csv and source_csv.is_file():
        import csv
        for row in csv.DictReader(source_csv.open(encoding="utf-8")):
            src_of[row["image"]] = row["source"]
    n_imgs = 0
    for lf in sorted(lbl_dir.glob("*.txt")):
        img = None
        for ext in (".jpg", ".jpeg", ".png", ".webp"):
            c = lbl_dir.parent / "images" / (lf.stem + ext)
            if c.is_file():
                img = c.name
                break
        src = src_of.get(img, lf.stem.split("_", 1)[0])
        n_imgs += 1
        for ln in lf.read_text(encoding="utf-8").splitlines():
            p = ln.split()
            if len(p) != 9:
                continue
            b = bucket(obb_angle(p))
            cls = names.get(int(p[0]), str(p[0]))
            per_class[cls][b] += 1
            per_source[src][b] += 1
    return {"images": n_imgs, "per_class": {k: dict(v) for k, v in per_class.items()},
            "per_source": dict(per_source)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", type=int, default=1, choices=[1, 2])
    args = ap.parse_args()
    if args.model == 1:
        lbl_dir = DATA_ROOT / "model1" / "normalized" / "labels"
        names = {0: "bottle", 1: "aluminum"}
        src_csv = DATA_ROOT / "model1" / "sources.csv"
    else:
        lbl_dir = DATA_ROOT / "model2" / "normalized" / "labels"
        names = {0: "cap", 1: "label", 2: "ring"}
        src_csv = DATA_ROOT / "model2" / "sources.csv"
    rep = audit(lbl_dir, names, src_csv)
    out = ROOT / "logs" / f"orientation_audit_m{args.model}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(rep, indent=2), encoding="utf-8")
    print(f"images: {rep['images']}")
    for cls, b in rep["per_class"].items():
        tot = sum(b.values()) or 1
        print(f"{cls:10s} " + "  ".join(f"{k}: {b.get(k, 0):5d} ({100*b.get(k, 0)/tot:4.1f}%)"
                                        for k in ("upright", "diagonal", "horizontal")))
    print("per-source breakdown ->", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
