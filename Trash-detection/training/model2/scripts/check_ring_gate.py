r"""Verified-ring gate for the M2 orientation rebuild.

Hard-stops (exit 1) unless true ring labels (class 2) exist in train AND val
AND test, with at least MIN_RING instances in train. Owner-live is the only
allowed ring source (mixed Instant auto-label PET-cap-ring is excluded from
normalization, so any class-2 in the splits is verified owner data).

Usage: python scripts/check_ring_gate.py [--min-train 400]
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPLITS = ROOT.parent / "dataset" / "model2" / "splits"


def count_ring(split: str) -> int:
    n = 0
    lbl = SPLITS / split / "labels"
    if not lbl.is_dir():
        return 0
    for lf in lbl.glob("*.txt"):
        for ln in lf.read_text(encoding="utf-8").splitlines():
            p = ln.split()
            if len(p) == 9 and int(p[0]) == 2:
                n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-train", type=int, default=400)
    args = ap.parse_args()

    counts = {s: count_ring(s) for s in ("train", "val", "test")}
    print("ring (class 2) instances:", counts)
    problems = []
    for s in ("train", "val", "test"):
        if counts[s] == 0:
            problems.append(f"{s}: ring=0")
    if counts["train"] < args.min_train:
        problems.append(f"train: ring={counts['train']} < min {args.min_train}")
    if problems:
        print("RING GATE FAIL: " + "; ".join(problems))
        print("-> add verified true-ring data under dataset/sources/owner-live/ "
              "and re-run normalize/dedupe/split")
        return 1
    print(f"RING GATE PASS (min train {args.min_train})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
