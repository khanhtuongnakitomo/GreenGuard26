"""Shared, conservative helpers for the Model 1 RVM fine-tune workflow."""

from __future__ import annotations

import hashlib
import json
import os
import random
import tempfile
from pathlib import Path
from typing import Any, Iterable

import cv2
import yaml


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
CLASS_NAMES = {0: "metal_can", 1: "pet_bottle", 2: "pp_cup"}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def model_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_config(path: Path | None = None) -> dict[str, Any]:
    path = path or model_root() / "config" / "m1_rvm_finetune.yaml"
    with path.open("r", encoding="utf-8") as handle:
        config = yaml.safe_load(handle) or {}
    names = config.get("classes", {}).get("names", {})
    normalized = {int(key): str(value) for key, value in names.items()}
    if normalized != CLASS_NAMES:
        raise ValueError(f"Model 1 class contract mismatch: {normalized!r}")
    return config


def run_id(config: dict[str, Any]) -> str:
    from datetime import datetime

    run = config["run"]
    return f"{run['id_prefix']}_{datetime.now().strftime(run['date_format'])}_seed{run['seed']}_n640"


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative_to_model(path: Path) -> str:
    return path.resolve().relative_to(model_root().resolve()).as_posix()


def atomic_json_dump(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def atomic_text_dump(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def image_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted(path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS)


def label_for_image(image: Path) -> Path:
    parts = list(image.parts)
    if "images" in parts:
        parts[parts.index("images")] = "labels"
        direct = Path(*parts).with_suffix(".txt")
        if direct.exists():
            return direct
        label_root = image.parent.parent / "labels"
        matches = sorted(label_root.rglob(f"{image.stem}.txt")) if label_root.exists() else []
        if matches:
            return matches[0]
        return direct
    return image.with_suffix(".txt")


def parse_label_line(line: str) -> dict[str, Any]:
    fields = line.strip().split()
    if not fields:
        raise ValueError("empty label line")
    try:
        class_id = int(fields[0])
        values = [float(value) for value in fields[1:]]
    except ValueError as exc:
        raise ValueError(f"non-numeric label line: {line!r}") from exc
    return {"class_id": class_id, "values": values, "field_count": len(fields)}


def inspect_label_file(path: Path) -> dict[str, Any]:
    lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    records: list[dict[str, Any]] = []
    formats: set[str] = set()
    errors: list[str] = []
    for line_number, line in enumerate(lines, 1):
        try:
            record = parse_label_line(line)
            records.append(record)
            if record["field_count"] == 5:
                formats.add("hbb_yolo_5")
            elif record["field_count"] == 9:
                formats.add("obb_yolo_9")
            else:
                formats.add(f"unknown_{record['field_count']}")
        except ValueError as exc:
            errors.append(f"line {line_number}: {exc}")
    return {"records": records, "formats": sorted(formats), "errors": errors, "line_count": len(lines)}


def image_size(path: Path) -> tuple[int, int]:
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"unable to decode image: {path}")
    height, width = image.shape[:2]
    return width, height


def validate_hbb_record(record: dict[str, Any]) -> str | None:
    if record.get("field_count") != 5:
        return "expected exactly 5 YOLO HBB fields"
    class_id = record.get("class_id")
    if class_id not in CLASS_NAMES:
        return f"class id {class_id!r} is not in Model 1 contract"
    values = record.get("values", [])
    if len(values) != 4 or any(value < 0 or value > 1 for value in values):
        return "normalized center/width/height values must be in [0, 1]"
    if values[2] <= 0 or values[3] <= 0:
        return "box width and height must be positive"
    return None


def seed_everything(seed: int) -> random.Random:
    random.seed(seed)
    try:
        import numpy as np

        np.random.seed(seed)
    except ImportError:
        pass
    return random.Random(seed)


def count_rows(records: Iterable[dict[str, Any]]) -> dict[str, int]:
    counts = {name: 0 for name in CLASS_NAMES.values()}
    for record in records:
        class_id = record.get("class_id")
        if class_id in CLASS_NAMES:
            counts[CLASS_NAMES[class_id]] += 1
    return counts
