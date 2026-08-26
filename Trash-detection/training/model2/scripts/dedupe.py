"""Phase D — perceptual-hash deduplication of normalized images.

- pHash (imagehash, 64-bit) every image in dataset/normalized/images
- duplicates: hamming distance <= THRESHOLD (default 8)
- cluster duplicates (union-find), keep ONE per cluster by source priority:
      owner-live > PET-bottle-with-cap-and-label > bottle-defect-detection
      > bottle-label-inspection > PET-bottle > bottle-label-detection
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
DATA_ROOT = ROOT / "dataset"
IMG_DIR = DATA_ROOT / "normalized" / "images"
LBL_DIR = DATA_ROOT / "normalized" / "labels"
DUP_DIR = DATA_ROOT / "audits" / "duplicates"
SOURCES_CSV = DATA_ROOT / "sources.csv"
REPORT = ROOT / "logs" / "dedupe_report.json"

PRIORITY = [
    "owner-live",
    "PET-bottle-with-cap-and-label",
    "bottle-defect-detection",
    "bottle-label-inspection",
    "PET-bottle",
    "bottle-label-detection",
]


class UnionFind:
    def __init__(self, n: int) -> None:
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x: int) -> int:
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x: int, y: int) -> None:
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return
        if self.rank[rx] < self.rank[ry]:
            self.parent[rx] = ry
        elif self.rank[rx] > self.rank[ry]:
            self.parent[ry] = rx
        else:
            self.parent[ry] = rx
            self.rank[rx] += 1


def source_of(name: str) -> str:
    parts = name.split("_", 1)
    return parts[0] if len(parts) > 1 else ""


def pick_winner(cluster: list[str]) -> str:
    prio_map = {src: i for i, src in enumerate(PRIORITY)}

    def key(name: str) -> tuple[int, int, str]:
        src = source_of(name)
        p = prio_map.get(src, 999)
        # prefer non-empty label files if available
        lbl = LBL_DIR / (Path(name).stem + ".txt")
        sz = lbl.stat().st_size if lbl.is_file() else 0
        return (p, -sz, name)

    return min(cluster, key=key)


def count_instances() -> Counter:
    c: Counter = Counter()
    for p in LBL_DIR.glob("*.txt"):
        for ln in p.read_text(encoding="utf-8").splitlines():
            if ln.strip():
                c[ln.split()[0]] += 1
    return c


def main() -> int:
    threshold = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    DUP_DIR.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)

    images = sorted(p for p in IMG_DIR.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    n = len(images)
    print(f"hashing {n} images ...")

    hashes: list[imagehash.ImageHash | None] = []
    unreadable = []
    for i, p in enumerate(images):
        if (i + 1) % 2000 == 0 or i + 1 == n:
            print(f"  {i+1}/{n}")
        try:
            with Image.open(p) as im:
                hashes.append(imagehash.phash(im))
        except Exception as e:
            print(f"unreadable: {p.name}: {e}")
            hashes.append(None)
            unreadable.append(p.name)

    print("pairwise hamming (blocked) ...")
    valid_idx = [i for i, h in enumerate(hashes) if h is not None]
    raw_bits = np.array([hashes[i].hash.flatten() for i in valid_idx], dtype=np.uint8)

    def base_of(name: str) -> str:
        # offline-augmented siblings "X_augNN" belong to the same photo as "X";
        # they are deterministic + grouped by split_dataset, so pHash must not
        # cull them. Only exact cross-source byte-duplicates are removed.
        stem = Path(name).stem
        return stem.rsplit("_aug", 1)[0] if "_aug" in stem else stem

    uf = UnionFind(n)
    dup_pairs = 0
    m = len(valid_idx)
    step = 500
    for start in range(0, m, step):
        stop = min(start + step, m)
        chunk = raw_bits[start:stop]
        diffs = np.bitwise_xor(chunk[:, None, :], raw_bits[None, :, :]).sum(axis=2)
        rows, cols = np.where((diffs <= threshold) & (diffs >= 0))
        for r_rel, c in zip(rows, cols):
            r = start + r_rel
            if r < c:
                if diffs[r_rel, c] != 0:
                    continue  # keep near-dupes; only exact byte-dupes removed
                if base_of(images[valid_idx[r]].name) == base_of(images[valid_idx[c]].name):
                    continue  # same photo + its augs: never dedupe away
                dup_pairs += 1
                uf.union(valid_idx[r], valid_idx[c])

    clusters: dict[int, list[str]] = {}
    for i in valid_idx:
        root = uf.find(i)
        clusters.setdefault(root, []).append(images[i].name)

    moved = []
    for root, members in clusters.items():
        if len(members) < 2:
            continue
        winner = pick_winner(members)
        for name in members:
            if name == winner:
                continue
            src_img = IMG_DIR / name
            src_lbl = LBL_DIR / (Path(name).stem + ".txt")
            if src_img.is_file():
                shutil.move(src_img, DUP_DIR / name)
            if src_lbl.is_file():
                shutil.move(src_lbl, DUP_DIR / src_lbl.name)
            moved.append(name)

    moved_set = set(moved)
    if SOURCES_CSV.is_file():
        lines = SOURCES_CSV.read_text(encoding="utf-8").splitlines()
        kept_lines = [lines[0]]
        for ln in lines[1:]:
            if ln:
                img_name = ln.split(",")[0]
                if img_name not in moved_set:
                    kept_lines.append(ln)
        SOURCES_CSV.write_text("\n".join(kept_lines) + "\n", encoding="utf-8")

    kept_count = len(list(IMG_DIR.glob("*.*")))
    inst_after = dict(count_instances())
    report = {
        "threshold": threshold,
        "images_before": n,
        "duplicate_pairs": dup_pairs,
        "clusters_ge2": sum(1 for c in clusters.values() if len(c) >= 2),
        "images_moved_to_duplicates": len(moved),
        "images_after": kept_count,
        "unreadable": unreadable,
        "instances_after": inst_after,
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
