from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from ultralytics import YOLO

from live_finetune_common import (
    canonical_names,
    load_config,
    log_event,
    onnx_meta,
    poly_iou,
    read_json,
    read_label_names,
    report_path,
    sha256_file,
    workflow_paths,
    write_json,
    write_status,
)

PACKAGE_SCRIPTS = Path(__file__).resolve().parents[3] / "scripts"
if str(PACKAGE_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SCRIPTS))
import package_models  # noqa: E402


def export_candidate(weights: Path, output_dir: Path, imgsz: int, labels: list[str]) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    model = YOLO(str(weights))
    exported = Path(model.export(format="onnx", imgsz=imgsz, opset=13, simplify=True))
    dest = output_dir / "model.onnx"
    shutil.copy2(exported, dest)
    labels_path = output_dir / "labels.txt"
    labels_path.write_text("\n".join(labels) + "\n", encoding="utf-8")
    return {
        "model": str(dest),
        "labels": str(labels_path),
        "sha256": sha256_file(dest, upper=True),
        "bytes": dest.stat().st_size,
    }


def finite_onnx_outputs(model_path: Path) -> dict[str, Any]:
    import onnxruntime as ort

    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    inp = session.get_inputs()[0]
    shape = [int(dim) if isinstance(dim, int) else 1 for dim in inp.shape]
    dummy = np.zeros(shape, dtype=np.float32)
    outputs = session.run(None, {inp.name: dummy})
    finite = bool(outputs and np.isfinite(outputs[0]).all())
    return {"meta": onnx_meta(model_path), "finite_outputs": finite}


def gather_parity_samples(cfg: dict[str, Any], limit: int) -> list[Path]:
    generated_root = workflow_paths(cfg)["generated_root"]
    samples = read_json(generated_root / "manifests" / "live_samples.json", default=[])
    picked = []
    for sample in samples:
        if sample.get("is_negative"):
            continue
        if sample.get("live_split") not in {"val", "holdout"}:
            continue
        picked.append(generated_root / "canonical" / "live_machine" / "images" / sample["image_name"])
        if len(picked) >= limit:
            break
    return picked


