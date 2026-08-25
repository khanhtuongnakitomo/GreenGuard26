"""Copy approved ONNX exports into pc-demo/ and jetson-runtime/ with manifests."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRAINING = ROOT / "training"

M1_DET = TRAINING / "model1" / "export" / "onnx_416" / "model.onnx"
M1_CLS = TRAINING / "model1" / "export" / "cls_onnx_224" / "model.onnx"
M2_640 = TRAINING / "model2" / "export" / "onnx_640" / "model.onnx"
M2_416 = TRAINING / "model2" / "export" / "onnx_416" / "model.onnx"

LABELS = {
    "m1_detector.txt": TRAINING / "model1" / "export" / "onnx_416" / "labels.txt",
    "m1_classifier.txt": TRAINING / "model1" / "export" / "cls_onnx_224" / "labels.txt",
    "m2_obb.txt": TRAINING / "model2" / "export" / "onnx_640" / "labels.txt",
}

TARGETS = {
    "pc": {
        "dir": ROOT / "pc-demo" / "models",
        "models": {
            "m1_detector_416.onnx": M1_DET,
            "m1_classifier_224.onnx": M1_CLS,
            "m2_obb_640.onnx": M2_640,
        },
        "m2_task": "m2_obb_640",
    },
    "jetson": {
        "dir": ROOT / "jetson-runtime" / "models",
        "models": {
            "m1_detector_416.onnx": M1_DET,
            "m1_classifier_224.onnx": M1_CLS,
            "m2_obb_416.onnx": M2_416,
        },
        "m2_task": "m2_obb_416",
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
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=ROOT.parents[0],
            text=True,
        ).strip()
    except Exception:
        return None


def read_labels(path: Path) -> list[str]:
    if not path.is_file():
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def onnx_meta(path: Path) -> dict:
    import onnxruntime as ort

    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    inp = session.get_inputs()[0]
    out = session.get_outputs()[0]
    return {
        "input_name": inp.name,
        "input_shape": list(inp.shape),
        "output_shape": list(out.shape),
    }


LABEL_MAP = {
    "m1_detector_416.onnx": "m1_detector.txt",
    "m1_classifier_224.onnx": "m1_classifier.txt",
    "m2_obb_640.onnx": "m2_obb.txt",
    "m2_obb_416.onnx": "m2_obb.txt",
}


def build_manifest(target: str, models_dir: Path) -> dict:
    entries = []
    for name in sorted(models_dir.glob("*.onnx")):
        label_key = LABEL_MAP[name.name]
        label_file = LABELS[label_key]
        src = TARGETS[target]["models"][name.name]
        meta = onnx_meta(name)
        entries.append(
            {
                "filename": name.name,
                "path": f"models/{name.name}",
                "source_path": str(src.relative_to(ROOT.parents[0])).replace("\\", "/"),
                "source_commit": git_commit(),
                "sha256": sha256(name),
                "bytes": name.stat().st_size,
                "task": "classify" if "classifier" in name.name else "obb",
                "input_name": meta["input_name"],
                "input_shape": meta["input_shape"],
                "output_shape": meta["output_shape"],
                "classes": read_labels(label_file),
                "image_size": meta["input_shape"][2] if len(meta["input_shape"]) > 2 else None,
            }
        )
    return {
        "target": target,
        "source_commit": git_commit(),
        "models": entries,
    }


def package_target(target: str, check_only: bool = False) -> int:
    spec = TARGETS[target]
    models_dir = spec["dir"]
    labels_dir = models_dir / "labels"
    missing = [str(src) for src in spec["models"].values() if not src.is_file()]
    if missing:
        print(f"ERROR: missing source ONNX for {target}:", file=sys.stderr)
        for item in missing:
            print(f"  {item}", file=sys.stderr)
        return 1

    if check_only:
        manifest_path = models_dir / "manifest.json"
        if not manifest_path.is_file():
            print(f"ERROR: missing manifest: {manifest_path}", file=sys.stderr)
            return 1
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        ok = True
        for entry in manifest.get("models", []):
            path = models_dir / entry["filename"]
            if not path.is_file():
                print(f"ERROR: missing packaged model {path}", file=sys.stderr)
                ok = False
                continue
            digest = sha256(path)
            if digest != entry.get("sha256"):
                print(f"ERROR: sha256 mismatch for {path.name}", file=sys.stderr)
                ok = False
        return 0 if ok else 1

    models_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)
    for name, src in spec["models"].items():
        dst = models_dir / name
        shutil.copy2(src, dst)
        print(f"[{target}] copied {name}")
    for name, src in LABELS.items():
        if src.is_file():
            shutil.copy2(src, labels_dir / name)
            print(f"[{target}] copied labels/{name}")

    manifest = build_manifest(target, models_dir)
    manifest_path = models_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"[{target}] wrote {manifest_path}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", choices=["pc", "jetson", "all"], default="all")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    targets = ["pc", "jetson"] if args.target == "all" else [args.target]
    rc = 0
    for target in targets:
        rc |= package_target(target, check_only=args.check)
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
