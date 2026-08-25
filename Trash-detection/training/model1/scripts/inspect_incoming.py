"""Phase B — inspect incoming datasets (Roboflow YOLOv8-OBB exports).

Walks every dataset under dataset/incoming/, parses label files, and reports:
  - images per split (train/valid/test), images with/without labels
  - instances per source class
  - malformed lines (not 9 fields, coords outside [0,1])
  - empty label files (background images)

Writes logs/inspect_incoming.json (machine) and prints a table (human).
Usage: python scripts/inspect_incoming.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INCOMING = ROOT / "dataset" / "incoming"
OUT_JSON = ROOT / "logs" / "inspect_incoming.json"

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def parse_yaml_names(path: Path) -> dict[int, str]:
    import yaml  # noqa: PLC0415

    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    names = data.get("names", {})
    return {int(k): str(v) for k, v in names.items()}


def inspect_dataset(ds_dir: Path) -> dict:
    names = parse_yaml_names(ds_dir / "data.yaml")
    report: dict = {"yaml_classes": names, "splits": {}}
    for split in ("train", "valid", "test"):
        img_dir = ds_dir / split / "images"
        lbl_dir = ds_dir / split / "labels"
        if not img_dir.is_dir():
            continue
        images = sorted(p for p in img_dir.iterdir() if p.suffix.lower() in IMG_EXT)
        inst = Counter()
        empty = 0
        missing_label = 0
        malformed = []
        for img in images:
            lbl = lbl_dir / (img.stem + ".txt")
            if not lbl.is_file():
                missing_label += 1
                continue
            lines = [ln for ln in lbl.read_text(encoding="utf-8").splitlines() if ln.strip()]
            if not lines:
                empty += 1
                continue
            for ln in lines:
                parts = ln.split()
                if len(parts) != 9:
                    malformed.append(f"{lbl.name}: {len(parts)} fields")
                    continue
                try:
                    cid = int(parts[0])
                    coords = [float(v) for v in parts[1:]]
                except ValueError:
                    malformed.append(f"{lbl.name}: non-numeric")
                    continue
                if cid not in names:
                    malformed.append(f"{lbl.name}: unknown class {cid}")
                    continue
                if any(c < -1e-6 or c > 1 + 1e-6 for c in coords):
                    malformed.append(f"{lbl.name}: coords out of [0,1]")
                    continue
                inst[names[cid]] += 1
        report["splits"][split] = {
            "images": len(images),
            "missing_label": missing_label,
            "empty_label": empty,
            "instances": dict(sorted(inst.items())),
            "malformed": malformed[:20],
            "malformed_count": len(malformed),
        }
    return report


def main() -> int:
    if not INCOMING.is_dir():
        print(f"no incoming dir: {INCOMING}")
        return 1
    all_reports = {}
    for ds_dir in sorted(INCOMING.iterdir()):
        if not (ds_dir / "data.yaml").is_file():
            continue
        all_reports[ds_dir.name] = inspect_dataset(ds_dir)

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(all_reports, indent=2), encoding="utf-8")

    total_inst: Counter = Counter()
    total_img = 0
    for name, rep in all_reports.items():
        print(f"\n=== {name} ===")
        print(f"  yaml classes: {rep['yaml_classes']}")
        for split, s in rep["splits"].items():
            print(
                f"  {split:<6}: images={s['images']:<5} missing_lbl={s['missing_label']:<3} "
                f"empty_lbl={s['empty_label']:<3} malformed={s['malformed_count']}"
            )
            for cls, cnt in s["instances"].items():
                print(f"          {cls:<32} {cnt}")
                total_inst[f"{name}:{cls}"] += cnt
            total_img += s["images"]
        if rep["splits"]:
            ds_inst = Counter()
            for s in rep["splits"].values():
                for cls, cnt in s["instances"].items():
                    ds_inst[cls] += cnt
            print(f"  TOTAL instances: {dict(ds_inst)}")

    print(f"\nTOTAL images across datasets: {total_img}")
    print(f"\nJSON -> {OUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
