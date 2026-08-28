"""Stage and promote the supplied HBB Model 1 export to both runtimes."""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from package_models import MODEL_SPECS, package_target

ROOT = Path(__file__).resolve().parents[3]
BACKUP_ROOT = ROOT / "training" / "model1" / "logs" / "backups"


def copy_tree_contents(source: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for item in source.iterdir():
        target = destination / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)


def remove_old_classifier(package_dir: Path) -> None:
    for name in (
        "m1_detector_416.onnx",
        "m1_classifier_224.onnx",
        "m1_detector_416.engine",
        "m1_classifier_224.engine",
    ):
        path = package_dir / ("engines" if name.endswith(".engine") else "") / name
        if path.is_file():
            path.unlink()
    for name in ("m1_detector.txt", "m1_classifier.txt"):
        path = package_dir / "labels" / name
        if path.is_file() and name == "m1_classifier.txt":
            path.unlink()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    stage_root = ROOT / "training" / "model1" / "logs" / "promotion_stage" / stamp
    backup_root = BACKUP_ROOT / stamp
    staged = {}
    for target in ("pc", "jetson"):
        code, info = package_target(target, scope="m1", stage_root=stage_root, provenance={"model1_source": "Dump/new-model-1"})
        if code:
            print(json.dumps(info, indent=2))
            return code
        staged[target] = stage_root / target / "models"
        manifest = json.loads((staged[target] / "manifest.json").read_text(encoding="utf-8"))
        model_entries = [entry for entry in manifest.get("models", []) if entry.get("family") == "m1"]
        if len(model_entries) != 1 or model_entries[0].get("task") != "detect":
            raise RuntimeError("staged Model 1 manifest does not contain exactly one detect model")
        remove_old_classifier(staged[target])

    if args.dry_run:
        print(json.dumps({"stage_root": str(stage_root), "targets": list(staged)}, indent=2))
        return 0

    for target, stage_dir in staged.items():
        live_dir = MODEL_SPECS[target]["dir"]
        backup_dir = backup_root / target
        if live_dir.is_dir():
            backup_dir.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(live_dir, backup_dir, dirs_exist_ok=True)
        copy_tree_contents(stage_dir, live_dir)
        remove_old_classifier(live_dir)
        manifest = json.loads((live_dir / "manifest.json").read_text(encoding="utf-8"))
        if any(entry.get("task") == "classify" for entry in manifest.get("models", [])):
            raise RuntimeError("classifier entry remained in promoted manifest")

    print(json.dumps({"promoted": True, "backup_root": str(backup_root), "stage_root": str(stage_root)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
