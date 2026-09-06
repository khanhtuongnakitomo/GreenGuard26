"""Camera-only Model 1 evidence collector.

This module intentionally has no serial-controller import.  It records the
candidate detections and the public decision made by the canonical PC M1
pipeline without changing the kiosk result type or routing behavior.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import cv2

SRC = Path(__file__).resolve().parent
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from config_loader import ROOT, load_config, load_manifest, resolve_path, validate_manifest  # noqa: E402
from pipeline import M1DetectionTrace, M1Pipeline  # noqa: E402

LABELS = {"metal_can", "pet_bottle", "pp_cup", "empty"}
LIGHTING = {"bright", "normal", "dim"}
REASONS = {
    "NO_DETECTION",
    "IGNORED_CLASS_ONLY",
    "AREA_TOO_SMALL",
    "BELOW_DECISION_CONF",
    "ACCEPTED_METAL_CAN",
    "ACCEPTED_PET_BOTTLE",
}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect camera-only Model 1 RVM diagnostics")
    parser.add_argument("--source", required=True, help="camera index or video/image source")
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--label", required=True, choices=sorted(LABELS))
    parser.add_argument("--item-id", required=True)
    parser.add_argument("--lighting", required=True, choices=sorted(LIGHTING))
    parser.add_argument("--duration", type=float, default=10.0)
    parser.add_argument("--output", default=str(ROOT / "validation" / "rvm-sessions"))
    parser.add_argument("--max-frames", type=int, default=0)
    parser.add_argument("--save-every", type=int, default=1)
    parser.add_argument("--no-display", action="store_true")
    parser.add_argument("--enable-serial", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--serial-port", default=None, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    if args.enable_serial or args.serial_port:
        parser.error("diagnostic mode is camera-only; serial arguments are forbidden")
    if args.duration <= 0 or args.save_every <= 0 or args.max_frames < 0:
        parser.error("duration, save-every, and max-frames must be positive (max-frames may be zero)")
    return args


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write(path: Path, payload: str) -> None:
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_text(payload, encoding="utf-8", newline="\n")
    os.replace(tmp, path)


def trace_to_dict(trace: M1DetectionTrace, *, session_id: str, trial_id: str, frame_index: int,
                  timestamp: str, label: str, item_id: str, lighting: str,
                  original_frame: tuple[int, int], model_hash: str, config_hash: str,
                  fps: float | None = None) -> dict[str, Any]:
    selected = dict(trace.selected) if trace.selected is not None else None
    return {
        "schema_version": "m1-rvm-trace-v1",
        "session_id": session_id,
        "trial_id": trial_id,
        "frame_index": frame_index,
        "timestamp": timestamp,
        "ground_truth_label": label,
        "physical_item_id": item_id,
        "lighting": lighting,
        "model_path": trace.model_path,
        "model_sha256": model_hash,
        "config_sha256": config_hash,
        "image_size": 640,
        "frame_width": original_frame[0],
        "frame_height": original_frame[1],
        "raw_detections": list(trace.raw_detections),
        "best_visible_candidate": selected,
        "final_selected_candidate": selected if trace.reason.startswith("ACCEPTED_") else None,
        "final_reason": trace.reason,
        "inference_ms": trace.inference_ms,
        "achieved_fps": fps,
        "model2_would_be_invoked": trace.reason == "ACCEPTED_PET_BOTTLE",
        "serial_enabled": False,
        "decision_conf": trace.decision_conf,
        "min_area_frac": trace.min_area_frac,
    }


def overlay(frame, trace: M1DetectionTrace):
    image = frame.copy()
    for detection in trace.raw_detections:
        x1, y1, x2, y2 = [int(round(value)) for value in detection["xyxy"]]
        accepted = trace.selected is detection or (
            trace.selected is not None and detection == trace.selected and trace.reason.startswith("ACCEPTED_")
        )
        color = (0, 220, 0) if accepted else (0, 160, 255)
        cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
        text = f'{detection["class_name"]} {detection["confidence"]:.2f} a={detection["area_frac"]:.3f}'
        cv2.putText(image, text, (x1, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.48, color, 1, cv2.LINE_AA)
    cv2.putText(image, trace.reason, (10, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
    return image


def _camera_metadata(cap: cv2.VideoCapture, source: str) -> dict[str, Any]:
    return {
        "source": source,
        "camera_index": int(source) if source.isdigit() else None,
        "backend": cap.getBackendName() if hasattr(cap, "getBackendName") else None,
        "requested_width": None,
        "requested_height": None,
        "actual_width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0),
        "actual_height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0),
        "requested_fps": None,
        "actual_fps": float(cap.get(cv2.CAP_PROP_FPS) or 0.0),
        "exposure": cap.get(cv2.CAP_PROP_EXPOSURE),
        "gain": cap.get(cv2.CAP_PROP_GAIN),
        "focus": cap.get(cv2.CAP_PROP_FOCUS),
        "white_balance": cap.get(cv2.CAP_PROP_WB_TEMPERATURE),
    }


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    output = Path(args.output).resolve()
    session_dir = output / args.session_id
    if session_dir.exists():
        raise RuntimeError(f"refusing to overwrite existing session directory: {session_dir}")
    session_dir.mkdir(parents=True)
    frames_dir = session_dir / "frames"
    overlays_dir = session_dir / "overlays"
    frames_dir.mkdir()
    overlays_dir.mkdir()

    cfg = load_config("default")
    validate_manifest(load_manifest())
    model_path = resolve_path(cfg["m1"]["detector"]["path"])
    model_hash = sha256(model_path)
    config_path = ROOT / "config" / "default.json"
    config_hash = sha256(config_path)
    m1 = M1Pipeline(cfg)
    source = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"cannot open source {args.source!r}")

    metadata = _camera_metadata(cap, args.source)
    metadata["serial_enabled"] = False
    started = datetime.now(UTC)
    trace_path = session_dir / "trace.jsonl"
    trace_tmp = session_dir / ".trace.jsonl.tmp"
    records: list[dict[str, Any]] = []
    reasons: Counter[str] = Counter()
    dropped = 0
    frame_index = 0
    start_clock = time.perf_counter()
    try:
        with trace_tmp.open("x", encoding="utf-8", newline="\n") as trace_file:
            while time.perf_counter() - start_clock < args.duration:
                ok, frame = cap.read()
                if not ok:
                    dropped += 1
                    break
                frame_index += 1
                trace = m1.trace(frame)
                elapsed = max(time.perf_counter() - start_clock, 1e-6)
                record = trace_to_dict(
                    trace,
                    session_id=args.session_id,
                    trial_id=f"{args.session_id}:{args.item_id}",
                    frame_index=frame_index,
                    timestamp=datetime.now(UTC).isoformat(),
                    label=args.label,
                    item_id=args.item_id,
                    lighting=args.lighting,
                    original_frame=(frame.shape[1], frame.shape[0]),
                    model_hash=model_hash,
                    config_hash=config_hash,
                    fps=frame_index / elapsed,
                )
                trace_file.write(json.dumps(record, separators=(",", ":")) + "\n")
                trace_file.flush()
                records.append(record)
                reasons[trace.reason] += 1
                if frame_index % args.save_every == 0:
                    cv2.imwrite(str(frames_dir / f"frame_{frame_index:06d}.jpg"), frame)
                    cv2.imwrite(str(overlays_dir / f"frame_{frame_index:06d}.jpg"), overlay(frame, trace))
                if not args.no_display:
                    cv2.imshow("Model 1 RVM diagnostics (serial disabled)", overlay(frame, trace))
                    if cv2.waitKey(1) & 0xFF in (ord("q"), ord("Q")):
                        break
                if args.max_frames and frame_index >= args.max_frames:
                    break
    finally:
        cap.release()
        if not args.no_display:
            cv2.destroyAllWindows()

    os.replace(trace_tmp, trace_path)

    trace_hash = sha256(trace_path)
    frame_hashes = {p.name: sha256(p) for p in sorted(frames_dir.glob("*.jpg"))}
    overlay_hashes = {p.name: sha256(p) for p in sorted(overlays_dir.glob("*.jpg"))}
    report = {
        "schema_version": "m1-rvm-session-v1",
        "session_id": args.session_id,
        "trial_id": f"{args.session_id}:{args.item_id}",
        "started_at": started.isoformat(),
        "finished_at": datetime.now(UTC).isoformat(),
        "label": args.label,
        "item_id": args.item_id,
        "lighting": args.lighting,
        "serial_enabled": False,
        "model_path": str(model_path),
        "model_sha256": model_hash,
        "config_sha256": config_hash,
        "model_manifest": load_manifest(),
        "camera": metadata,
        "frames_processed": frame_index,
        "dropped_or_failed_frames": dropped,
        "reason_counts": dict(sorted(reasons.items())),
        "trace_sha256": trace_hash,
        "frame_hashes": frame_hashes,
        "overlay_hashes": overlay_hashes,
        "trace_file": "trace.jsonl",
    }
    atomic_write(session_dir / "session_report.json", json.dumps(report, indent=2, sort_keys=True))
    manifest = {
        "schema_version": "m1-rvm-session-manifest-v1",
        "session_id": args.session_id,
        "files": {
            "trace.jsonl": trace_hash,
            "session_report.json": sha256(session_dir / "session_report.json"),
        },
        "model_sha256": model_hash,
        "config_sha256": config_hash,
        "serial_enabled": False,
    }
    atomic_write(session_dir / "manifest.json", json.dumps(manifest, indent=2, sort_keys=True))
    print(json.dumps({"session": args.session_id, "frames": frame_index, "reasons": dict(reasons), "serial_enabled": False}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