def detections_by_class(result: Any, names: list[str]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    if result.obb is None or len(result.obb) == 0:
        return out
    polygons = result.obb.xyxyxyxy.cpu().numpy().astype(np.float32)
    classes = result.obb.cls.cpu().numpy().astype(int)
    confidences = result.obb.conf.cpu().numpy()
    for polygon, cls_idx, conf in zip(polygons, classes, confidences):
        name = names[int(cls_idx)]
        if name not in out or float(conf) > out[name]["confidence"]:
            out[name] = {"confidence": float(conf), "polygon": polygon}
    return out


def verdict(detections: dict[str, dict[str, Any]], violation_conf: float) -> str:
    return "REJECT" if any(item["confidence"] >= violation_conf for item in detections.values()) else "ACCEPT"


def parity_report(
    pytorch_weights: Path,
    onnx_model: Path,
    *,
    imgsz: int,
    cfg: dict[str, Any],
    iou_min: float,
    conf_tolerance: float | None,
) -> dict[str, Any]:
    names = canonical_names(cfg)
    infer_conf = float(cfg["runtime_contract"]["infer_conf"])
    violation_conf = float(cfg["runtime_contract"]["violation_conf"])
    samples = gather_parity_samples(cfg, int(cfg["evaluation"]["parity_sample_limit"]))
    pt_model = YOLO(str(pytorch_weights))
    onnx_runner = YOLO(str(onnx_model), task="obb")
    max_conf_diff = 0.0
    min_iou = 1.0
    verdict_mismatch = 0
    missing_mismatch = 0
    comparisons = []

    for image_path in samples:
        image = cv2.imread(str(image_path))
        if image is None:
            continue
        pt = detections_by_class(pt_model.predict(image, imgsz=imgsz, conf=infer_conf, device="cpu", verbose=False)[0], names)
        ox = detections_by_class(onnx_runner.predict(image, imgsz=imgsz, conf=infer_conf, device="cpu", verbose=False)[0], names)
        verdict_pt = verdict(pt, violation_conf)
        verdict_ox = verdict(ox, violation_conf)
        if verdict_pt != verdict_ox:
            verdict_mismatch += 1
        for name in names:
            left = pt.get(name)
            right = ox.get(name)
            if bool(left) != bool(right):
                missing_mismatch += 1
                continue
            if not left or not right:
                continue
            diff = abs(left["confidence"] - right["confidence"])
            iou = poly_iou(left["polygon"], right["polygon"])
            max_conf_diff = max(max_conf_diff, diff)
            min_iou = min(min_iou, iou)
            comparisons.append({"image_name": image_path.name, "class_name": name, "conf_diff": round(diff, 8), "polygon_iou": round(iou, 6)})

    passed = verdict_mismatch == 0 and missing_mismatch == 0 and min_iou >= iou_min
    if conf_tolerance is not None:
        passed = passed and max_conf_diff <= conf_tolerance
    return {
        "sample_count": len(samples),
        "comparisons": comparisons,
        "verdict_mismatch_count": verdict_mismatch,
        "missing_detection_mismatch_count": missing_mismatch,
        "max_conf_diff": round(max_conf_diff, 8),
        "min_polygon_iou": round(min_iou if comparisons else 1.0, 6),
        "iou_min_required": iou_min,
        "conf_tolerance": conf_tolerance,
        "passed": passed,
    }


def enforce_candidate_stage(target: str, *, candidate_root: Path, stage_root: Path, provenance: dict[str, Any]) -> None:
    models_dir = stage_root / target / "models"
    labels_dir = models_dir / "labels"
    labels_dir.mkdir(parents=True, exist_ok=True)
    replacements = {
        "pc": [
            (candidate_root / "onnx_640" / "model.onnx", models_dir / "m2_obb_640.onnx"),
            (candidate_root / "onnx_640" / "labels.txt", labels_dir / "m2_obb.txt"),
        ],
        "jetson": [
            (candidate_root / "onnx_416" / "model.onnx", models_dir / "m2_obb_416.onnx"),
            (candidate_root / "onnx_640" / "labels.txt", labels_dir / "m2_obb.txt"),
        ],
    }
    for src, dst in replacements[target]:
        shutil.copy2(src, dst)
    source_map = package_models.build_source_map(target, m2_source_root=candidate_root)
    manifest = package_models.build_manifest(
        target,
        models_dir,
        source_map,
        package_scope="m2",
        provenance=provenance,
    )
    manifest_path = models_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def stage_package(cfg: dict[str, Any], candidate_root: Path, provenance: dict[str, Any], stage_root: Path) -> dict[str, Any]:
    info = {}
    for target in ("pc", "jetson"):
        code, details = package_models.package_target(
            target,
            scope="m2",
            check_only=False,
            stage_root=stage_root,
            m2_source_root=candidate_root,
            provenance=provenance,
        )
        if code != 0:
            raise RuntimeError(json.dumps(details))
        enforce_candidate_stage(target, candidate_root=candidate_root, stage_root=stage_root, provenance=provenance)
        check_code, check = package_models.package_target(
            target,
            scope="m2",
            check_only=True,
            stage_root=stage_root,
            m2_source_root=candidate_root,
            provenance=provenance,
        )
        if check_code != 0:
            raise RuntimeError(json.dumps(check))
        info[target] = {"package": details, "check": check}
    return info


def backup_files(backup_root: Path, files: list[Path], anchor: Path) -> list[str]:
    copied = []
    for path in files:
        if not path.is_file():
            continue
        rel = path.relative_to(anchor)
        dst = backup_root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dst)
        copied.append(str(dst))
    return copied


def staged_manifest_hashes(stage_root: Path) -> dict[str, Any]:
    out = {}
    for target in ("pc", "jetson"):
        manifest = stage_root / target / "models" / "manifest.json"
        payload = json.loads(manifest.read_text(encoding="utf-8"))
        out[target] = {entry["filename"]: entry["sha256"] for entry in payload.get("models", [])}
    return out


def engine_invalidation(new_jetson_hash: str, cfg: dict[str, Any]) -> dict[str, Any]:
    engine_path = cfg["_resolved"]["promotion"]["jetson_engine"]
    manifest_path = cfg["_resolved"]["promotion"]["jetson_engine_manifest"]
    result = {"engine_present": engine_path.is_file(), "invalidated": False, "reason": None}
    if not engine_path.is_file() or not manifest_path.is_file():
        return result
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    kept = []
    changed = False
    for entry in manifest.get("engines", []):
        if entry.get("filename") != engine_path.name:
            kept.append(entry)
            continue
        if entry.get("onnx_sha256", "").upper() != new_jetson_hash.upper():
            changed = True
            result["invalidated"] = True
            result["reason"] = "stale_onnx_sha256"
        else:
            kept.append(entry)
    if changed:
        engine_path.unlink(missing_ok=True)
        manifest["engines"] = kept
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return result


