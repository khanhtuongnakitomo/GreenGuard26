from __future__ import annotations

import hashlib
import json
import math
import re
import subprocess
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import onnxruntime as ort
import yaml

ROOT = Path(__file__).resolve().parents[1]
DETECTION_ROOT = ROOT.parents[1]
REPO_ROOT = DETECTION_ROOT.parents[0]
DEFAULT_CONFIG = ROOT / "config" / "m2v6_live_finetune.yaml"
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def utc_now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def read_json(path: Path, default: Any | None = None) -> Any:
    if not path.is_file():
        return {} if default is None else default
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, payload: Any) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    ensure_dir(path.parent)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, sort_keys=True) + "\n")


def sha256_file(path: Path, *, upper: bool = False) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    value = digest.hexdigest()
    return value.upper() if upper else value


def tree_hash(paths: list[Path], *, root: Path | None = None, upper: bool = False) -> str:
    digest = hashlib.sha256()
    ordered = sorted(path for path in paths if path.is_file())
    for path in ordered:
        rel = path.relative_to(root) if root else path
        digest.update(str(rel).replace("\\", "/").encode("utf-8"))
        digest.update(b"\0")
        digest.update(sha256_file(path).encode("ascii"))
        digest.update(b"\n")
    value = digest.hexdigest()
    return value.upper() if upper else value


def relative_posix(path: Path, root: Path) -> str:
    return str(path.relative_to(root)).replace("\\", "/")


def resolve_model2_path(rel: str | Path) -> Path:
    return (ROOT / Path(rel)).resolve()


def resolve_detection_path(rel: str | Path) -> Path:
    return (DETECTION_ROOT / Path(rel)).resolve()


def _format_templates(value: Any, mapping: dict[str, str]) -> Any:
    if isinstance(value, str):
        return value.format(**mapping)
    if isinstance(value, list):
        return [_format_templates(item, mapping) for item in value]
    if isinstance(value, dict):
        return {key: _format_templates(item, mapping) for key, item in value.items()}
    return value


def load_config(config_path: str | Path | None = None, run_name_override: str | None = None) -> dict[str, Any]:
    path = Path(config_path) if config_path else DEFAULT_CONFIG
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if run_name_override:
        raw = dict(raw)
        raw["run_name"] = run_name_override
    cfg = _format_templates(raw, {"run_name": raw["run_name"]})

    resolved = {
        "config_path": path.resolve(),
        "model2_root": ROOT,
        "detection_root": DETECTION_ROOT,
        "repo_root": REPO_ROOT,
        "paths": {key: resolve_model2_path(value) for key, value in cfg["paths"].items()},
        "review": {key: resolve_model2_path(value) for key, value in cfg["review"].items()},
        "baseline_checkpoint": resolve_model2_path(cfg["training"]["baseline_checkpoint"]),
        "promotion": {
            "pc_package_dir": resolve_detection_path(cfg["promotion"]["pc_package_dir"]),
            "jetson_package_dir": resolve_detection_path(cfg["promotion"]["jetson_package_dir"]),
            "pc_manifest": resolve_detection_path(cfg["promotion"]["pc_manifest"]),
            "jetson_manifest": resolve_detection_path(cfg["promotion"]["jetson_manifest"]),
            "jetson_engine": resolve_detection_path(cfg["promotion"]["jetson_engine"]),
            "jetson_engine_manifest": resolve_detection_path(cfg["promotion"]["jetson_engine_manifest"]),
            "model2_training_exports": {
                key: resolve_detection_path(value)
                for key, value in cfg["promotion"]["model2_training_exports"].items()
            },
        },
    }

    logs_root = resolved["paths"]["logs_root"]
    resolved["status_file"] = logs_root / "workflow_status.json"
    resolved["status_history"] = logs_root / "workflow_status_history.jsonl"
    resolved["workflow_log"] = logs_root / "workflow.log"
    resolved["reports_dir"] = logs_root / "reports"
    ensure_dir(logs_root)
    ensure_dir(resolved["reports_dir"])
    cfg["_resolved"] = resolved
    return cfg


def workflow_paths(cfg: dict[str, Any]) -> dict[str, Path]:
    return cfg["_resolved"]["paths"]


def report_path(cfg: dict[str, Any], name: str) -> Path:
    return cfg["_resolved"]["reports_dir"] / name


