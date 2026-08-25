"""Phase D — perceptual-hash deduplication of normalized images.

- pHash (imagehash, 64-bit) every image in dataset/normalized/images
- duplicates: hamming distance <= THRESHOLD (default 8, kit spec)
- cluster duplicates (union-find), keep ONE per cluster by source priority:
      dataset-3 > dataset-2 > dataset-5 > dataset-4 > dataset-1
  (most-curated part-level sources first; documented in stats.md)
- losers are MOVED to dataset/audits/duplicates/ (nothing deleted) and dropped
  from dataset/sources.csv
- reports pairs/clusters to logs/dedupe_report.json + prints summary

Usage: python scripts/dedupe.py [threshold]
"""
from __future__ import annotations

import json
import shutil
import sys
from collections import Counter
from pathlib import Path

import imagehash
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "dataset" / "normalized" / "images"
LBL_DIR = ROOT / "dataset" / "normalized" / "labels"
DUP_DIR = ROOT / "dataset" / "audits" / "duplicates"
SOURCES_CSV = ROOT / "dataset" / "sources.csv"
REPORT = ROOT / "logs" / "dedupe_report.json"

PRIORITY = ["dataset-3", "dataset-2", "dataset-5", "dataset-4", "dataset-1"]


def source_of(stem: str) -> str:
    # stems look like 'dataset-3_8F769742-....rf.0d0f41a7...' -> 'dataset-3'
    return stem.split("_", 1)[0]


class UF:
    def __init__(self, n: int) -> None:
        self.p = list(range(n))

    def find(self, x: int) -> int:
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[rb] = ra


def main() -> int:
    threshold = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    images = sorted(p for p in IMG_DIR.iterdir() if p.suffix.lower() in
                    {".jpg", ".jpeg", ".png", ".webp", ".bmp"})
    n = len(images)
    print(f"hashing {n} images ...")
    hashes = np.zeros(n, dtype=np.uint64)
    unreadable: list[str] = []
    for i, p in enumerate(images):
        try:
            hashes[i] = int(str(imagehash.phash(Image.open(p), hash_size=8)), 16)
        except Exception as exc:  # noqa: BLE001
            print(f"  WARN unreadable {p.name}: {type(exc).__name__}: {exc}")
            unreadable.append(p.name)
            hashes[i] = 0xFFFFFFFFFFFFFFFF
        if (i + 1) % 2000 == 0:
            print(f"  {i+1}/{n}")
    if len(unreadable) > n * 0.05:
        raise SystemExit(f"ABORT: {len(unreadable)}/{n} images unreadable (>5%) — fix before dedupe")

    print("pairwise hamming (blocked) ...")
    uf = UF(n)
    n_pairs = 0
    pair_samples: list[tuple[str, str, int]] = []
    B = 512
    for start in range(0, n, B):
        end = min(start + B, n)
        block = hashes[start:end, None] ^ hashes[None, :]
        # popcount of uint64 via two uint32 halves (np.bitwise_count: numpy>=2.0)
        dist = (np.bitwise_count((block >> np.uint64(32)).astype(np.uint32)).astype(np.int16)
                + np.bitwise_count((block & np.uint64(0xFFFFFFFF)).astype(np.uint32)).astype(np.int16))
        rows, cols = np.nonzero((dist <= threshold) & (np.arange(start, end)[:, None] < np.arange(n)[None, :]))
        for r, c in zip(rows.tolist(), cols.tolist()):
            uf.union(start + r, c)
            n_pairs += 1
            if len(pair_samples) < 200:
                pair_samples.append((images[start + r].name, images[c].name, int(dist[r, c])))

    clusters: dict[int, list[int]] = {}
    for i in range(n):
        clusters.setdefault(uf.find(i), []).append(i)

    prio = {s: k for k, s in enumerate(PRIORITY)}
    moved = []
    for members in clusters.values():
        if len(members) == 1:
            continue
        members_sorted = sorted(
            members,
            key=lambda i: (prio.get(source_of(images[i].stem), 99), images[i].name),
        )
        for loser in members_sorted[1:]:
            p = images[loser]
            (DUP_DIR / p.name).parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(p), str(DUP_DIR / p.name))
            lbl = LBL_DIR / (p.stem + ".txt")
            if lbl.is_file():
                shutil.move(str(lbl), str(DUP_DIR / lbl.name))
            moved.append(p.name)

    # rewrite sources.csv without moved images
    import csv  # noqa: PLC0415

    rows = list(csv.DictReader(SOURCES_CSV.open(encoding="utf-8")))
    moved_set = set(moved)
    kept_rows = [r for r in rows if r["image"] not in moved_set]
    with SOURCES_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["image", "source", "origin_split"])
        w.writeheader()
        w.writerows(kept_rows)

    # count instances of kept labels per class
    inst: Counter = Counter()
    for lbl in LBL_DIR.glob("*.txt"):
        for ln in lbl.read_text(encoding="utf-8").splitlines():
            if ln.strip():
                inst[int(ln.split()[0])] += 1

    rep = {
        "threshold": threshold,
        "images_before": n,
        "duplicate_pairs": n_pairs,
        "clusters_ge2": sum(1 for m in clusters.values() if len(m) > 1),
        "images_moved_to_duplicates": len(moved),
        "images_after": n - len(moved),
        "unreadable": unreadable,
        "pair_samples": pair_samples,
        "instances_after": {k: inst[k] for k in sorted(inst)},
    }
    REPORT.write_text(json.dumps(rep, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in rep.items() if k != "pair_samples"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
