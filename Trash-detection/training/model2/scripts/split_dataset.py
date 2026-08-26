"""Model 2 — leakage-safe grouped split 70/20/10 + dataset.yaml.

Group key = (source, original-stem-before-".rf."). Roboflow-augmented siblings
of one source photo land in the SAME split. 
Deterministic (seed 42).

If dataset/test_locked_manifest.csv exists, any group containing a locked test image
is permanently locked into the 'test' split to prevent train/val leakage.

Outputs: dataset/splits/{train,val,test}/{images,labels}/, dataset.yaml, logs/split_report.json.

Usage: python scripts/split_dataset.py
"""
from __future__ import annotations

import csv
import json
import random
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "dataset"
NORM = DATA_ROOT / "normalized"
SPLITS = DATA_ROOT / "splits"
DATASET_YAML = DATA_ROOT / "dataset.yaml"
SOURCES_CSV = DATA_ROOT / "sources.csv"
LOCKED_MANIFEST = DATA_ROOT / "test_locked_manifest.csv"
REPORT = ROOT / "logs" / "split_report.json"

RATIOS = {"val": 0.20, "train": 0.80}
NAMES = ["cap", "label", "ring"]


def group_key(image_name: str) -> tuple[str, str]:
    stem = Path(image_name).stem
    parts = stem.split("_", 1)
    source = parts[0] if len(parts) > 1 else "unknown"
    rest = parts[1] if len(parts) > 1 else stem
    original = rest.split(".rf.")[0] if ".rf." in rest else rest
    if original.endswith("_asim"):
        original = original[:-5]
    for tag in ("_rob", "_aug"):     # offline-aug siblings stay with source photo
        if tag in original:
            original = original.rsplit(tag, 1)[0]
    # Video / burst frames: keep an entire shot in one split
    if source in {"PET-cap-ring", "ring-dataset", "owner-live"}:
        original = re.sub(r"_\d+$", "", original)
    return source, original


def count_instances(lbl_file: Path) -> Counter:
    c: Counter = Counter()
    if not lbl_file.is_file():
        return c
    for ln in lbl_file.read_text(encoding="utf-8").splitlines():
        if ln.strip():
            try:
                c[int(ln.split()[0])] += 1
            except ValueError:
                pass
    return c