def replace_from_stage(stage_root: Path, candidate_root: Path, cfg: dict[str, Any]) -> dict[str, Any]:
    promotion_cfg = cfg["_resolved"]["promotion"]
    replacement_map = [
        (candidate_root / "onnx_640" / "model.onnx", promotion_cfg["model2_training_exports"]["onnx_640"] / "model.onnx"),
        (candidate_root / "onnx_640" / "labels.txt", promotion_cfg["model2_training_exports"]["onnx_640"] / "labels.txt"),
        (candidate_root / "onnx_416" / "model.onnx", promotion_cfg["model2_training_exports"]["onnx_416"] / "model.onnx"),
        (candidate_root / "onnx_416" / "labels.txt", promotion_cfg["model2_training_exports"]["onnx_416"] / "labels.txt"),
        (candidate_root / "onnx_768" / "model.onnx", promotion_cfg["model2_training_exports"]["onnx_768"] / "model.onnx"),
        (candidate_root / "onnx_768" / "labels.txt", promotion_cfg["model2_training_exports"]["onnx_768"] / "labels.txt"),
        (stage_root / "pc" / "models" / "m2_obb_640.onnx", promotion_cfg["pc_package_dir"] / "m2_obb_640.onnx"),
        (stage_root / "pc" / "models" / "labels" / "m2_obb.txt", promotion_cfg["pc_package_dir"] / "labels" / "m2_obb.txt"),
        (stage_root / "pc" / "models" / "manifest.json", promotion_cfg["pc_manifest"]),
        (stage_root / "jetson" / "models" / "m2_obb_416.onnx", promotion_cfg["jetson_package_dir"] / "m2_obb_416.onnx"),
        (stage_root / "jetson" / "models" / "labels" / "m2_obb.txt", promotion_cfg["jetson_package_dir"] / "labels" / "m2_obb.txt"),
        (stage_root / "jetson" / "models" / "manifest.json", promotion_cfg["jetson_manifest"]),
    ]
    written = []
    for src, dst in replacement_map:
        if not src.is_file():
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        written.append({"path": str(dst), "sha256": sha256_file(dst, upper=True)})
    return {"written": written}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=None)
    parser.add_argument("--run", default=None)
    parser.add_argument("--weights", default=None)
    args = parser.parse_args()

    cfg = load_config(args.config, run_name_override=args.run)
    run_name = args.run or cfg["run_name"]
    labels = canonical_names(cfg)
    model2_root = Path(cfg["_resolved"]["model2_root"])
    weights = Path(args.weights) if args.weights else model2_root / "runs" / run_name / "weights" / "best.pt"
    if not weights.is_file():
        write_status(cfg, "CRASHED", step="promote", detail=f"candidate weights missing: {weights}")
        return 1

    evaluation_report = read_json(report_path(cfg, "evaluation_report.json"), default={})
    prepare_report = read_json(report_path(cfg, "prepare_report.json"), default={})
    candidate_root = workflow_paths(cfg)["candidate_export_root"]
    candidate_root.mkdir(parents=True, exist_ok=True)

    write_status(cfg, "EXPORTING", step="promote", candidate_weights=str(weights))
    export_results = {
        "onnx_640": export_candidate(weights, candidate_root / "onnx_640", 640, labels),
        "onnx_416": export_candidate(weights, candidate_root / "onnx_416", 416, labels),
        "onnx_768": export_candidate(weights, candidate_root / "onnx_768", 768, labels),
    }

    write_status(cfg, "VALIDATING", step="promote-export-validation")
    validation = {}
    for key, item in export_results.items():
        model_path = Path(item["model"])
        validation[key] = finite_onnx_outputs(model_path)
        validation[key]["labels"] = read_label_names(model_path.parent / "labels.txt")
        validation[key]["class_order_ok"] = validation[key]["labels"] == labels

    pc_parity = parity_report(
        weights,
        candidate_root / "onnx_640" / "model.onnx",
        imgsz=640,
        cfg=cfg,
        iou_min=float(cfg["evaluation"]["pc_polygon_iou_min"]),
        conf_tolerance=float(cfg["evaluation"]["pc_conf_tolerance"]),
    )
    jetson_parity = parity_report(
        weights,
        candidate_root / "onnx_416" / "model.onnx",
        imgsz=416,
        cfg=cfg,
        iou_min=float(cfg["evaluation"]["jetson_polygon_iou_min"]),
        conf_tolerance=None,
    )

    stage_root = Path(tempfile.mkdtemp(prefix=f"{run_name}_stage_", dir=str(workflow_paths(cfg)["logs_root"])))
    provenance = {
        "run_name": run_name,
        "dataset_source_hash": prepare_report.get("dataset_source_hash"),
        "evaluation_report": str(report_path(cfg, "evaluation_report.json")),
        "promote_invoked_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    package_info = stage_package(cfg, candidate_root, provenance, stage_root)
    staged_hashes = staged_manifest_hashes(stage_root)

    export_validation_gates = {
        "onnx_graph_load_640": validation["onnx_640"]["finite_outputs"],
        "onnx_graph_load_416": validation["onnx_416"]["finite_outputs"],
        "onnx_graph_load_768": validation["onnx_768"]["finite_outputs"],
        "class_order_640": validation["onnx_640"]["class_order_ok"],
        "class_order_416": validation["onnx_416"]["class_order_ok"],
        "pc_parity": pc_parity["passed"],
        "jetson_parity": jetson_parity["passed"],
        "packaged_hash_match_pc": staged_hashes["pc"].get("m2_obb_640.onnx") == export_results["onnx_640"]["sha256"].lower(),
        "packaged_hash_match_jetson": staged_hashes["jetson"].get("m2_obb_416.onnx") == export_results["onnx_416"]["sha256"].lower(),
    }

    blockers = []
    blockers.extend(evaluation_report.get("gate_blockers", []))
    blockers.extend([name for name, ok in export_validation_gates.items() if not ok])
    blockers = sorted(set(blockers))

    report = {
        "run_name": run_name,
        "candidate_weights": str(weights),
        "candidate_export_root": str(candidate_root),
        "exports": export_results,
        "export_validation": validation,
        "pc_parity": pc_parity,
        "jetson_parity": jetson_parity,
        "stage_root": str(stage_root),
        "stage_package": package_info,
        "export_validation_gates": export_validation_gates,
        "gate_blockers": blockers,
        "promotion_occurred": False,
    }

    if blockers:
        report["status"] = "blocked"
        write_json(report_path(cfg, "promotion_report.json"), report)
        log_event(cfg, "promotion blocked by gates", status="STOPPED", blockers=blockers)
        write_status(cfg, "STOPPED", step="promote", detail=f"promotion blocked: {', '.join(blockers)}")
        return 0

    write_status(cfg, "PROMOTING", step="promote-replace")
    promotion_cfg = cfg["_resolved"]["promotion"]
    old_pc_hash = sha256_file(promotion_cfg["pc_package_dir"] / "m2_obb_640.onnx", upper=True)
    old_jetson_hash = sha256_file(promotion_cfg["jetson_package_dir"] / "m2_obb_416.onnx", upper=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    backup_root = workflow_paths(cfg)["logs_root"] / "backups" / f"{timestamp}_{old_pc_hash[:12]}_{old_jetson_hash[:12]}"
    backup_root.mkdir(parents=True, exist_ok=True)
    backup_targets = [
        promotion_cfg["model2_training_exports"]["onnx_640"] / "model.onnx",
        promotion_cfg["model2_training_exports"]["onnx_640"] / "labels.txt",
        promotion_cfg["model2_training_exports"]["onnx_416"] / "model.onnx",
        promotion_cfg["model2_training_exports"]["onnx_416"] / "labels.txt",
        promotion_cfg["model2_training_exports"]["onnx_768"] / "model.onnx",
        promotion_cfg["model2_training_exports"]["onnx_768"] / "labels.txt",
        promotion_cfg["pc_package_dir"] / "m2_obb_640.onnx",
        promotion_cfg["pc_package_dir"] / "labels" / "m2_obb.txt",
        promotion_cfg["pc_manifest"],
        promotion_cfg["jetson_package_dir"] / "m2_obb_416.onnx",
        promotion_cfg["jetson_package_dir"] / "labels" / "m2_obb.txt",
        promotion_cfg["jetson_manifest"],
        promotion_cfg["jetson_engine"],
        promotion_cfg["jetson_engine_manifest"],
    ]
    backup_files(backup_root, backup_targets, promotion_cfg["pc_package_dir"].parents[2])

    try:
        replacement = replace_from_stage(stage_root, candidate_root, cfg)
        engine_result = engine_invalidation(export_results["onnx_416"]["sha256"], cfg)
    except Exception as exc:
        write_status(cfg, "ROLLED_BACK", step="promote", detail=str(exc))
        raise

    report.update(
        {
            "status": "promoted",
            "promotion_occurred": True,
            "backup_root": str(backup_root),
            "replacement": replacement,
            "engine_invalidation": engine_result,
            "rollback_instructions": f"Restore files from {backup_root} to Trash-detection relative paths to revert the promotion.",
        }
    )
    write_json(report_path(cfg, "promotion_report.json"), report)
    log_event(cfg, "promotion completed", status="COMPLETED", backup_root=str(backup_root))
    write_status(cfg, "COMPLETED", step="promote", detail="promotion completed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