def log_event(cfg: dict[str, Any], message: str, *, status: str | None = None, **extra: Any) -> None:
    line = f"[{utc_now()}] {message}"
    ensure_dir(cfg["_resolved"]["workflow_log"].parent)
    with cfg["_resolved"]["workflow_log"].open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")
    payload = {"time": utc_now(), "message": message}
    payload.update(extra)
    append_jsonl(report_path(cfg, "events.jsonl"), payload)
    if status:
        write_status(cfg, status, message=message, **extra)


def write_status(cfg: dict[str, Any], status: str, **fields: Any) -> dict[str, Any]:
    path = cfg["_resolved"]["status_file"]
    current = read_json(path, default={})
    payload = {
        "run_name": cfg["run_name"],
        "status": status,
        "updated_at": utc_now(),
    }
    payload.update(current)
    payload.update(fields)
    payload["run_name"] = cfg["run_name"]
    payload["status"] = status
    payload["updated_at"] = utc_now()
    write_json(path, payload)
    append_jsonl(
        cfg["_resolved"]["status_history"],
        {"time": payload["updated_at"], "status": status, **fields},
    )
    return payload


def git_head() -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO_ROOT,
            text=True,
        ).strip()
    except Exception:
        return None


def git_branch() -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=REPO_ROOT,
            text=True,
        ).strip()
    except Exception:
        return None


def canonical_names(cfg: dict[str, Any]) -> list[str]:
    return list(cfg["canonical_names"])


def read_label_names(path: Path) -> list[str]:
    if not path.is_file():
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def verify_baseline_checkpoint(cfg: dict[str, Any]) -> tuple[bool, dict[str, Any]]:
    checkpoint = cfg["_resolved"]["baseline_checkpoint"]
    expected = str(cfg["training"]["baseline_sha256"]).upper()
    details = {
        "path": str(checkpoint),
        "expected_sha256": expected,
        "exists": checkpoint.is_file(),
    }
    if not checkpoint.is_file():
        details["actual_sha256"] = None
        return False, details
    actual = sha256_file(checkpoint, upper=True)
    details["actual_sha256"] = actual
    return actual == expected, details


def parse_label_line(line: str) -> tuple[int, np.ndarray]:
    parts = line.split()
    if len(parts) < 9 or len(parts) % 2 != 1:
        raise ValueError(f"invalid field count: {len(parts)}")
    raw_class = int(parts[0])
    values = [float(item) for item in parts[1:]]
    if len(values) % 2 != 0:
        raise ValueError("coordinate count must be even")
    points = np.asarray(values, dtype=np.float32).reshape(-1, 2)
    return raw_class, points


def polygon_area(points: np.ndarray) -> float:
    if len(points) < 3:
        return 0.0
    return float(abs(cv2.contourArea(points.astype(np.float32))))


def order_polygon(points: np.ndarray) -> np.ndarray:
    center = points.mean(axis=0)
    angles = np.arctan2(points[:, 1] - center[1], points[:, 0] - center[0])
    ordered = points[np.argsort(angles)]
    start = int(np.argmin(ordered.sum(axis=1)))
    return np.roll(ordered, -start, axis=0)


def quad_from_polygon(points: np.ndarray, width: int, height: int) -> np.ndarray:
    pts_px = np.column_stack([points[:, 0] * width, points[:, 1] * height]).astype(np.float32)
    rect = cv2.minAreaRect(pts_px)
    box = cv2.boxPoints(rect)
    norm = np.column_stack([box[:, 0] / width, box[:, 1] / height]).astype(np.float32)
    return order_polygon(norm)


def validate_points(
    points: np.ndarray,
    *,
    width: int,
    height: int,
    min_polygon_area_fraction: float,
    min_side_pixels: float,
) -> tuple[bool, str | None]:
    if not np.isfinite(points).all():
        return False, "non_finite_coordinate"
    if np.any(points < 0.0) or np.any(points > 1.0):
        return False, "coordinate_out_of_bounds"
    if len(points) < 4:
        return False, "too_few_points"

    area_fraction = polygon_area(points)
    if area_fraction < min_polygon_area_fraction:
        return False, "polygon_area_too_small"

    quad = quad_from_polygon(points, width, height)
    quad_px = np.column_stack([quad[:, 0] * width, quad[:, 1] * height]).astype(np.float32)
    rect = cv2.minAreaRect(quad_px)
    size = sorted(rect[1])
    if size[0] < min_side_pixels or size[1] < min_side_pixels:
        return False, "obb_side_too_small"
    if polygon_area(quad) <= 0.0:
        return False, "degenerate_obb"
    return True, None


