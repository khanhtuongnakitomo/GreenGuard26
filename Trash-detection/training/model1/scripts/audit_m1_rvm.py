"""Read-only audit for the RVM Model 1 fine-tuning sources.

The audit deliberately treats Model 2 OBB part labels as incompatible with the
Model 1 whole-object HBB contract. It produces a review queue; it never
rewrites or relabels incoming data.
"""

from __future__ import annotations

import argparse
import csv
import zipfile
from pathlib import Path

from m1_rvm_common import (
    CLASS_NAMES,
    atomic_json_dump,
    image_files,
    inspect_label_file,
    label_for_image,
    load_config,
    model_root,
    relative_to_model,
    run_id,
    sha256_file,
)


def audit(config: dict, run_name: str) -> dict:
    root = model_root()
    live_root = root / config["source"]["live_root"]
    output_root = root / "logs" / "rvm" / run_name
    output_root.mkdir(parents=True, exist_ok=True)

    images = image_files(live_root)
    inventory: list[dict] = []
    format_counts: dict[str, int] = {}
    raw_row_counts: dict[str, int] = {}
    review_rows: list[dict] = []
    valid_hbb = 0
    invalid_or_missing = 0

    for image in images:
        label = label_for_image(image)
        try:
            source = image.resolve().relative_to(live_root.resolve()).parts[0]
        except (ValueError, IndexError):
            source = image.parent.name
        item = {
            "image": relative_to_model(image),
            "label": relative_to_model(label) if label.exists() else None,
            "source_group": source,
            "image_sha256": sha256_file(image),
            "label_sha256": sha256_file(label) if label.exists() else None,
        }
        if label.exists():
            inspection = inspect_label_file(label)
            item.update({"label_formats": inspection["formats"], "label_errors": inspection["errors"]})
            for label_format in inspection["formats"]:
                format_counts[label_format] = format_counts.get(label_format, 0) + 1
            for record in inspection["records"]:
                class_id = str(record["class_id"])
                raw_row_counts[class_id] = raw_row_counts.get(class_id, 0) + 1
            if inspection["formats"] == ["hbb_yolo_5"] and not inspection["errors"]:
                valid_hbb += 1
                disposition = "candidate_for_review"
            else:
                invalid_or_missing += 1
                disposition = "needs_whole_object_review"
        else:
            invalid_or_missing += 1
            item.update({"label_formats": [], "label_errors": ["missing label"]})
            disposition = "missing_label"
        item["disposition"] = disposition
        inventory.append(item)
        review_rows.append({
            "image": item["image"],
            "label": item["label"] or "",
            "source_group": source,
            "disposition": disposition,
            "review_class": "",
            "lighting": "",
            "sequence_id": "",
            "reviewer": "",
            "notes": "",
        })

    archives = []
    for archive in sorted(live_root.rglob("*.zip")):
        try:
            with zipfile.ZipFile(archive) as handle:
                names = handle.namelist()
            archives.append({"path": relative_to_model(archive), "sha256": sha256_file(archive), "entries": len(names)})
        except zipfile.BadZipFile:
            archives.append({"path": relative_to_model(archive), "sha256": sha256_file(archive), "error": "bad_zip"})

    groups = sorted({item["source_group"] for item in inventory})
    status = "READY_FOR_REVIEW" if valid_hbb else "NEEDS_DATA"
    report = {
        "schema": "m1-rvm-audit-v1",
        "run_id": run_name,
        "status": status,
        "model1_class_contract": CLASS_NAMES,
        "source_root": relative_to_model(live_root),
        "source_is_immutable": True,
        "image_count": len(images),
        "images_with_valid_hbb_labels": valid_hbb,
        "images_needing_review_or_missing_labels": invalid_or_missing,
        "source_groups": groups,
        "format_counts": format_counts,
        "row_counts_by_raw_class_id": raw_row_counts,
        "archives": archives,
        "inventory": inventory,
        "blocking_reasons": [] if valid_hbb else [
            "No reviewed Model 1 whole-object HBB annotations were found.",
            "The live labels are expected to be Model 2 OBB part labels and must not be reused as whole-object boxes.",
            "Add reviewer-approved annotations with class IDs 0=metal_can, 1=pet_bottle, 2=pp_cup before preparation.",
        ],
    }
    atomic_json_dump(output_root / "audit_report.json", report)
    with (output_root / "annotation_review_queue.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(review_rows[0]) if review_rows else ["image"])
        writer.writeheader()
        writer.writerows(review_rows)
    atomic_json_dump(output_root / "source_manifest.json", {
        "run_id": run_name,
        "source_root": relative_to_model(live_root),
        "files": inventory,
        "archives": archives,
    })
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path)
    parser.add_argument("--run-id")
    args = parser.parse_args()
    config = load_config(args.config)
    name = args.run_id or run_id(config)
    report = audit(config, name)
    print(f"AUDIT_STATUS={report['status']}")
    print(f"AUDIT_IMAGES={report['image_count']}")
    print(f"AUDIT_VALID_HBB={report['images_with_valid_hbb_labels']}")
    print(f"AUDIT_REPORT={model_root() / 'logs' / 'rvm' / name / 'audit_report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
