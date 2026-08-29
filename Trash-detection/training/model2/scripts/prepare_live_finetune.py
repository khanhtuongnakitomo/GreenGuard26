from __future__ import annotations

import argparse
import csv
import json
import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from live_finetune_common import (
    IMG_EXTS,
    canonical_names,
    class_presence,
    ensure_dir,
    git_branch,
    git_head,
    hamming_distance,
    image_metrics,
    list_images,
    load_config,
    log_event,
    order_polygon,
    parse_capture_timestamp,
    parse_label_line,
    phash,
    quad_from_polygon,
    relative_posix,
    report_path,
    sha256_file,
    tree_hash,
    validate_points,
    verify_baseline_checkpoint,
    workflow_paths,
    write_json,
    write_status,
)


def generated_dirs(generated_root: Path) -> dict[str, Path]:
    return {
        "canonical_images": generated_root / "canonical" / "live_machine" / "images",
        "canonical_labels": generated_root / "canonical" / "live_machine" / "labels",
        "quarantine_images": generated_root / "quarantine" / "images",
        "quarantine_labels": generated_root / "quarantine" / "labels",
        "manifests": generated_root / "manifests",
        "live_train_images": generated_root / "splits" / "live" / "train" / "images",
        "live_train_labels": generated_root / "splits" / "live" / "train" / "labels",
        "live_val_images": generated_root / "splits" / "live" / "val" / "images",
        "live_val_labels": generated_root / "splits" / "live" / "val" / "labels",
        "live_holdout_images": generated_root / "splits" / "live" / "holdout" / "images",
        "live_holdout_labels": generated_root / "splits" / "live" / "holdout" / "labels",
        "replay_train_images": generated_root / "splits" / "replay" / "train" / "images",
        "replay_train_labels": generated_root / "splits" / "replay" / "train" / "labels",
        "merged_train_images": generated_root / "splits" / "merged" / "train" / "images",
        "merged_train_labels": generated_root / "splits" / "merged" / "train" / "labels",
        "merged_val_images": generated_root / "splits" / "merged" / "val" / "images",
        "merged_val_labels": generated_root / "splits" / "merged" / "val" / "labels",
        "merged_holdout_images": generated_root / "splits" / "merged" / "holdout" / "images",
        "merged_holdout_labels": generated_root / "splits" / "merged" / "holdout" / "labels",
        "clean_negative_images": generated_root / "surfaces" / "clean_negative" / "images",
        "clean_negative_labels": generated_root / "surfaces" / "clean_negative" / "labels",
        "gate_sequences": generated_root / "surfaces" / "gate_sequences",
    }


def reset_generated_root(generated_root: Path) -> None:
    intended = generated_root.parent.resolve()
    root = generated_root.resolve()
    if intended.name != "generated":
        raise RuntimeError(f"refusing to reset non-generated path: {intended}")
    if root.exists():
        shutil.rmtree(root)
    for path in generated_dirs(root).values():
        ensure_dir(path)


def load_reviewed_negative_set(path: Path) -> set[str]:
    if not path.is_file():
        return set()
    out: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#"):
            continue
        out.add(text)
    return out


def load_override_labels(path: Path) -> dict[str, Path]:
    if not path.is_dir():
        return {}
    return {item.name: item for item in path.rglob("*.txt")}


def write_label(path: Path, annotations: list[dict[str, Any]]) -> None:
    lines = []
    for ann in annotations:
        pts = np.asarray(ann["obb_polygon"], dtype=np.float32)
        flat = " ".join(f"{float(value):.6f}" for value in pts.reshape(-1))
        lines.append(f"{ann['canonical_class']} {flat}")
    path.write_text(("\n".join(lines) + "\n") if lines else "", encoding="utf-8")


def quarantine_sample(
    cfg: dict[str, Any],
    sample_name: str,
    image_path: Path,
    label_path: Path | None,
    reason: str,
    detail: str,
    dirs: dict[str, Path],
) -> dict[str, Any]:
    dst_image = dirs["quarantine_images"] / image_path.name
    shutil.copy2(image_path, dst_image)
    dst_label = None
    if label_path and label_path.is_file():
        dst_label = dirs["quarantine_labels"] / label_path.name
        shutil.copy2(label_path, dst_label)
    payload = {
        "image_name": sample_name,
        "reason": reason,
        "detail": detail,
        "source_image": str(image_path),
        "source_label": str(label_path) if label_path else None,
        "quarantine_image": str(dst_image),
        "quarantine_label": str(dst_label) if dst_label else None,
    }
    log_event(cfg, f"quarantined {sample_name}: {reason}", sample=sample_name, reason=reason)
    return payload