def image_metrics(
    image: np.ndarray,
    *,
    dark_max: float,
    bright_min: float,
    highlight_threshold: int,
    moderate_min: float,
    severe_min: float,
) -> dict[str, Any]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    mean_luma = float(gray.mean())
    if mean_luma <= dark_max:
        lighting = "dark"
    elif mean_luma >= bright_min:
        lighting = "bright"
    else:
        lighting = "normal"
    highlight_ratio = float((gray >= highlight_threshold).mean())
    if highlight_ratio >= severe_min:
        highlight_bucket = "severe"
    elif highlight_ratio >= moderate_min:
        highlight_bucket = "moderate"
    else:
        highlight_bucket = "low"
    return {
        "mean_luma": round(mean_luma, 4),
        "lighting_bucket": lighting,
        "highlight_ratio": round(highlight_ratio, 6),
        "highlight_bucket": highlight_bucket,
    }


def annotation_orientation(points: np.ndarray, width: int, height: int) -> dict[str, Any]:
    if len(points) == 0:
        return {"orientation_bucket": "unknown", "pose_bucket": "unknown", "angle_degrees": None}
    pts_px = np.column_stack([points[:, 0] * width, points[:, 1] * height]).astype(np.float32)
    rect = cv2.minAreaRect(pts_px)
    w_px, h_px = rect[1]
    angle = float(rect[2])
    if w_px < h_px:
        angle += 90.0
    angle = ((angle + 90.0) % 180.0) - 90.0
    orientation = "horizontal" if abs(angle) <= 25.0 else "vertical"
    if angle <= -15.0:
        pose = "tilted_negative"
    elif angle >= 15.0:
        pose = "tilted_positive"
    else:
        pose = "tilted_neutral"
    return {
        "orientation_bucket": orientation,
        "pose_bucket": pose,
        "angle_degrees": round(angle, 4),
    }


TIMESTAMP_RE = re.compile(r"WIN_(\d{8})_(\d{2})_(\d{2})_(\d{2})_Pro", re.IGNORECASE)


def parse_capture_timestamp(name: str) -> datetime | None:
    match = TIMESTAMP_RE.search(name)
    if not match:
        return None
    date_text, hh, mm, ss = match.groups()
    return datetime.strptime(f"{date_text}{hh}{mm}{ss}", "%Y%m%d%H%M%S")


def phash(image: np.ndarray) -> int:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA)
    dct = cv2.dct(np.float32(resized))
    low = dct[:8, :8].flatten()
    median = float(np.median(low[1:]))
    bits = "".join("1" if value > median else "0" for value in low[1:])
    return int(bits, 2)


def hamming_distance(a: int, b: int) -> int:
    return int((a ^ b).bit_count())


def list_images(path: Path) -> list[Path]:
    if not path.is_dir():
        return []
    return sorted(item for item in path.iterdir() if item.suffix.lower() in IMG_EXTS)


def poly_iou(a: np.ndarray, b: np.ndarray) -> float:
    a32 = order_polygon(a.astype(np.float32))
    b32 = order_polygon(b.astype(np.float32))
    area_a = abs(cv2.contourArea(a32))
    area_b = abs(cv2.contourArea(b32))
    if area_a <= 0.0 or area_b <= 0.0:
        return 0.0
    ret, inter = cv2.intersectConvexConvex(a32, b32)
    if ret <= 0 or inter is None:
        return 0.0
    inter_area = abs(cv2.contourArea(inter.astype(np.float32)))
    return float(inter_area / (area_a + area_b - inter_area + 1e-6))


def onnx_meta(path: Path) -> dict[str, Any]:
    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    model_in = session.get_inputs()[0]
    model_out = session.get_outputs()[0]
    return {
        "input_name": model_in.name,
        "input_shape": list(model_in.shape),
        "output_name": model_out.name,
        "output_shape": list(model_out.shape),
    }


def class_presence(labels: list[int], names: list[str]) -> dict[str, int]:
    counts = Counter(names[label] for label in labels)
    return {name: int(counts.get(name, 0)) for name in names}
