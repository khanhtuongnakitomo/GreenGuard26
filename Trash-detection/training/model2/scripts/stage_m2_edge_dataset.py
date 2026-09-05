from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import cv2
import yaml

from live_finetune_common import (
    IMG_EXTS,
    load_config,
    parse_label_line,
    sha256_file,
    validate_points,
    workflow_paths,
    write_json,
)


def source_root(model2_root: Path, value: str) -> Path:
    return (model2_root / value).resolve()


def source_names(path: Path) -> dict[int, str]:
    payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    raw = payload.get("names", {})
    if isinstance(raw, list):
        return {index: str(name) for index, name in enumerate(raw)}
    return {int(index): str(name) for index, name in raw.items()}


def write_canonical_label(path: Path, rows: list[tuple[int, list[float]]]) -> None:
    path.write_text(
        "".join(f"{class_id} " + " ".join(f"{value:.6f}" for value in points) + "\n" for class_id, points in rows),
        encoding="utf-8",
    )


def clean_stage_root(stage_root: Path) -> None:
    intended_parent = stage_root.parent.resolve()
    if intended_parent.name != "staging":
        raise RuntimeError(f"refusing to reset unexpected staging path: {stage_root}")
    if stage_root.exists():
        shutil.rmtree(stage_root)
    (stage_root / "live" / "image").mkdir(parents=True, exist_ok=True)
    (stage_root / "live" / "labels").mkdir(parents=True, exist_ok=True)
    (stage_root / "live" / "review" / "authoritative_annotations").mkdir(parents=True, exist_ok=True)
    (stage_root / "quarantine").mkdir(parents=True, exist_ok=True)


