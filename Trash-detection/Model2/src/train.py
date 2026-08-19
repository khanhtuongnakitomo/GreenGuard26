"""Train YOLO11n-OBB on the local cap/label dataset.

Run this yourself on the NVIDIA GPU. Do not start it from the Cursor agent:
training takes many minutes and would block the chat.

From Model2/:

    python src/train.py
    python src/train.py --epochs 50 --batch 16 --imgsz 640 --device 0

PowerShell:

    .\\train.ps1
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
os.chdir(REPO_ROOT)
Path(os.environ.setdefault("YOLO_CONFIG_DIR", str(REPO_ROOT / ".ultralytics"))).mkdir(parents=True, exist_ok=True)
Path(os.environ.setdefault("MPLCONFIGDIR", str(REPO_ROOT / ".matplotlib"))).mkdir(parents=True, exist_ok=True)


def parse_args():
    parser = argparse.ArgumentParser(description="Train GreenGuard Model 2 (cap + label OBB).")
    parser.add_argument("--data", default="configs/data.yaml", help="Dataset YAML relative to Model2/")
    parser.add_argument("--model", default="yolo11n-obb.pt", help="Base OBB model")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", default="0", help="GPU id, or cpu")
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--patience", type=int, default=20)
    parser.add_argument("--project", default="runs/obb")
    parser.add_argument("--name", default="cap_label_v1")
    parser.add_argument("--resume", action="store_true", help="Resume the last run with this name")
    parser.add_argument("--export-path", default="models/best.pt")
    return parser.parse_args()


def assert_dataset(data_yaml: Path):
    dataset_root = REPO_ROOT / "data" / "dataset-2"
    train_images = dataset_root / "train" / "images"
    val_images = dataset_root / "valid" / "images"
    if not data_yaml.exists():
        raise FileNotFoundError(f"Missing dataset config: {data_yaml}")
    if not train_images.exists() or not any(train_images.iterdir()):
        raise FileNotFoundError(f"No training images in {train_images}")
    if not val_images.exists() or not any(val_images.iterdir()):
        raise FileNotFoundError(f"No validation images in {val_images}")


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
    data_yaml = Path(args.data)
    if not data_yaml.is_absolute():
        data_yaml = REPO_ROOT / data_yaml

    assert_dataset(data_yaml)
    assert_device(args.device)

    from ultralytics import YOLO

    export_path = Path(args.export_path)
    if not export_path.is_absolute():
        export_path = REPO_ROOT / export_path
    export_path.parent.mkdir(parents=True, exist_ok=True)

    print("Starting Model 2 OBB training")
    print(f"  data:    {data_yaml}")
    print(f"  model:   {args.model}")
    print(f"  epochs:  {args.epochs}")
    print(f"  batch:   {args.batch}")
    print(f"  imgsz:   {args.imgsz}")
    print(f"  device:  {args.device}")
    print(f"  export:  {export_path}")

    model = YOLO(args.model)
    results = model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=args.workers,
        patience=args.patience,
        project=args.project,
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
    print("Next: python src/predict_folder.py")
    print("Then: from Model1/, python src/test_webcam.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
