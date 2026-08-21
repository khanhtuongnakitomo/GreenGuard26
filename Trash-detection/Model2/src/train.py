"""Train YOLO11n-OBB on a local PET inspection dataset.

Run this yourself on the NVIDIA GPU. Do not start it from the Cursor agent:
training takes many minutes and would block the chat.

From Model2/:

    python src/train.py --dataset data/dataset-3
    python src/train.py --dataset dataset-3 --epochs 50 --batch 16 --device 0

PowerShell:

    .\\train.ps1
    .\\train.ps1 -Dataset dataset-3
    .\\train.ps1 -Dataset D:\\path\\to\\my-dataset
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = "data/dataset-3"
DEFAULT_BASE_MODEL = "yolo11n-obb.pt"
DEFAULT_PROJECT = REPO_ROOT / "runs" / "obb"


def configure_runtime_paths():
    os.chdir(REPO_ROOT)
    config_dir = REPO_ROOT / ".ultralytics"
    config_dir.mkdir(parents=True, exist_ok=True)
    os.environ["YOLO_CONFIG_DIR"] = str(config_dir)
    Path(os.environ.setdefault("MPLCONFIGDIR", str(REPO_ROOT / ".matplotlib"))).mkdir(
        parents=True, exist_ok=True
    )

    settings_path = config_dir / "settings.json"
    settings = {}
    if settings_path.exists():
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    settings["runs_dir"] = str((REPO_ROOT / "runs").resolve())
    settings_path.write_text(json.dumps(settings, indent=2), encoding="utf-8")


configure_runtime_paths()


def parse_args():
    parser = argparse.ArgumentParser(description="Train GreenGuard Model 2 (cap + label + liquid OBB).")
    parser.add_argument(
        "--dataset",
        default=DEFAULT_DATASET,
        help="Dataset folder. Name under data/, path relative to Model2/, or an absolute path.",
    )
    parser.add_argument(
        "--data",
        default="",
        help="Optional dataset YAML. If omitted, one is generated from --dataset.",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_BASE_MODEL,
        help="Base OBB checkpoint (default: yolo11n-obb.pt). Do not use yolo26*.pt here.",
    )
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", default="0", help="GPU id, or cpu")
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--patience", type=int, default=20)
    parser.add_argument("--project", default=str(DEFAULT_PROJECT), help="Training run output directory")
    parser.add_argument("--name", default="cap_label_liquid_v1")
    parser.add_argument("--resume", action="store_true", help="Resume the last run with this name")
    parser.add_argument("--export-path", default="models/best.pt")
    return parser.parse_args()


def resolve_dataset(dataset: str) -> Path:
    raw = Path(dataset.strip())
    candidates = []
    if raw.is_absolute():
        candidates.append(raw)
    else:
        candidates.append(REPO_ROOT / raw)
        if raw.parts[0] != "data":
            candidates.append(REPO_ROOT / "data" / raw)
            candidates.append(REPO_ROOT / "data" / raw.name)
    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            return candidate.resolve()
    raise FileNotFoundError(
        f"Dataset folder not found: {dataset}. Tried: " + ", ".join(str(path) for path in candidates)
    )


def _split_dir(dataset_root: Path, *names: str) -> Path | None:
    for name in names:
        images = dataset_root / name / "images"
        if images.exists() and any(images.iterdir()):
            return images.parent
    return None


def _parse_names(yaml_text: str) -> dict[int, str]:
    names: dict[int, str] = {}
    in_names = False
    for raw_line in yaml_text.splitlines():
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        line = raw_line.strip()
        if not in_names:
            if line.startswith("names:"):
                in_names = True
                rest = line[6:].strip().strip("[]")
                if rest:
                    for index, item in enumerate(rest.split(",")):
                        names[index] = item.strip().strip("'\"")
            continue
        if not line or line.startswith("#"):
            continue
        if indent == 0:
            break
        if ":" in line and line.split(":", 1)[0].strip().isdigit():
            key, value = line.split(":", 1)
            names[int(key.strip())] = value.strip().strip("'\"")
    return names


def write_data_yaml(dataset_root: Path, dest: Path) -> Path:
    train_split = _split_dir(dataset_root, "train")
    val_split = _split_dir(dataset_root, "valid", "val")
    test_split = _split_dir(dataset_root, "test")
    if train_split is None:
        raise FileNotFoundError(f"No training images in {dataset_root / 'train' / 'images'}")
    if val_split is None:
        raise FileNotFoundError(
            f"No validation images in {dataset_root / 'valid' / 'images'} or {dataset_root / 'val' / 'images'}"
        )

    source_yaml = dataset_root / "data.yaml"
    names = {}
    if source_yaml.exists():
        names = _parse_names(source_yaml.read_text(encoding="utf-8"))
    if not names:
        raise ValueError(f"Could not read class names from {source_yaml}")

    lines = [
        f"path: {dataset_root.as_posix()}",
        f"train: {train_split.name}/images",
        f"val: {val_split.name}/images",
    ]
    if test_split is not None:
        lines.append(f"test: {test_split.name}/images")
    lines.append(f"nc: {len(names)}")
    lines.append("names:")
    for index in range(max(names) + 1):
        if index in names:
            lines.append(f"  {index}: {names[index]}")
    lines.append("")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(lines), encoding="utf-8")
    return dest


def resolve_base_model(model_arg: str) -> Path:
    """Model 2 needs OBB weights (cap/label/liquid polygons), not YOLO26 detect."""
    name = Path(model_arg).name
    lower = name.lower()
    if "yolo26" in lower:
        raise SystemExit(
            "Model 2 uses YOLO11 OBB, not yolo26 detect.\n"
            "Remove yolo26n.pt from Model2/ and run again with the default:\n"
            "  .\\train.ps1 -Dataset dataset-3\n"
            "Or explicitly: python src/train.py --model yolo11n-obb.pt"
        )
    if "-obb" not in lower:
        raise SystemExit(
            f"Refusing {model_arg!r}. Model 2 requires an OBB checkpoint such as {DEFAULT_BASE_MODEL}."
        )

    if Path(model_arg).is_absolute():
        candidate = Path(model_arg)
        if candidate.exists():
            return candidate.resolve()
        raise FileNotFoundError(f"Base model not found: {candidate}")

    local = REPO_ROOT / name
    if local.exists():
        return local.resolve()
    return Path(name)


def resolve_project_dir(project_arg: str) -> Path:
    project = Path(project_arg)
    if not project.is_absolute():
        project = REPO_ROOT / project
    project.mkdir(parents=True, exist_ok=True)
    return project.resolve()


def assert_device(device: str):
    if str(device).lower() == "cpu":
        print("WARNING: training on CPU will be very slow.")
        return
    try:
        import torch
    except ImportError as exc:
        raise RuntimeError("PyTorch is not installed. Use Model1 .venv or pip install torch") from exc
    if not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA GPU not visible. Install a CUDA build of PyTorch, or pass --device cpu."
        )
    print(f"Using GPU: {torch.cuda.get_device_name(int(device) if str(device).isdigit() else 0)}")


def main():
    args = parse_args()
    dataset_root = resolve_dataset(args.dataset)
    if args.data:
        data_yaml = Path(args.data)
        if not data_yaml.is_absolute():
            data_yaml = REPO_ROOT / data_yaml
        if not data_yaml.exists():
            raise FileNotFoundError(f"Missing dataset config: {data_yaml}")
    else:
        data_yaml = write_data_yaml(dataset_root, REPO_ROOT / "configs" / "data.yaml")

    base_model = resolve_base_model(args.model)
    project_dir = resolve_project_dir(args.project)
    assert_device(args.device)

    from ultralytics import YOLO

    export_path = Path(args.export_path)
    if not export_path.is_absolute():
        export_path = REPO_ROOT / export_path
    export_path.parent.mkdir(parents=True, exist_ok=True)

    print("Starting Model 2 OBB training")
    print(f"  dataset: {dataset_root}")
    print(f"  data:    {data_yaml}")
    print(f"  model:   {base_model}  (YOLO11 OBB — not yolo26 detect)")
    print(f"  epochs:  {args.epochs}")
    print(f"  batch:   {args.batch}")
    print(f"  imgsz:   {args.imgsz}")
    print(f"  device:  {args.device}")
    print(f"  project: {project_dir}")
    print(f"  export:  {export_path}")

    model = YOLO(str(base_model))
    results = model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=args.workers,
        patience=args.patience,
        project=str(project_dir),
        name=args.name,
        exist_ok=True,
        resume=args.resume,
        plots=True,
    )

    best_src = Path(results.save_dir) / "weights" / "best.pt"
    if not best_src.exists():
        print(f"Training finished but {best_src} was not found.", file=sys.stderr)
        return 1

    shutil.copy2(best_src, export_path)
    print(f"Copied {best_src} -> {export_path}")
    print("Next: python src/run_model2.py")
    print("Then: from Model1/, python src/test_webcam.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