def stage_source(cfg: dict[str, Any], source: dict[str, Any], stage_root: Path) -> dict[str, Any]:
    model2_root = cfg["_resolved"]["model2_root"]
    root = source_root(model2_root, str(source["root"]))
    image_dir = root / str(source["image_dir"])
    label_dir = root / str(source["label_dir"])
    yaml_path = root / str(source["data_yaml"])
    if not image_dir.is_dir() or not label_dir.is_dir() or not yaml_path.is_file():
        raise RuntimeError(f"edge source is incomplete: {root}")

    declared = source_names(yaml_path)
    mapping = {int(key): int(value) for key, value in source["raw_class_to_canonical"].items()}
    images = sorted(item for item in image_dir.iterdir() if item.is_file() and item.suffix.lower() in IMG_EXTS)
    labels = sorted(label_dir.glob("*.txt"))
    image_by_stem = {item.stem: item for item in images}
    source_report: dict[str, Any] = {
        "name": source["name"],
        "root": str(root),
        "data_yaml_sha256": sha256_file(yaml_path, upper=True),
        "declared_names": declared,
        "configured_mapping": mapping,
        "image_count": len(images),
        "label_count": len(labels),
        "kept_images": 0,
        "kept_annotations": 0,
        "class_counts": Counter(),
        "quarantine": [],
    }
    stage_image_dir = stage_root / "live" / "image"
    stage_label_dir = stage_root / "live" / "labels"

    def quarantine(reason: str, detail: str, *, image: Path | None = None, label: Path | None = None) -> None:
        entry = {"source": source["name"], "reason": reason, "detail": detail}
        if image:
            entry["image"] = str(image)
        if label:
            entry["label"] = str(label)
        source_report["quarantine"].append(entry)
        qdir = stage_root / "quarantine" / str(source["name"])
        qdir.mkdir(parents=True, exist_ok=True)
        if image and image.is_file():
            shutil.copy2(image, qdir / image.name)
        if label and label.is_file():
            shutil.copy2(label, qdir / label.name)

    # Process every image and every label, including orphaned labels. This makes
    # undeclared classes auditable even when their corresponding frame is absent.
    seen_stems: set[str] = set()
    for image in images:
        seen_stems.add(image.stem)
        label = label_dir / f"{image.stem}.txt"
        if not label.is_file():
            quarantine("missing_label", "image has no paired label", image=image)
            continue
        decoded = cv2.imread(str(image))
        if decoded is None:
            quarantine("image_read_failed", "OpenCV could not decode the image", image=image, label=label)
            continue
        height, width = decoded.shape[:2]
        rows: list[tuple[int, list[float]]] = []
        invalid = None
        for line_no, line in enumerate(label.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip():
                continue
            try:
                raw_class, points = parse_label_line(line)
            except Exception as exc:
                invalid = ("invalid_label_format", f"line {line_no}: {exc}")
                break
            if raw_class not in declared or raw_class not in mapping:
                invalid = ("undeclared_or_unmapped_class", f"line {line_no}: raw class {raw_class}")
                break
            ok, error = validate_points(
                points,
                width=width,
                height=height,
                min_polygon_area_fraction=float(cfg["dataset"]["min_polygon_area_fraction"]),
                min_side_pixels=float(cfg["dataset"]["min_side_pixels"]),
            )
            if not ok:
                invalid = (error or "invalid_polygon", f"line {line_no}: validation failed")
                break
            canonical_id = mapping[raw_class]
            if canonical_id < 0 or canonical_id >= len(cfg["canonical_names"]):
                invalid = ("canonical_class_out_of_range", f"line {line_no}: canonical class {canonical_id}")
                break
            flat = [float(value) for value in points.reshape(-1)]
            rows.append((canonical_id, flat))
        if invalid:
            quarantine(invalid[0], invalid[1], image=image, label=label)
            continue
        prefix = str(source["name"]).lower()
        target_stem = f"{prefix}_{image.stem}"
        target_image = stage_image_dir / f"{target_stem}{image.suffix.lower()}"
        target_label = stage_label_dir / f"{target_stem}.txt"
        shutil.copy2(image, target_image)
        write_canonical_label(target_label, rows)
        source_report["kept_images"] += 1
        source_report["kept_annotations"] += len(rows)
        for canonical_id, _ in rows:
            source_report["class_counts"][cfg["canonical_names"][canonical_id]] += 1

    for label in labels:
        if label.stem not in seen_stems:
            quarantine("orphan_label", "label has no paired image; retained only for audit", label=label)

    source_report["class_counts"] = dict(source_report["class_counts"])
    return source_report


def write_staged_surfaces(cfg: dict[str, Any], stage_root: Path) -> None:
    live_root = stage_root / "live"
    (live_root / "review" / "reviewed_machine_negatives.txt").write_text(
        "# No new edge-case frames are treated as negatives without review.\n", encoding="utf-8"
    )
    (live_root / "train.txt").write_text(
        "\n".join(f"image/{item.name}" for item in sorted((live_root / "image").iterdir())) + "\n",
        encoding="utf-8",
    )
    yaml_payload = {
        "path": str(live_root.resolve()),
        "train": "train.txt",
        "names": {index: name for index, name in enumerate(cfg["canonical_names"])},
    }
    (live_root / "data.yaml").write_text(yaml.safe_dump(yaml_payload, sort_keys=False), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize GG1/GG2 edge data and run the guarded existing preparer.")
    parser.add_argument("--config", required=True)
    parser.add_argument("--run", default=None)
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()

    cfg = load_config(args.config, run_name_override=args.run)
    stage_root = workflow_paths(cfg)["incoming_live_dataset"].parent
    clean_stage_root(stage_root)
    reports = [stage_source(cfg, source, stage_root) for source in cfg["edge_sources"]]
    write_staged_surfaces(cfg, stage_root)
    report = {
        "run_name": cfg["run_name"],
        "stage_root": str(stage_root),
        "sources": reports,
        "kept_images": sum(int(item["kept_images"]) for item in reports),
        "kept_annotations": sum(int(item["kept_annotations"]) for item in reports),
        "quarantined_records": sum(len(item["quarantine"]) for item in reports),
        "quarantined_by_reason": dict(Counter(
            entry["reason"] for item in reports for entry in item["quarantine"]
        )),
        "production_modified": False,
    }
    report_path = cfg["_resolved"]["reports_dir"] / "edge_staging_report.json"
    write_json(report_path, report)
    expected = {"kept_images": 103, "kept_annotations": 170, "quarantined_records": 8}
    if any(report[key] != value for key, value in expected.items()):
        raise RuntimeError(f"edge staging counts differ from audited input: {report}")

    prepare_script = Path(__file__).with_name("prepare_live_finetune.py")
    command = [sys.executable, str(prepare_script), "--config", str(Path(args.config).resolve()), "--run", cfg["run_name"]]
    if args.preflight_only:
        command.append("--preflight-only")
    result = subprocess.run(command, cwd=str(cfg["_resolved"]["model2_root"]))
    if result.returncode != 0:
        return result.returncode
    prepare_report = cfg["_resolved"]["reports_dir"] / "prepare_report.json"
    if not prepare_report.is_file():
        raise RuntimeError(f"preparer did not write {prepare_report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
