"""Fine-tune Model 2 on live kiosk crops collected with REINFORCEMENT_LEARNING=on.

Run from Model2/:

    python src/finetune_live.py --epochs 3 --device 0
"""

from __future__ import annotations

import argparse
import os
import random
import shutil
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
os.chdir(REPO_ROOT)
Path(os.environ.setdefault("YOLO_CONFIG_DIR", str(REPO_ROOT / ".ultralytics"))).mkdir(parents=True, exist_ok=True)
Path(os.environ.setdefault("MPLCONFIGDIR", str(REPO_ROOT / ".matplotlib"))).mkdir(parents=True, exist_ok=True)

LIVE_ROOT = REPO_ROOT / "data" / "live"
SPLIT_ROOT = REPO_ROOT / "data" / "live_split"
WEIGHTS = REPO_ROOT / "models" / "best.pt"
RELOAD_FLAG = REPO_ROOT / "models" / "reload.flag"


def parse_args():
    parser = argparse.ArgumentParser(description="Fine-tune Model 2 on live PET crops.")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--device", default="0")
    parser.add_argument("--model", default=str(WEIGHTS))
    parser.add_argument("--export-path", default=str(WEIGHTS))
    return parser.parse_args()


def _stems():
    image_dir = LIVE_ROOT / "images"
    if not image_dir.exists():
        return []
    return sorted(path.stem for path in image_dir.glob("*.jpg"))


def _copy_split(stems, split_name):
    img_out = SPLIT_ROOT / split_name / "images"
    lbl_out = SPLIT_ROOT / split_name / "labels"
    img_out.mkdir(parents=True, exist_ok=True)
    lbl_out.mkdir(parents=True, exist_ok=True)
    for stem in stems:
        src_img = LIVE_ROOT / "images" / f"{stem}.jpg"
        src_lbl = LIVE_ROOT / "labels" / f"{stem}.txt"
        if src_img.exists():
            shutil.copy2(src_img, img_out / src_img.name)
        if src_lbl.exists():
            shutil.copy2(src_lbl, lbl_out / src_lbl.name)
        else:
            (lbl_out / f"{stem}.txt").write_text("", encoding="utf-8")


def prepare_split():
    stems = _stems()
    if len(stems) < 2:
        raise RuntimeError(f"Need at least 2 live samples in {LIVE_ROOT / 'images'}")

    random.Random(42).shuffle(stems)
    val_count = max(1, len(stems) // 5)
    val = stems[:val_count]
    train = stems[val_count:] or stems[:1]
    if SPLIT_ROOT.exists():
        shutil.rmtree(SPLIT_ROOT)
    _copy_split(train, "train")
    _copy_split(val, "valid")

    yaml_path = SPLIT_ROOT / "data.yaml"
    yaml_path.write_text(
        "\n".join(
            [
                f"path: {SPLIT_ROOT.as_posix()}",
                "train: train/images",
                "val: valid/images",
                "nc: 4",
                "names:",
                "  0: bottle",
                "  1: cap",
                "  2: label",
                "  3: liquid",
                "",
            ]
        ),
        encoding="utf-8",
    )
    return yaml_path


def main():
    args = parse_args()
    yaml_path = prepare_split()
    model_path = Path(args.model)
    if not model_path.is_absolute():
        model_path = REPO_ROOT / model_path
    if not model_path.exists():
        print(f"Missing base weights: {model_path}", file=sys.stderr)
        return 1

    from ultralytics import YOLO

    export_path = Path(args.export_path)
    if not export_path.is_absolute():
        export_path = REPO_ROOT / export_path

    print(f"Fine-tuning {model_path} on live crops for {args.epochs} epoch(s)")
    model = YOLO(str(model_path))
    results = model.train(
        data=str(yaml_path),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=0,
        patience=args.epochs,
        project="runs/obb",
        name="live_finetune",
        exist_ok=True,
        plots=False,
        verbose=True,
    )
    best_src = Path(results.save_dir) / "weights" / "best.pt"
    if not best_src.exists():
        print(f"Fine-tune finished but {best_src} missing", file=sys.stderr)
        return 1
    export_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_src, export_path)
    RELOAD_FLAG.write_text("reload\n", encoding="utf-8")
    print(f"Updated {export_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