def canonicalize_sample(
    cfg: dict[str, Any],
    image_path: Path,
    dataset_root: Path,
    overrides: dict[str, Path],
    reviewed_negatives: set[str],
    dirs: dict[str, Path],
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    label_path = dataset_root / "labels" / f"{image_path.stem}.txt"
    override_path = overrides.get(f"{image_path.stem}.txt")
    effective_label = override_path or (label_path if label_path.is_file() else None)

    image = cv2.imread(str(image_path))
    if image is None:
        return None, quarantine_sample(
            cfg,
            image_path.name,
            image_path,
            effective_label,
            "image_read_failed",
            "OpenCV could not decode the image.",
            dirs,
        )

    height, width = image.shape[:2]
    cfg_dataset = cfg["dataset"]
    metrics = image_metrics(
        image,
        dark_max=float(cfg_dataset["lighting_thresholds"]["dark_max"]),
        bright_min=float(cfg_dataset["lighting_thresholds"]["bright_min"]),
        highlight_threshold=int(cfg_dataset["highlight_threshold"]),
        moderate_min=float(cfg_dataset["highlight_buckets"]["moderate_min"]),
        severe_min=float(cfg_dataset["highlight_buckets"]["severe_min"]),
    )

    if effective_label is None:
        if image_path.name in reviewed_negatives:
            annotations: list[dict[str, Any]] = []
            label_source = "reviewed_negative"
        else:
            return None, quarantine_sample(
                cfg,
                image_path.name,
                image_path,
                label_path,
                "missing_label",
                "No label file was found and the frame is not in the reviewed-negative allowlist.",
                dirs,
            )
    else:
        label_source = "authoritative_override" if override_path else "dataset_label"
        text = effective_label.read_text(encoding="utf-8").strip()
        annotations = []
        if text:
            for line_no, line in enumerate(text.splitlines(), start=1):
                try:
                    raw_class, points = parse_label_line(line)
                except Exception as exc:
                    return None, quarantine_sample(
                        cfg,
                        image_path.name,
                        image_path,
                        effective_label,
                        "invalid_label_format",
                        f"Line {line_no}: {exc}",
                        dirs,
                    )
                class_map = {int(k): int(v) for k, v in cfg_dataset["raw_class_to_canonical"].items()}
                if raw_class not in class_map:
                    return None, quarantine_sample(
                        cfg,
                        image_path.name,
                        image_path,
                        effective_label,
                        "unknown_raw_class",
                        f"Line {line_no}: raw class {raw_class} is not mapped.",
                        dirs,
                    )
                ok, error = validate_points(
                    points,
                    width=width,
                    height=height,
                    min_polygon_area_fraction=float(cfg_dataset["min_polygon_area_fraction"]),
                    min_side_pixels=float(cfg_dataset["min_side_pixels"]),
                )
                if not ok:
                    return None, quarantine_sample(
                        cfg,
                        image_path.name,
                        image_path,
                        effective_label,
                        error or "invalid_polygon",
                        f"Line {line_no}: validation failed.",
                        dirs,
                    )
                obb = order_polygon(points) if len(points) == 4 else quad_from_polygon(points, width, height)
                obb_ok, obb_error = validate_points(
                    obb,
                    width=width,
                    height=height,
                    min_polygon_area_fraction=float(cfg_dataset["min_obb_area_fraction"]),
                    min_side_pixels=float(cfg_dataset["min_side_pixels"]),
                )
                if not obb_ok:
                    return None, quarantine_sample(
                        cfg,
                        image_path.name,
                        image_path,
                        effective_label,
                        obb_error or "invalid_obb",
                        f"Line {line_no}: generated OBB validation failed.",
                        dirs,
                    )
                canonical_class = class_map[raw_class]
                annotations.append(
                    {
                        "raw_class": raw_class,
                        "canonical_class": canonical_class,
                        "canonical_name": cfg["canonical_names"][canonical_class],
                        "source_point_count": int(len(points)),
                        "source_polygon": np.asarray(points, dtype=np.float32).round(6).tolist(),
                        "obb_polygon": np.asarray(obb, dtype=np.float32).round(6).tolist(),
                        "source_area_fraction": round(float(abs(cv2.contourArea(points.astype(np.float32)))), 8),
                        "obb_area_fraction": round(float(abs(cv2.contourArea(obb.astype(np.float32)))), 8),
                    }
                )
        elif image_path.name not in reviewed_negatives:
            return None, quarantine_sample(
                cfg,
                image_path.name,
                image_path,
                effective_label,
                "empty_unreviewed_label",
                "The label file is empty and the frame is not reviewed as a true machine negative.",
                dirs,
            )

    sample = {
        "image_name": image_path.name,
        "image_stem": image_path.stem,
        "source_image": str(image_path),
        "source_label": str(label_path) if label_path.is_file() else None,
        "effective_label": str(effective_label) if effective_label else None,
        "label_source": label_source,
        "width": int(width),
        "height": int(height),
        "image_sha256": sha256_file(image_path, upper=True),
        "label_sha256": sha256_file(effective_label, upper=True) if effective_label else None,
        "annotations": annotations,
        "class_ids": sorted({ann["canonical_class"] for ann in annotations}),
        "class_presence": class_presence([ann["canonical_class"] for ann in annotations], cfg["canonical_names"]),
        "is_negative": not annotations,
        "reviewed_negative": image_path.name in reviewed_negatives,
        "timestamp": parse_capture_timestamp(image_path.stem).isoformat() if parse_capture_timestamp(image_path.stem) else None,
        "metrics": metrics,
        "phash": format(phash(image), "016x"),
    }
    all_points = []
    for ann in annotations:
        all_points.extend(ann["obb_polygon"])
    if all_points:
        pts = np.asarray(all_points, dtype=np.float32)
        from live_finetune_common import annotation_orientation

        sample["metrics"].update(annotation_orientation(pts, width, height))
    else:
        sample["metrics"].update(
            {"orientation_bucket": "unknown", "pose_bucket": "unknown", "angle_degrees": None}
        )

    canonical_image = dirs["canonical_images"] / image_path.name
    canonical_label = dirs["canonical_labels"] / f"{image_path.stem}.txt"
    shutil.copy2(image_path, canonical_image)
    write_label(canonical_label, annotations)
    sample["canonical_image"] = str(canonical_image)
    sample["canonical_label"] = str(canonical_label)
    return sample, None


def canonicalize_true_negative(
    cfg: dict[str, Any],
    image_path: Path,
    dirs: dict[str, Path],
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Import a reviewed empty-machine frame without touching the source folder."""
    image = cv2.imread(str(image_path))
    if image is None:
        return None, quarantine_sample(
            cfg,
            image_path.name,
            image_path,
            None,
            "image_read_failed",
            "OpenCV could not decode the reviewed true-negative image.",
            dirs,
        )
    cfg_dataset = cfg["dataset"]
    metrics = image_metrics(
        image,
        dark_max=float(cfg_dataset["lighting_thresholds"]["dark_max"]),
        bright_min=float(cfg_dataset["lighting_thresholds"]["bright_min"]),
        highlight_threshold=int(cfg_dataset["highlight_threshold"]),
        moderate_min=float(cfg_dataset["highlight_buckets"]["moderate_min"]),
        severe_min=float(cfg_dataset["highlight_buckets"]["severe_min"]),
    )
    sample = {
        "image_name": image_path.name,
        "image_stem": image_path.stem,
        "source_image": str(image_path),
        "source_label": None,
        "effective_label": None,
        "label_source": "reviewed_true_negative",
        "width": int(image.shape[1]),
        "height": int(image.shape[0]),
        "image_sha256": sha256_file(image_path, upper=True),
        "label_sha256": None,
        "annotations": [],
        "class_ids": [],
        "class_presence": class_presence([], cfg["canonical_names"]),
        "is_negative": True,
        "reviewed_negative": True,
        "timestamp": parse_capture_timestamp(image_path.stem).isoformat() if parse_capture_timestamp(image_path.stem) else None,
        "metrics": metrics,
        "phash": format(phash(image), "016x"),
        "origin": "reviewed_true_negative",
    }
    sample["metrics"].update({"orientation_bucket": "unknown", "pose_bucket": "unknown", "angle_degrees": None})
    canonical_image = dirs["canonical_images"] / ("tn_" + image_path.name)
    canonical_label = dirs["canonical_labels"] / ("tn_" + image_path.stem + ".txt")
    shutil.copy2(image_path, canonical_image)
    write_label(canonical_label, [])
    sample["canonical_image"] = str(canonical_image)
    sample["canonical_label"] = str(canonical_label)
    return sample, None


def build_groups(samples: list[dict[str, Any]], gap_seconds: int) -> list[dict[str, Any]]:
    ordered = sorted(
        samples,
        key=lambda item: (
            parse_capture_timestamp(item["image_stem"]) or parse_capture_timestamp(item["image_name"]) or item["image_name"],
            item["image_name"],
        ),
    )
    groups: list[dict[str, Any]] = []
    current: list[dict[str, Any]] = []
    last_ts = None
    group_id = 0
    for sample in ordered:
        ts = parse_capture_timestamp(sample["image_stem"]) or parse_capture_timestamp(sample["image_name"])
        start_new = False
        if not current:
            start_new = True
        elif ts is None or last_ts is None:
            start_new = True
        else:
            start_new = (ts - last_ts).total_seconds() > gap_seconds
        if start_new:
            if current:
                groups.append(summarize_group(group_id, current))
            group_id += 1
            current = [sample]
        else:
            current.append(sample)
        last_ts = ts
    if current:
        groups.append(summarize_group(group_id, current))
    return groups


def summarize_group(group_id: int, samples: list[dict[str, Any]]) -> dict[str, Any]:
    counters = {
        "class_presence": Counter(),
        "lighting": Counter(),
        "highlight": Counter(),
        "orientation": Counter(),
        "pose": Counter(),
    }
    negative_count = 0
    for sample in samples:
        for name, count in sample["class_presence"].items():
            if count > 0:
                counters["class_presence"][name] += 1
        counters["lighting"][sample["metrics"]["lighting_bucket"]] += 1
        counters["highlight"][sample["metrics"]["highlight_bucket"]] += 1
        counters["orientation"][sample["metrics"]["orientation_bucket"]] += 1
        counters["pose"][sample["metrics"]["pose_bucket"]] += 1
        if sample["is_negative"]:
            negative_count += 1
    return {
        "group_id": f"seq_{group_id:03d}",
        "image_count": len(samples),
        "sample_names": [sample["image_name"] for sample in samples],
        "samples": samples,
        "features": {key: dict(counter) for key, counter in counters.items()},
        "negative_count": negative_count,
    }


def build_overall_feature_totals(groups: list[dict[str, Any]]) -> dict[str, Counter]:
    totals = {
        "class_presence": Counter(),
        "lighting": Counter(),
        "highlight": Counter(),
        "orientation": Counter(),
        "pose": Counter(),
    }
    for group in groups:
        for key in totals:
            totals[key].update(group["features"][key])
    return totals


def empty_bucket() -> dict[str, Any]:
    return {
        "image_count": 0,
        "groups": [],
        "class_presence": Counter(),
        "lighting": Counter(),
        "highlight": Counter(),
        "orientation": Counter(),
        "pose": Counter(),
        "negative_count": 0,
    }


def add_group(bucket: dict[str, Any], group: dict[str, Any]) -> None:
    bucket["image_count"] += group["image_count"]
    bucket["groups"].append(group["group_id"])
    bucket["negative_count"] += group["negative_count"]
    for key in ("class_presence", "lighting", "highlight", "orientation", "pose"):
        bucket[key].update(group["features"][key])


def clone_buckets(buckets: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out = {}
    for name, bucket in buckets.items():
        out[name] = {
            "image_count": bucket["image_count"],
            "groups": list(bucket["groups"]),
            "class_presence": Counter(bucket["class_presence"]),
            "lighting": Counter(bucket["lighting"]),
            "highlight": Counter(bucket["highlight"]),
            "orientation": Counter(bucket["orientation"]),
            "pose": Counter(bucket["pose"]),
            "negative_count": bucket["negative_count"],
        }
    return out


def score_buckets(
    buckets: dict[str, dict[str, Any]],
    groups: list[dict[str, Any]],
    ratios: dict[str, float],
    names: list[str],
) -> float:
    total_images = sum(group["image_count"] for group in groups)
    totals = build_overall_feature_totals(groups)
    feature_weights = {
        "class_presence": 12.0,
        "lighting": 4.0,
        "highlight": 2.0,
        "orientation": 2.0,
        "pose": 1.5,
    }
    score = 0.0
    for split, bucket in buckets.items():
        target_images = total_images * ratios[split]
        score += abs(bucket["image_count"] - target_images) * 5.0
        for feature, weight in feature_weights.items():
            overall = totals[feature]
            for key, total_count in overall.items():
                target = total_count * ratios[split]
                score += weight * abs(bucket[feature].get(key, 0) - target) / max(total_count, 1)
    for split in ("val", "holdout"):
        for name in names:
            total_count = totals["class_presence"].get(name, 0)
            if total_count > 0 and buckets[split]["class_presence"].get(name, 0) == 0:
                score += 500.0
        for lighting_bucket in totals["lighting"]:
            if totals["lighting"][lighting_bucket] > 0 and buckets[split]["lighting"].get(lighting_bucket, 0) == 0:
                score += 150.0
    return score


def assign_splits(cfg: dict[str, Any], groups: list[dict[str, Any]]) -> dict[str, str]:
    ratios = {key: float(value) for key, value in cfg["dataset"]["split_ratios"].items()}
    total_images = sum(group["image_count"] for group in groups)
    if cfg["dataset"].get("split_strategy") == "balanced_search":
        return assign_balanced_splits(cfg, groups, ratios, total_images)
    assignment: dict[str, str] = {}
    targets = {split: total_images * ratios[split] for split in ("train", "val", "holdout")}
    counts = {split: 0 for split in targets}
    # Sequence groups are indivisible. Fill the largest remaining quota first,
    # which keeps the requested train/val/holdout proportions predictable even
    # when the capture timestamps produce hundreds of small groups.
    order = sorted(groups, key=lambda group: group["group_id"])
    for group in order:
        choice = max(
            ("train", "val", "holdout"),
            key=lambda split: (targets[split] - counts[split], split == "train"),
        )
        assignment[group["group_id"]] = choice
        counts[choice] += group["image_count"]
    return assignment


def assign_balanced_splits(
    cfg: dict[str, Any],
    groups: list[dict[str, Any]],
    ratios: dict[str, float],
    total_images: int,
) -> dict[str, str]:
    """Find a deterministic grouped split that covers scarce lighting/classes."""
    if not groups:
        return {}
    names = canonical_names(cfg)
    seed = int(cfg["training"].get("seed", 42))
    rng = random.Random(seed)
    ordered = sorted(groups, key=lambda group: group["group_id"])

    def score(assignment: dict[str, str]) -> float:
        buckets = {name: empty_bucket() for name in ("train", "val", "holdout")}
        for group in ordered:
            add_group(buckets[assignment[group["group_id"]]], group)
        return score_buckets(buckets, ordered, ratios, names)

    assignment = {}
    targets = {name: total_images * ratios[name] for name in ("train", "val", "holdout")}
    counts = {name: 0 for name in targets}
    for group in sorted(ordered, key=lambda item: (-item["image_count"], item["group_id"])):
        choice = min(
            ("train", "val", "holdout"),
            key=lambda name: (counts[name] - targets[name], name == "train"),
        )
        assignment[group["group_id"]] = choice
        counts[choice] += group["image_count"]

    best = dict(assignment)
    best_score = score(best)
    for _ in range(max(1000, len(ordered) * 100)):
        candidate = dict(best)
        group = rng.choice(ordered)
        current = candidate[group["group_id"]]
        alternatives = [name for name in ("train", "val", "holdout") if name != current]
        candidate[group["group_id"]] = rng.choice(alternatives)
        candidate_score = score(candidate)
        if candidate_score < best_score:
            best = candidate
            best_score = candidate_score
    return best


def copy_sample_to_split(sample: dict[str, Any], image_dir: Path, label_dir: Path, prefix: str = "") -> dict[str, Any]:
    name = prefix + sample["image_name"]
    label_name = prefix + sample["image_stem"] + ".txt"
    dst_image = image_dir / name
    dst_label = label_dir / label_name
    shutil.copy2(Path(sample["canonical_image"]), dst_image)
    shutil.copy2(Path(sample["canonical_label"]), dst_label)
    return {
        "image_name": name,
        "label_name": label_name,
        "source_image_name": sample["image_name"],
        "origin": sample.get("origin", "live_machine"),
        "is_negative": sample["is_negative"],
        "class_presence": sample["class_presence"],
    }


def alpha_blend(image: np.ndarray, overlay: np.ndarray, alpha: float) -> np.ndarray:
    return cv2.addWeighted(overlay, alpha, image, 1.0 - alpha, 0.0)


def apply_glare_variant(image: np.ndarray, rng: random.Random) -> tuple[np.ndarray, list[dict[str, Any]]]:
    height, width = image.shape[:2]
    out = image.astype(np.float32)
    gamma = 0.82 + (0.35 * rng.random())
    out = np.power(np.clip(out / 255.0, 0.0, 1.0), gamma) * 255.0
    gain = 0.92 + (0.22 * rng.random())
    bias = -6.0 + (18.0 * rng.random())
    out = np.clip((out * gain) + bias, 0.0, 255.0).astype(np.uint8)

    overlay = out.copy()
    center = (int(width * (0.30 + 0.40 * rng.random())), int(height * (0.20 + 0.35 * rng.random())))
    axes = (int(width * (0.12 + 0.14 * rng.random())), int(height * (0.06 + 0.12 * rng.random())))
    angle = -35.0 + (70.0 * rng.random())
    cv2.ellipse(overlay, center, axes, angle, 0, 360, (255, 255, 255), -1, lineType=cv2.LINE_AA)
    alpha = 0.06 + (0.08 * rng.random())
    out = alpha_blend(out, overlay, alpha)
    return out, [
        {"type": "gamma", "value": round(gamma, 6)},
        {"type": "gain", "value": round(gain, 6)},
        {"type": "bias", "value": round(bias, 6)},
        {"type": "glare", "center": center, "axes": axes, "angle": round(angle, 4), "alpha": round(alpha, 6)},
    ]


def warp_points(points: np.ndarray, matrix: np.ndarray, width: int, height: int) -> np.ndarray:
    pts_px = np.column_stack([points[:, 0] * width, points[:, 1] * height, np.ones(len(points), dtype=np.float32)])
    warped = (matrix @ pts_px.T).T
    return np.column_stack([warped[:, 0] / width, warped[:, 1] / height]).astype(np.float32)


def apply_motion_blur(image: np.ndarray, kernel_size: int, horizontal: bool) -> np.ndarray:
    kernel = np.zeros((kernel_size, kernel_size), dtype=np.float32)
    if horizontal:
        kernel[kernel_size // 2, :] = 1.0
    else:
        kernel[:, kernel_size // 2] = 1.0
    kernel /= kernel.sum()
    return cv2.filter2D(image, -1, kernel)


def apply_noise_variant(
    cfg: dict[str, Any],
    sample: dict[str, Any],
    rng: random.Random,
) -> tuple[np.ndarray, list[dict[str, Any]], list[dict[str, Any]]]:
    image = cv2.imread(sample["canonical_image"])
    assert image is not None
    height, width = image.shape[:2]
    angle = -3.0 + (6.0 * rng.random())
    scale = 0.985 + (0.03 * rng.random())
    tx = (-0.015 + (0.03 * rng.random())) * width
    ty = (-0.015 + (0.03 * rng.random())) * height
    matrix = cv2.getRotationMatrix2D((width / 2.0, height / 2.0), angle, scale)
    matrix[:, 2] += np.asarray([tx, ty], dtype=np.float32)

    transformed_annotations = []
    for ann in sample["annotations"]:
        warped = warp_points(np.asarray(ann["obb_polygon"], dtype=np.float32), matrix, width, height)
        ok, error = validate_points(
            warped,
            width=width,
            height=height,
            min_polygon_area_fraction=float(cfg["dataset"]["min_obb_area_fraction"]),
            min_side_pixels=float(cfg["dataset"]["min_side_pixels"]),
        )
        if not ok:
            raise ValueError(error or "augmented_obb_invalid")
        updated = dict(ann)
        updated["obb_polygon"] = warped.round(6).tolist()
        transformed_annotations.append(updated)

    warped_image = cv2.warpAffine(image, matrix, (width, height), flags=cv2.INTER_LINEAR, borderValue=(114, 114, 114))
    sigma = 2.0 + (4.0 * rng.random())
    noise = rng.normalvariate(0.0, sigma)
    noise_map = np.random.default_rng(rng.randint(0, 2**31 - 1)).normal(0.0, sigma, warped_image.shape)
    noisy = np.clip(warped_image.astype(np.float32) + noise_map, 0.0, 255.0).astype(np.uint8)
    blurred = apply_motion_blur(noisy, kernel_size=3 if rng.random() < 0.5 else 5, horizontal=rng.random() < 0.5)
    quality = int(70 + rng.random() * 18)
    ok, encoded = cv2.imencode(".jpg", blurred, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise ValueError("jpeg_encode_failed")
    decoded = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if decoded is None:
        raise ValueError("jpeg_decode_failed")
    return decoded, transformed_annotations, [
        {"type": "affine", "angle": round(angle, 6), "scale": round(scale, 6), "tx": round(tx, 6), "ty": round(ty, 6)},
        {"type": "noise", "sigma": round(sigma, 6), "offset_hint": round(noise, 6)},
        {"type": "jpeg", "quality": quality},
    ]


def write_augmented_sample(
    cfg: dict[str, Any],
    sample: dict[str, Any],
    variant_id: int,
    merged_image_dir: Path,
    merged_label_dir: Path,
) -> dict[str, Any] | None:
    rng = random.Random(f"{cfg['run_name']}::{sample['image_name']}::{variant_id}")
    try:
        if variant_id % 2 == 1:
            image = cv2.imread(sample["canonical_image"])
            assert image is not None
            aug_image, transforms = apply_glare_variant(image, rng)
            annotations = sample["annotations"]
        else:
            aug_image, annotations, transforms = apply_noise_variant(cfg, sample, rng)
        image_name = f"{sample['image_stem']}_live_aug{variant_id}.jpg"
        label_name = f"{sample['image_stem']}_live_aug{variant_id}.txt"
        image_path = merged_image_dir / image_name
        label_path = merged_label_dir / label_name
        cv2.imwrite(str(image_path), aug_image)
        write_label(label_path, annotations)
        return {
            "image_name": image_name,
            "label_name": label_name,
            "origin": "live_machine_augmented",
            "parent_image_name": sample["image_name"],
            "variant_id": variant_id,
            "transforms": transforms,
            "is_negative": sample["is_negative"],
            "class_presence": sample["class_presence"],
        }
    except Exception as exc:
        log_event(cfg, f"augmentation skipped for {sample['image_name']} variant {variant_id}: {exc}")
        return None


def apply_legacy_machine_style(image: np.ndarray, rng: random.Random) -> tuple[np.ndarray, list[dict[str, Any]]]:
    """Add bounded camera-domain appearance variation to legacy replay images."""
    out = image.astype(np.float32)
    gamma = 0.70 + (0.55 * rng.random())
    gain = 0.86 + (0.34 * rng.random())
    bias = -18.0 + (36.0 * rng.random())
    out = np.power(np.clip(out / 255.0, 0.0, 1.0), gamma) * 255.0
    out = np.clip(out * gain + bias, 0.0, 255.0).astype(np.uint8)

    if rng.random() < 0.65:
        height, width = out.shape[:2]
        overlay = out.copy()
        center = (int(width * (0.45 + 0.40 * rng.random())), int(height * (0.15 + 0.55 * rng.random())))
        axes = (int(width * (0.08 + 0.18 * rng.random())), int(height * (0.04 + 0.12 * rng.random())))
        cv2.ellipse(overlay, center, axes, -40.0 + 80.0 * rng.random(), 0, 360, (255, 255, 255), -1)
        out = alpha_blend(out, overlay, 0.04 + 0.12 * rng.random())
    if rng.random() < 0.60:
        sigma = 2.0 + 8.0 * rng.random()
        noise = np.random.default_rng(rng.randint(0, 2**31 - 1)).normal(0.0, sigma, out.shape)
        out = np.clip(out.astype(np.float32) + noise, 0.0, 255.0).astype(np.uint8)
    quality = int(58 + 27 * rng.random())
    ok, encoded = cv2.imencode(".jpg", out, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if ok:
        decoded = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
        if decoded is not None:
            out = decoded
    return out, [
        {"type": "legacy_machine_style", "gamma": round(gamma, 6), "gain": round(gain, 6), "bias": round(bias, 6)},
        {"type": "jpeg", "quality": quality},
    ]


def write_legacy_machine_variant(
    cfg: dict[str, Any],
    item: dict[str, Any],
    variant_id: int,
    image_dir: Path,
    label_dir: Path,
) -> dict[str, Any] | None:
    image = cv2.imread(str(item["image_path"]))
    if image is None:
        return None
    rng = random.Random(f"{cfg['run_name']}::legacy::{item['image_name']}::{variant_id}")
    out, transforms = apply_legacy_machine_style(image, rng)
    image_name = f"legacy_{item['image_name']}.jpg"
    label_name = f"legacy_{item['label_name']}"
    cv2.imwrite(str(image_dir / image_name), out)
    shutil.copy2(item["label_path"], label_dir / label_name)
    return {
        "image_name": image_name,
        "label_name": label_name,
        "origin": "legacy_machine_augmented",
        "parent_image_name": item["image_name"],
        "variant_id": variant_id,
        "transforms": transforms,
        "is_negative": item["is_negative"],
        "class_presence": item["class_presence"],
        "split": "train",
    }


def live_variant_count(cfg: dict[str, Any], sample: dict[str, Any]) -> int:
    configured = cfg["dataset"].get("live_aug_variants_by_class")
    if not configured:
        return int(cfg["dataset"].get("max_live_aug_variants_per_image", 2))
    counts = [int(configured.get(name, 0)) for name, present in sample["class_presence"].items() if present]
    if not counts:
        return int(configured.get("default", 2))
    return max(counts)


def write_true_negative_variant(
    cfg: dict[str, Any],
    sample: dict[str, Any],
    variant_id: int,
    merged_image_dir: Path,
    merged_label_dir: Path,
) -> dict[str, Any] | None:
    """Create photometric-only variants; geometry is fixed because the camera is fixed."""
    rng = random.Random(f"{cfg['run_name']}::true-negative::{sample['image_name']}::{variant_id}")
    image = cv2.imread(sample["canonical_image"])
    if image is None:
        return None
    out = image.astype(np.float32)
    gamma = 0.88 + (0.28 * rng.random())
    gain = 0.94 + (0.16 * rng.random())
    bias = -8.0 + (16.0 * rng.random())
    out = np.power(np.clip(out / 255.0, 0.0, 1.0), gamma) * 255.0
    out = np.clip((out * gain) + bias, 0.0, 255.0).astype(np.uint8)
    image_name = f"{sample['image_stem']}_tn_aug{variant_id}.jpg"
    label_name = f"{sample['image_stem']}_tn_aug{variant_id}.txt"
    image_path = merged_image_dir / image_name
    label_path = merged_label_dir / label_name
    cv2.imwrite(str(image_path), out)
    write_label(label_path, [])
    return {
        "image_name": image_name,
        "label_name": label_name,
        "origin": "reviewed_true_negative_augmented",
        "parent_image_name": sample["image_name"],
        "variant_id": variant_id,
        "transforms": [{"type": "photometric", "gamma": round(gamma, 6), "gain": round(gain, 6), "bias": round(bias, 6)}],
        "is_negative": True,
        "class_presence": sample["class_presence"],
    }


def replay_records(legacy_train_root: Path, names: list[str]) -> list[dict[str, Any]]:
    image_dir = legacy_train_root / "images"
    label_dir = legacy_train_root / "labels"
    records = []
    for image_path in list_images(image_dir):
        label_path = label_dir / f"{image_path.stem}.txt"
        labels = []
        if label_path.is_file():
            for line in label_path.read_text(encoding="utf-8").splitlines():
                text = line.strip()
                if not text:
                    continue
                try:
                    labels.append(int(text.split()[0]))
                except Exception:
                    pass
        presence = class_presence(labels, names)
        records.append(
            {
                "image_path": image_path,
                "label_path": label_path,
                "image_name": image_path.name,
                "label_name": label_path.name,
                "is_negative": sum(presence.values()) == 0,
                "class_presence": presence,
            }
        )
    return records


def select_replay(records: list[dict[str, Any]], target_count: int, seed: int, names: list[str]) -> list[dict[str, Any]]:
    if target_count <= 0 or not records:
        return []
    negatives = [item for item in records if item["is_negative"]]
    positives = [item for item in records if not item["is_negative"]]
    rng = random.Random(seed)
    neg_limit = min(len(negatives), max(1, round(target_count * 0.12))) if negatives else 0
    chosen = sorted(negatives, key=lambda item: item["image_name"])[:neg_limit]
    remaining = max(0, target_count - len(chosen))
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in positives:
        key = "+".join(name for name in names if item["class_presence"].get(name, 0) > 0) or "none"
        buckets[key].append(item)
    for bucket in buckets.values():
        bucket.sort(key=lambda item: item["image_name"])
    keys = sorted(buckets)
    idx = 0
    while remaining > 0 and keys:
        key = keys[idx % len(keys)]
        bucket = buckets[key]
        if bucket:
            chosen.append(bucket.pop(0))
            remaining -= 1
        if not bucket:
            keys.remove(key)
            idx -= 1
        idx += 1
    if remaining > 0:
        leftovers = [item for item in positives if item not in chosen]
        leftovers.sort(key=lambda item: item["image_name"])
        chosen.extend(leftovers[:remaining])
    rng.shuffle(chosen)
    return sorted(chosen[:target_count], key=lambda item: item["image_name"])


def write_yaml_surfaces(cfg: dict[str, Any], generated_root: Path) -> None:
    names = {idx: name for idx, name in enumerate(cfg["canonical_names"])}
    surfaces = {
        "dataset.yaml": generated_root / "splits" / "merged",
        "live_val.yaml": generated_root / "splits" / "live" / "val",
        "live_holdout.yaml": generated_root / "splits" / "live" / "holdout",
        "clean_negative.yaml": generated_root / "surfaces" / "clean_negative",
    }
    for filename, split_root in surfaces.items():
        payload = {
            "path": str(generated_root.resolve()),
            "train": relative_posix(split_root / "images", generated_root),
            "val": relative_posix(split_root / "images", generated_root),
            "test": relative_posix(split_root / "images", generated_root),
            "names": names,
        }
        if filename == "dataset.yaml":
            payload["train"] = "splits/merged/train/images"
            payload["val"] = "splits/merged/val/images"
            payload["test"] = "splits/merged/holdout/images"
        write_json(generated_root / filename.replace(".yaml", ".json"), payload)
        (generated_root / filename).write_text(
            "path: " + str(generated_root.resolve()) + "\n"
            + "train: " + payload["train"] + "\n"
            + "val: " + payload["val"] + "\n"
            + "test: " + payload["test"] + "\n"
            + "names:\n"
            + "".join(f"  {idx}: {name}\n" for idx, name in names.items()),
            encoding="utf-8",
        )


def sequence_reports(groups: list[dict[str, Any]], assignment: dict[str, str], gate_dir: Path) -> list[dict[str, Any]]:
    reports = []
    ensure_dir(gate_dir)
    for group in groups:
        split = assignment[group["group_id"]]
        sequence = {
            "group_id": group["group_id"],
            "split": split,
            "expected_positive_sequence": any(not sample["is_negative"] for sample in group["samples"]),
            "frames": [
                {
                    "image_name": sample["image_name"],
                    "timestamp": sample["timestamp"],
                    "expected_violation": not sample["is_negative"],
                    "class_presence": sample["class_presence"],
                }
                for sample in sorted(group["samples"], key=lambda item: item["image_name"])
            ],
        }
        out_dir = ensure_dir(gate_dir / split)
        out_path = out_dir / f"{group['group_id']}.json"
        write_json(out_path, sequence)
        reports.append({"group_id": group["group_id"], "split": split, "path": str(out_path)})
    return reports


def write_manifest_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    ensure_dir(path.parent)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    fieldnames = sorted({key for row in rows for key in row.keys()})
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=None)
    parser.add_argument("--run", default=None)
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()

    cfg = load_config(args.config, run_name_override=args.run)
    paths = workflow_paths(cfg)
    generated_root = paths["generated_root"]
    dataset_root = paths["incoming_live_dataset"]
    true_negative_root = paths["incoming_true_negative_dataset"]
    write_status(cfg, "VALIDATING", step="prepare")

    baseline_ok, baseline_details = verify_baseline_checkpoint(cfg)
    if not baseline_ok:
        write_json(report_path(cfg, "prepare_failure.json"), {"baseline": baseline_details})
        write_status(cfg, "CRASHED", step="prepare", detail="baseline checkpoint missing or hash mismatch")
        return 1

    if not (dataset_root / "image").is_dir() or not (dataset_root / "labels").is_dir():
        write_status(cfg, "CRASHED", step="prepare", detail="incoming live dataset is missing image/ or labels/")
        return 1
    if not true_negative_root.is_dir():
        write_status(cfg, "CRASHED", step="prepare", detail="incoming true-negative dataset is missing")
        return 1

    reset_generated_root(generated_root)
    dirs = generated_dirs(generated_root)
    reviewed_negatives = load_reviewed_negative_set(cfg["_resolved"]["review"]["reviewed_negative_list"])
    overrides = load_override_labels(cfg["_resolved"]["review"]["authoritative_overrides_dir"])

    live_images = list_images(dataset_root / "image")
    true_negative_images = list_images(true_negative_root)
    live_files_for_hash = live_images + sorted((dataset_root / "labels").glob("*.txt")) + [dataset_root / "data.yaml"]
    true_negative_files_for_hash = true_negative_images

    kept_samples = []
    quarantine = []
    for image_path in live_images:
        sample, issue = canonicalize_sample(cfg, image_path, dataset_root, overrides, reviewed_negatives, dirs)
        if sample is not None:
            kept_samples.append(sample)
        if issue is not None:
            quarantine.append(issue)

    true_negative_samples = []
    true_negative_quarantine = []
    for image_path in true_negative_images:
        sample, issue = canonicalize_true_negative(cfg, image_path, dirs)
        if sample is not None:
            true_negative_samples.append(sample)
        if issue is not None:
            true_negative_quarantine.append(issue)

    if not kept_samples:
        write_json(report_path(cfg, "prepare_failure.json"), {"reason": "no_trainable_live_samples"})
        write_status(cfg, "CRASHED", step="prepare", detail="no trainable live samples remained after quarantine")
        return 1

    negative_groups = build_groups(true_negative_samples, int(cfg["dataset"]["sequence_gap_seconds"]))
    negative_assignment = {}
    if negative_groups:
        ordered_negative_groups = sorted(negative_groups, key=lambda group: group["group_id"])
        holdout_group_id = ordered_negative_groups[0]["group_id"]
        negative_assignment = {
            group["group_id"]: ("holdout" if group["group_id"] == holdout_group_id else "train")
            for group in ordered_negative_groups
        }
    true_negative_train_rows = []
    true_negative_augmented_rows = []
    for group in negative_groups:
        split = negative_assignment[group["group_id"]]
        for sample in group["samples"]:
            sample["negative_split"] = split
            if split == "holdout":
                copy_sample_to_split(sample, dirs["clean_negative_images"], dirs["clean_negative_labels"], prefix="")
            else:
                true_negative_train_rows.append(
                    copy_sample_to_split(sample, dirs["merged_train_images"], dirs["merged_train_labels"], prefix="tn_")
                )
                for variant_id in (1, 2):
                    item = write_true_negative_variant(
                        cfg, sample, variant_id, dirs["merged_train_images"], dirs["merged_train_labels"]
                    )
                    if item is not None:
                        true_negative_augmented_rows.append(item)

    gap_seconds = int(cfg["dataset"]["sequence_gap_seconds"])
    groups = build_groups(kept_samples, gap_seconds)
    assignment = assign_splits(cfg, groups)

    sample_by_name = {sample["image_name"]: sample for sample in kept_samples}
    live_split_counts = Counter()
    split_group_ids: dict[str, list[str]] = defaultdict(list)
    for group in groups:
        split = assignment[group["group_id"]]
        split_group_ids[split].append(group["group_id"])
        for sample in group["samples"]:
            sample["live_split"] = split
            live_split_counts[split] += 1
            sample["origin"] = "live_machine"
            if split == "train":
                copy_sample_to_split(sample, dirs["live_train_images"], dirs["live_train_labels"])
                copy_sample_to_split(sample, dirs["merged_train_images"], dirs["merged_train_labels"])
            elif split == "val":
                copy_sample_to_split(sample, dirs["live_val_images"], dirs["live_val_labels"])
                copy_sample_to_split(sample, dirs["merged_val_images"], dirs["merged_val_labels"])
            else:
                copy_sample_to_split(sample, dirs["live_holdout_images"], dirs["live_holdout_labels"])
                copy_sample_to_split(sample, dirs["merged_holdout_images"], dirs["merged_holdout_labels"])
            if sample["is_negative"] and sample["reviewed_negative"]:
                copy_sample_to_split(sample, dirs["clean_negative_images"], dirs["clean_negative_labels"])

    augmented_rows = []
    train_samples = [sample for sample in kept_samples if sample["live_split"] == "train"]
    for sample in train_samples:
        for variant_id in range(1, live_variant_count(cfg, sample) + 1):
            item = write_augmented_sample(cfg, sample, variant_id, dirs["merged_train_images"], dirs["merged_train_labels"])
            if item is not None:
                augmented_rows.append(item)

    replay_source = paths["legacy_replay_train"]
    replay_pool = replay_records(replay_source, cfg["canonical_names"])
    live_train_total = len(train_samples) + len(augmented_rows)
    replay_target = int(round(live_train_total * float(cfg["dataset"]["legacy_replay_ratio"])))
    replay_selected = select_replay(replay_pool, replay_target, int(cfg["training"]["seed"]), cfg["canonical_names"])
    replay_rows = []
    replay_augmented_rows = []
    legacy_variant_count = int(cfg["dataset"].get("legacy_domain_variant_count", 0))
    for item in replay_selected:
        image_name = f"replay_{item['image_name']}"
        label_name = f"replay_{item['label_name']}"
        dst_image = dirs["replay_train_images"] / image_name
        dst_label = dirs["replay_train_labels"] / label_name
        dst_image_merged = dirs["merged_train_images"] / image_name
        dst_label_merged = dirs["merged_train_labels"] / label_name
        shutil.copy2(item["image_path"], dst_image)
        shutil.copy2(item["label_path"], dst_label)
        shutil.copy2(item["image_path"], dst_image_merged)
        shutil.copy2(item["label_path"], dst_label_merged)
        replay_rows.append(
            {
                "image_name": image_name,
                "label_name": label_name,
                "origin": "legacy_v6_replay",
                "parent_image_name": item["image_name"],
                "is_negative": item["is_negative"],
                "class_presence": item["class_presence"],
                "split": "train",
            }
        )
        for variant_id in range(1, legacy_variant_count + 1):
            variant = write_legacy_machine_variant(
                cfg,
                item,
                variant_id,
                dirs["replay_train_images"],
                dirs["replay_train_labels"],
            )
            if variant is not None:
                shutil.copy2(dirs["replay_train_images"] / variant["image_name"], dirs["merged_train_images"] / variant["image_name"])
                shutil.copy2(dirs["replay_train_labels"] / variant["label_name"], dirs["merged_train_labels"] / variant["label_name"])
                replay_augmented_rows.append(variant)

    write_yaml_surfaces(cfg, generated_root)
    gate_sequences = sequence_reports(groups, assignment, dirs["gate_sequences"])

    phash_pairs = []
    time_sorted = sorted(kept_samples, key=lambda item: item["image_name"])
    for left, right in zip(time_sorted, time_sorted[1:]):
        distance = hamming_distance(int(left["phash"], 16), int(right["phash"], 16))
        if distance <= int(cfg["dataset"]["similarity_warning_hamming"]):
            phash_pairs.append({"left": left["image_name"], "right": right["image_name"], "distance": distance})

    kept_samples.sort(key=lambda item: item["image_name"])
    write_json(dirs["manifests"] / "live_samples.json", kept_samples)
    write_json(dirs["manifests"] / "true_negative_samples.json", true_negative_samples)
    write_json(dirs["manifests"] / "true_negative_groups.json", [
        {"group_id": group["group_id"], "split": negative_assignment[group["group_id"]], "sample_names": group["sample_names"], "features": group["features"]}
        for group in negative_groups
    ])
    write_json(dirs["manifests"] / "quarantine.json", quarantine)
    write_json(dirs["manifests"] / "gate_sequences.json", gate_sequences)
    write_manifest_csv(
        dirs["manifests"] / "train_manifest.csv",
        [
            {"origin": "live_machine", "image_name": sample["image_name"], "split": sample["live_split"], "is_negative": sample["is_negative"]}
            for sample in kept_samples
        ]
        + augmented_rows
        + true_negative_train_rows
        + true_negative_augmented_rows
        + replay_rows
        + replay_augmented_rows,
    )

    reviewed_negative_count = sum(1 for sample in kept_samples if sample["reviewed_negative"] and sample["is_negative"])
    true_negative_count = len(true_negative_samples)
    total_machine_negative_count = reviewed_negative_count + true_negative_count
    unresolved_labels = [item for item in quarantine if item["reason"] in {"missing_label", "empty_unreviewed_label"}]
    promotion_prereq_failures = []
    if unresolved_labels:
        promotion_prereq_failures.append("unresolved_live_annotations")
    min_neg = int(cfg["dataset"]["required_machine_negative_min"])
    if total_machine_negative_count < min_neg:
        promotion_prereq_failures.append("insufficient_reviewed_machine_negatives")
    required_groups = int(cfg["dataset"].get("required_machine_negative_groups", 2))
    if len(negative_groups) < required_groups:
        promotion_prereq_failures.append("insufficient_true_negative_capture_groups")
    lighting_buckets = Counter(sample["metrics"]["lighting_bucket"] for sample in true_negative_samples)
    if "dark" not in lighting_buckets or not ({"bright", "normal"} & set(lighting_buckets)):
        promotion_prereq_failures.append("true_negative_lighting_coverage_incomplete")

    report = {
        "run_name": cfg["run_name"],
        "prepared_at": json.loads(json.dumps(write_status(cfg, "VALIDATING", step="prepare-report")))["updated_at"],
        "git_branch": git_branch(),
        "git_head": git_head(),
        "baseline_checkpoint": baseline_details,
        "dataset_source_hash": tree_hash(live_files_for_hash, root=dataset_root, upper=True),
        "true_negative_source_hash": tree_hash(true_negative_files_for_hash, root=true_negative_root, upper=True),
        "ignored_inputs": ["train.txt", "GreenGuard.zip"],
        "live_dataset": {
            "source_root": str(dataset_root),
            "total_images": len(live_images),
            "kept_images": len(kept_samples),
            "quarantined_images": len(quarantine),
            "reviewed_machine_negative_count": reviewed_negative_count,
            "split_counts": dict(live_split_counts),
            "group_counts": {split: len(ids) for split, ids in split_group_ids.items()},
            "sequence_gap_seconds": gap_seconds,
            "phash_similarity_warnings": phash_pairs,
        },
        "true_negative_dataset": {
            "source_root": str(true_negative_root),
            "total_images": len(true_negative_images),
            "kept_images": true_negative_count,
            "quarantined_images": len(true_negative_quarantine),
            "capture_group_count": len(negative_groups),
            "lighting_buckets": dict(lighting_buckets),
            "groups": [
                {"group_id": group["group_id"], "split": negative_assignment[group["group_id"]], "sample_names": group["sample_names"]}
                for group in negative_groups
            ],
            "holdout_policy": "earliest capture group is locked clean-negative holdout; later groups train",
            "photometric_augmented_train_count": len(true_negative_augmented_rows),
        },
        "train_surface": {
            "live_train_originals": len(train_samples),
            "live_train_augmented": len(augmented_rows),
            "legacy_replay_selected": len(replay_rows),
            "legacy_replay_target": replay_target,
            "legacy_replay_augmented": len(replay_augmented_rows),
        },
        "quarantine": quarantine + true_negative_quarantine,
        "promotion_prereq_failures": promotion_prereq_failures,
        "promotion_ready_from_data": not promotion_prereq_failures,
        "generated_root": str(generated_root),
        "dataset_yaml": str(generated_root / "dataset.yaml"),
        "live_val_yaml": str(generated_root / "live_val.yaml"),
        "live_holdout_yaml": str(generated_root / "live_holdout.yaml"),
        "clean_negative_yaml": str(generated_root / "clean_negative.yaml"),
    }
    write_json(report_path(cfg, "prepare_report.json"), report)
    log_event(cfg, "prepared live fine-tune dataset", status="VALIDATING", kept=len(kept_samples), quarantined=len(quarantine))
    if args.preflight_only:
        write_status(cfg, "STOPPED", step="prepare", detail="preflight-only dataset preparation completed")
    else:
        write_status(cfg, "STOPPED", step="prepare", detail="dataset preparation completed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
