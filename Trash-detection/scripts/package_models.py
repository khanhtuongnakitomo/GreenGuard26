"""Package approved ONNX exports into pc-demo/ and jetson-runtime/ with manifests."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[1]
TRAINING = ROOT / "training"

M1_DET = TRAINING / "model1" / "export" / "onnx_416" / "model.onnx"
M1_CLS = TRAINING / "model1" / "export" / "cls_onnx_224" / "model.onnx"
M2_640 = TRAINING / "model2" / "export" / "onnx_640" / "model.onnx"
M2_416 = TRAINING / "model2" / "export" / "onnx_416" / "model.onnx"

LABEL_SOURCES = {
    "m1_detector.txt": TRAINING / "model1" / "export" / "onnx_416" / "labels.txt",
    "m1_classifier.txt": TRAINING / "model1" / "export" / "cls_onnx_224" / "labels.txt",
    "m2_obb.txt": TRAINING / "model2" / "export" / "onnx_640" / "labels.txt",
}

MODEL_SPECS = {
    "pc": {
        "dir": ROOT / "pc-demo" / "models",
        "models": [
            {"filename": "m1_detector_416.onnx", "source": M1_DET, "labels": "m1_detector.txt", "family": "m1", "task": "obb"},
            {"filename": "m1_classifier_224.onnx", "source": M1_CLS, "labels": "m1_classifier.txt", "family": "m1", "task": "classify"},
            {"filename": "m2_obb_640.onnx", "source": M2_640, "labels": "m2_obb.txt", "family": "m2", "task": "obb"},
        ],
    },
    "jetson": {
        "dir": ROOT / "jetson-runtime" / "models",
        "models": [
            {"filename": "m1_detector_416.onnx", "source": M1_DET, "labels": "m1_detector.txt", "family": "m1", "task": "obb"},
            {"filename": "m1_classifier_224.onnx", "source": M1_CLS, "labels": "m1_classifier.txt", "family": "m1", "task": "classify"},
            {"filename": "m2_obb_416.onnx", "source": M2_416, "labels": "m2_obb.txt", "family": "m2", "task": "obb"},
        ],
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT.parents[0], text=True).strip()
    except Exception:
        return None


def read_labels(path: Path) -> list[str]:
    if not path.is_file():
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def onnx_meta(path: Path) -> dict[str, Any]:
    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    inp = session.get_inputs()[0]
    out = session.get_outputs()[0]
    return {
        "input_name": inp.name,
        "input_shape": list(inp.shape),
        "output_shape": list(out.shape),
    }


def resolve_m2_overrides(m2_source_root: Path | None) -> dict[str, Path]:
    if not m2_source_root:
        return {}
    return {
        "m2_obb_640.onnx": m2_source_root / "onnx_640" / "model.onnx",
        "m2_obb_416.onnx": m2_source_root / "onnx_416" / "model.onnx",
        "m2_obb.txt": m2_source_root / "onnx_640" / "labels.txt",
    }


def same_file(a: Path, b: Path) -> bool:
    try:
        return a.resolve() == b.resolve()
    except Exception:
        return False


def stage_existing_tree(live_dir: Path, stage_dir: Path) -> None:
    if stage_dir.exists():
        shutil.rmtree(stage_dir)
    if live_dir.is_dir():
        shutil.copytree(live_dir, stage_dir)
    else:
        stage_dir.mkdir(parents=True, exist_ok=True)


def build_source_map(target: str, *, m2_source_root: Path | None) -> dict[str, Path]:
    overrides = resolve_m2_overrides(m2_source_root)
    out = {key: value for key, value in LABEL_SOURCES.items()}
    for spec in MODEL_SPECS[target]["models"]:
        out[spec["filename"]] = overrides.get(spec["filename"], spec["source"])
        out[spec["labels"]] = overrides.get(spec["labels"], LABEL_SOURCES[spec["labels"]])
    return out


def copy_selected_files(target: str, output_dir: Path, source_map: dict[str, Path], *, scope: str) -> None:
    labels_dir = output_dir / "labels"
    labels_dir.mkdir(parents=True, exist_ok=True)
    for spec in MODEL_SPECS[target]["models"]:
        if scope == "m2" and spec["family"] != "m2":
            continue
        src = source_map[spec["filename"]]
        dst = output_dir / spec["filename"]
        if not src.is_file():
            raise FileNotFoundError(f"missing source model for {target}: {src}")
        if not same_file(src, dst):
            shutil.copy2(src, dst)
        label_src = source_map[spec["labels"]]
        label_dst = labels_dir / spec["labels"]
        if label_src.is_file() and not same_file(label_src, label_dst):
            shutil.copy2(label_src, label_dst)


def build_manifest(
    target: str,
    models_dir: Path,
    source_map: dict[str, Path],
    *,
    package_scope: str,
    provenance: dict[str, Any] | None,
) -> dict[str, Any]:
    entries = []
    for spec in MODEL_SPECS[target]["models"]:
        packaged = models_dir / spec["filename"]
        if not packaged.is_file():
            continue
        src = source_map[spec["filename"]]
        label_src = source_map[spec["labels"]]
        meta = onnx_meta(packaged)
        source_path = str(src)
        if src.exists():
            try:
                source_path = str(src.relative_to(ROOT.parents[0])).replace("\\", "/")
            except ValueError:
                source_path = str(src)
        entries.append(
            {
                "filename": spec["filename"],
                "path": f"models/{spec['filename']}",
                "family": spec["family"],
                "task": spec["task"],
                "source_path": source_path,
                "source_commit": git_commit(),
                "source_sha256": sha256(src) if src.is_file() else None,
                "source_bytes": src.stat().st_size if src.is_file() else None,
                "sha256": sha256(packaged),
                "bytes": packaged.stat().st_size,
                "input_name": meta["input_name"],
                "input_shape": meta["input_shape"],
                "output_shape": meta["output_shape"],
                "classes": read_labels(label_src),
                "image_size": meta["input_shape"][2] if len(meta["input_shape"]) > 2 else None,
            }
        )
    return {
        "target": target,
        "source_commit": git_commit(),
        "packaged_at_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "package_scope": package_scope,
        "provenance": provenance or {},
        "models": entries,
    }


def package_target(
    target: str,
    *,
    scope: str = "all",
    check_only: bool = False,
    stage_root: Path | None = None,
    m2_source_root: Path | None = None,
    provenance: dict[str, Any] | None = None,
) -> tuple[int, dict[str, Any]]:
    live_dir = MODEL_SPECS[target]["dir"]
    source_map = build_source_map(target, m2_source_root=m2_source_root)
    output_dir = live_dir
    if stage_root is not None:
        output_dir = stage_root / target / "models"

    if check_only:
        manifest_path = output_dir / "manifest.json"
        if not manifest_path.is_file():
            return 1, {"error": f"missing manifest: {manifest_path}"}
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        failures = []
        for entry in manifest.get("models", []):
            path = output_dir / entry["filename"]
            if not path.is_file():
                failures.append(f"missing packaged model {path}")
                continue
            if sha256(path) != entry.get("sha256"):
                failures.append(f"sha256 mismatch for {path.name}")
        return (0 if not failures else 1), {"manifest": str(manifest_path), "failures": failures}

    output_dir.mkdir(parents=True, exist_ok=True)
    if stage_root is not None:
        stage_existing_tree(live_dir, output_dir)
    copy_selected_files(target, output_dir, source_map, scope=scope)
    manifest = build_manifest(target, output_dir, source_map, package_scope=scope, provenance=provenance)
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return 0, {"manifest_path": str(manifest_path), "output_dir": str(output_dir)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", choices=["pc", "jetson", "all"], default="all")
    parser.add_argument("--scope", choices=["all", "m2"], default="all")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--stage-root", default=None)
    parser.add_argument("--m2-source-root", default=None)
    parser.add_argument("--provenance-json", default=None)
    args = parser.parse_args()

    targets = ["pc", "jetson"] if args.target == "all" else [args.target]
    stage_root = Path(args.stage_root).resolve() if args.stage_root else None
    m2_source_root = Path(args.m2_source_root).resolve() if args.m2_source_root else None
    provenance = None
    if args.provenance_json:
        provenance = json.loads(Path(args.provenance_json).read_text(encoding="utf-8"))

    rc = 0
    for target in targets:
        code, info = package_target(
            target,
            scope=args.scope,
            check_only=args.check,
            stage_root=stage_root,
            m2_source_root=m2_source_root,
            provenance=provenance,
        )
        if code != 0:
            rc = code
            print(json.dumps(info, indent=2), file=sys.stderr)
        else:
            print(json.dumps({"target": target, **info}, indent=2))
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
