"""Package a structurally valid Model 1 challenger without touching production files."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[4]
MODEL_ROOT = Path(__file__).resolve().parents[1]
PC_ROOT = REPO_ROOT / "Trash-detection" / "pc-demo"
STABLE_MODEL = PC_ROOT / "models" / "candidates" / "m1_efficient_current.onnx"
STABLE_MANIFEST = PC_ROOT / "models" / "m1_candidate_manifest.json"
STABLE_CONFIG = PC_ROOT / "config" / "m1_candidate.json"
LABELS = ["metal_can", "pet_bottle"]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest().lower()


def read_json(path: Path, default: Any = None) -> Any:
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    temporary.replace(path)


def resolve_artifact(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else (REPO_ROOT / path).resolve()


def candidate_status(evaluation: dict[str, Any], verify: dict[str, Any], export: dict[str, Any]) -> str:
    checks = verify.get("checks", {})
    structurally_valid = bool(
        checks.get("candidate_exists")
        and checks.get("candidate_sha256") == checks.get("expected_sha256")
        and checks.get("structural_compatible")
        and checks.get("class_metadata", {}).get("pass")
        and not checks.get("rejected_hash")
    )
    if not structurally_valid:
        return "FAILED_EXPORT_NO_RUNNABLE_CANDIDATE"
    if checks.get("parity", {}).get("status") != "PASS":
        return "FAILED_PARITY_CANDIDATE"
    if evaluation.get("status") != "PASS":
        return "FAILED_ACCEPTANCE_CANDIDATE"
    return "CAMERA_VALIDATION_REQUIRED_CANDIDATE"


def package(run_id: str, report_root: Path) -> dict[str, Any]:
    export = read_json(report_root / "export_report.json", {})
    verify = read_json(report_root / "verify_report.json", {})
    evaluation = read_json(report_root / "evaluation_report.json", {})
    source = resolve_artifact(str(export.get("onnx", "")))
    if not source.is_file():
        raise FileNotFoundError(f"exported candidate is missing: {source}")

    source_hash = sha256_file(source)
    expected_hash = str(export.get("onnx_sha256", "")).lower()
    if source_hash != expected_hash:
        raise RuntimeError(f"candidate export hash mismatch: {source_hash} != {expected_hash}")

    status = candidate_status(evaluation, verify, export)
    if status == "FAILED_EXPORT_NO_RUNNABLE_CANDIDATE":
        result = {
            "schema": "greenguard-m1-candidate-package-v1",
            "run_id": run_id,
            "status": status,
            "candidate_onnx": None,
            "source_export": str(source),
            "verify": verify,
        }
        write_json(report_root / "candidate_package_report.json", result)
        raise RuntimeError("candidate is not structurally runnable; it was not packaged")

    STABLE_MODEL.parent.mkdir(parents=True, exist_ok=True)
    if STABLE_MODEL.is_file() and sha256_file(STABLE_MODEL) != source_hash:
        raise RuntimeError(f"refusing to overwrite a different candidate: {STABLE_MODEL}")
    shutil.copy2(source, STABLE_MODEL)

    thresholds = evaluation.get("thresholds", {"metal_can": 0.65, "pet_bottle": 0.65})
    thresholds = {name: float(thresholds.get(name, 0.65)) for name in LABELS}
    candidate_manifest = {
        "schema": "greenguard-m1-candidate-manifest-v1",
        "family": "m1_candidate",
        "run_id": run_id,
        "status": status,
        "filename": STABLE_MODEL.name,
        "path": "models/candidates/m1_efficient_current.onnx",
        "sha256": source_hash,
        "bytes": STABLE_MODEL.stat().st_size,
        "classes": LABELS,
        "task": "detect",
        "image_size": 640,
        "input_name": "images",
        "input_shape": [1, 3, 640, 640],
        "output_shape": [1, 6, 8400],
        "source_export": str(source),
        "source_checkpoint": export.get("checkpoint"),
        "source_checkpoint_sha256": export.get("checkpoint_sha256"),
        "decision_conf_by_class": thresholds,
        "physical_camera_status": "NOT_MEASURED",
        "active_model_untouched": True,
    }
    write_json(STABLE_MANIFEST, {"models": [candidate_manifest], "target": "pc", "package_scope": "candidate"})

    config = read_json(STABLE_CONFIG)
    if not isinstance(config, dict):
        raise RuntimeError(f"candidate config is missing or invalid: {STABLE_CONFIG}")
    detector = config.setdefault("m1", {}).setdefault("detector", {})
    detector.update({
        "path": "models/candidates/m1_efficient_current.onnx",
        "classes": LABELS,
        "visible_class_ids": [0, 1],
        "decision_conf": max(thresholds.values()),
        "decision_conf_by_class": thresholds,
        "candidate_only": True,
        "candidate_run": run_id,
        "candidate_sha256": source_hash,
    })
    validation = config.setdefault("candidate_validation", {})
    validation.update({"status": status, "run_id": run_id, "onnx_sha256": source_hash, "physical_camera_status": "NOT_MEASURED"})
    write_json(STABLE_CONFIG, config)

    result = {
        "schema": "greenguard-m1-candidate-package-v1",
        "run_id": run_id,
        "status": status,
        "candidate_onnx": str(STABLE_MODEL),
        "candidate_manifest": str(STABLE_MANIFEST),
        "candidate_config": str(STABLE_CONFIG),
        "sha256": source_hash,
        "bytes": STABLE_MODEL.stat().st_size,
        "thresholds": thresholds,
        "evaluation_status": evaluation.get("status"),
        "parity_status": verify.get("checks", {}).get("parity", {}).get("status"),
        "active_files_modified": False,
    }
    write_json(report_root / "candidate_package_report.json", result)
    report_lines = [
        f"# Model 1 efficient challenger — {run_id}",
        "",
        f"Status: `{status}`",
        "",
        "This is a challenger package. The active Model 1, default configuration, active manifest, and Model 2 files were not modified.",
        "",
        f"- Candidate: `{STABLE_MODEL}`",
        f"- SHA-256: `{source_hash}`",
        f"- Can threshold: `{thresholds['metal_can']:.2f}`",
        f"- PET threshold: `{thresholds['pet_bottle']:.2f}`",
        f"- Evaluation: `{evaluation.get('status', 'NOT_MEASURED')}`",
        f"- ONNX parity: `{verify.get('checks', {}).get('parity', {}).get('status', 'NOT_MEASURED')}`",
        "- Physical camera: `NOT_MEASURED`",
        "",
        "Run `demo_model1_candidate.bat` for candidate-only diagnostics or `compare_model1.bat` for active-versus-candidate replay.",
    ]
    (report_root / "candidate_report.md").write_text("\n".join(report_lines) + "\n", encoding="utf-8", newline="\n")
    compact_report = MODEL_ROOT / "reports" / f"{run_id}.md"
    compact_report.parent.mkdir(parents=True, exist_ok=True)
    compact_report.write_text("\n".join(report_lines) + "\n", encoding="utf-8", newline="\n")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--report-root", type=Path, required=True)
    args = parser.parse_args()
    report_root = args.report_root.resolve()
    result = package(args.run_id, report_root)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