def main() -> int:
    random.seed(42)

    # 1. Clean previous splits
    for s in ("train", "val", "test"):
        for sub in ("images", "labels"):
            p = SPLITS / s / sub
            if p.exists():
                shutil.rmtree(p)
            p.mkdir(parents=True, exist_ok=True)

    # 2. Gather normalized images
    images = sorted(p.name for p in (NORM / "images").iterdir()
                    if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    groups: dict[tuple[str, str], list[str]] = defaultdict(list)
    for img in images:
        groups[group_key(img)].append(img)

    # 3. Check for locked test images
    locked_images = set()
    if LOCKED_MANIFEST.is_file():
        with LOCKED_MANIFEST.open(encoding="utf-8") as f:
            r = csv.DictReader(f)
            locked_images = {row["image"] for row in r if "image" in row}
        print(f"Found {len(locked_images)} locked test images.")

    label_names = {p.stem: p.name for p in (NORM / "labels").glob("*.txt")}

    def group_classes(g: tuple[str, str]) -> set[int]:
        out: set[int] = set()
        for img in groups[g]:
            lbl = label_names.get(Path(img).stem)
            if lbl:
                out.update(count_instances(NORM / "labels" / lbl).keys())
        return out

    # 4. Partition groups: locked-test groups -> test; ring groups reserved so
    # the scarce class is actually learned (train) and measured (val).
    test_groups: list[tuple[str, str]] = []
    other_groups: list[tuple[str, str]] = []

    for gk, member_images in groups.items():
        if any(img in locked_images for img in member_images):
            test_groups.append(gk)
        else:
            other_groups.append(gk)

    random.shuffle(other_groups)
    ring_groups = [g for g in other_groups if 2 in group_classes(g)]
    ring_groups.sort(key=lambda g: len(groups[g]))
    ring_train = ring_groups[0] if ring_groups else None
    ring_val = ring_groups[1] if len(ring_groups) > 1 else None
    rest = [g for g in other_groups if g not in (ring_train, ring_val)]

    n_rest = len(rest)
    n_val = max(0, int(round(n_rest * RATIOS["val"])) - (1 if ring_val else 0))
    val_groups = ([ring_val] if ring_val else []) + rest[:n_val]
    train_groups = ([ring_train] if ring_train else []) + rest[n_val:]

    assigned: dict[str, str] = {}
    for gk in train_groups:
        for img in groups[gk]:
            assigned[img] = "train"
    for gk in val_groups:
        for img in groups[gk]:
            assigned[img] = "val"
    for gk in test_groups:
        for img in groups[gk]:
            assigned[img] = "test"

    # Also make sure any locked test image directly gets into test
    if (DATA_ROOT / "test_locked").is_dir():
        for test_img in (DATA_ROOT / "test_locked" / "images").iterdir():
            if test_img.name not in assigned:
                assigned[test_img.name] = "test"

    print(f"{len(assigned)} images partitioned into train/val/test.")

    # 5. Copy files to splits
    instances_per_split = {s: Counter() for s in ("train", "val", "test")}
    for img_name, split in assigned.items():
        src_img = NORM / "images" / img_name
        src_lbl = NORM / "labels" / (Path(img_name).stem + ".txt")

        # Fallback to test_locked if not in normalized
        if not src_img.is_file() and split == "test" and (DATA_ROOT / "test_locked" / "images" / img_name).is_file():
            src_img = DATA_ROOT / "test_locked" / "images" / img_name
            src_lbl = DATA_ROOT / "test_locked" / "labels" / (Path(img_name).stem + ".txt")

        if not src_img.is_file():
            continue

        shutil.copy2(src_img, SPLITS / split / "images" / img_name)
        dst_lbl = SPLITS / split / "labels" / (Path(img_name).stem + ".txt")
        if src_lbl.is_file():
            shutil.copy2(src_lbl, dst_lbl)
            c = count_instances(src_lbl)
            for cid, cnt in c.items():
                if 0 <= cid < len(NAMES):
                    instances_per_split[split][NAMES[cid]] += cnt
        else:
            dst_lbl.write_text("", encoding="utf-8")

    # 6. Generate dataset.yaml (relative paths so the tree is portable)
    DATASET_YAML.write_text(
        "# GreenGuard Model 2 — OBB, canonical classes\n"
        "# generated by scripts/split_dataset.py (seed 42, grouped, locked-test aware)\n"
        f"path: {DATA_ROOT.resolve()}\n"
        "train: splits/train/images\n"
        "val: splits/val/images\n"
        "test: splits/test/images\n"
        "names:\n"
        + "".join(f"  {i}: {n}\n" for i, n in enumerate(NAMES)),
        encoding="utf-8",
    )

    # 7. Write split report
    split_counts = {s: len(list((SPLITS / s / "images").glob("*.*"))) for s in ("train", "val", "test")}
    presence = {s: dict(instances_per_split[s]) for s in ("train", "val", "test")}
    report = {
        "images_total": sum(split_counts.values()),
        "images_per_split": split_counts,
        "groups": len(groups),
        "instances_per_split": presence,
        "dataset_yaml": str(DATASET_YAML.resolve()),
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))

    # 8. Integrity + data-gap reporting. Locked-test guarantees no leakage, so
    # a class missing from a split is a data gap (exit 2), not a leak (exit 1).
    present_classes = [n for n in NAMES if any(presence[s].get(n, 0) > 0 for s in presence)]
    missing = [(s, n) for s in presence for n in present_classes if presence[s].get(n, 0) == 0]
    ring_total = sum(presence[s].get("ring", 0) for s in presence)
    if missing:
        print("  class absent in split (data gap, not leakage):", missing)
    if ring_total == 0:
        print("DATA_GAP: ring=0 across all splits — add owner-live true-ring "
              "labels before full train (smoke may still run).")
        return 2
    if missing:
        print("DATA_GAP: some class missing from a split (ring reserved for "
              "train/val). Continue with -AllowNoRing.")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
