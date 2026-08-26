r"""Evaluate Model 2 weights on the LOCKED test set at 640 and 416 resolution.

This ensures a strict, identical benchmark across model versions.

Usage:
  python scripts/eval_locked_test.py [run_name ...]
  (default runs: m2v3_seed42_n640 m2v4_caplabel_seed42_n640)
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import yaml
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "dataset"
TEST_LOCKED = DATA_ROOT / "test_locked"
NAMES = ["cap", "label", "ring"]


def create_temp_test_yaml() -> Path:
    # Create temporary yaml pointing test to test_locked
    test_yaml_path = DATA_ROOT / "test_locked.yaml"
    content = {
        "path": str(DATA_ROOT.resolve()),
        "train": "test_locked/images",
        "val": "test_locked/images",
        "test": "test_locked/images",
        "names": {0: "cap", 1: "label", 2: "ring"},
    }
    test_yaml_path.write_text(yaml.safe_dump(content), encoding="utf-8")
    return test_yaml_path


def eval_run_on_locked(run: str, imgsz: int, test_yaml: Path) -> dict:
    weights = ROOT / "runs" / run / "weights" / "best.pt"
    if not weights.is_file():
        # Check if direct path passed
        if Path(run).is_file():
            weights = Path(run)
        else:
            print(f"[SKIP] weights not found for {run} at {weights}")
            return {}

    model = YOLO(str(weights))
    r = model.val(
        data=str(test_yaml),
        split="test",
        imgsz=imgsz,
        batch=16,
        plots=False,
        verbose=False,
        device="cpu" if imgsz == 416 else None,
    )
    metrics = getattr(r, "box", None) or getattr(r, "obb", None)
    idx = list(metrics.ap_class_index)
    res = {
        "overall_mAP50": float(r.results_dict.get("metrics/mAP50(B)", 0.0)),
        "overall_mAP": float(r.results_dict.get("metrics/mAP50-95(B)", 0.0)),
        "classes": {},
    }
    for i, cls in enumerate(idx):
        cname = NAMES[int(cls)]
        res["classes"][cname] = {
            "mAP50": float(metrics.ap50[i]),
            "mAP50-95": float(metrics.ap[i]),
        }
    return res


def main() -> int:
    runs = sys.argv[1:] or ["m2v3_seed42_n640", "m2v4_caplabel_seed42_n640"]
    if not TEST_LOCKED.is_dir():
        print(f"ERROR: {TEST_LOCKED} not found.")
        return 1

    test_yaml = create_temp_test_yaml()

    for sz in (640, 416):
        print(f"\n{'='*25} LOCKED TEST SET EVAL @ {sz}x{sz} {'='*25}")
        all_results = {}
        for run in runs:
            res = eval_run_on_locked(run, sz, test_yaml)
            if res:
                all_results[run] = res

        if not all_results:
            continue

        # Print comparison table
        print(f"\n{'Run Name':<30} | {'cap mAP50':<11} | {'label mAP50':<11} | {'overall mAP50':<13} | {'overall mAP50-95':<16}")
        print("-" * 95)
        for run, data in all_results.items():
            cap_ap50 = data["classes"].get("cap", {}).get("mAP50", 0.0)
            lbl_ap50 = data["classes"].get("label", {}).get("mAP50", 0.0)
            ov50 = data["overall_mAP50"]
            ov = data["overall_mAP"]
            print(f"{run:<30} | {cap_ap50:<11.4f} | {lbl_ap50:<11.4f} | {ov50:<13.4f} | {ov:<16.4f}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
