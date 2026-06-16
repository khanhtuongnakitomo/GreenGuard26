import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path


def utc_timestamp():
    return datetime.now(timezone.utc).isoformat()


def now_ms():
    return time.perf_counter() * 1000.0


def normalize_bbox(bbox):
    return [float(v) for v in bbox]


def decide(detections, conf_threshold):
    if not detections:
        return "no_detection", None

    best = max(detections, key=lambda item: item["confidence"])
    if best["confidence"] >= conf_threshold:
        return "accepted", best
    return "low_conf", best


class TelemetryLogger:
    def __init__(
        self,
        telemetry_path="logs/telemetry.jsonl",
        error_path="logs/errors.jsonl",
        snapshot_dir="logs/snapshots",
        device_id="local-dev",
        session_id=None,
        enabled=True,
    ):
        self.telemetry_path = Path(telemetry_path) if telemetry_path else None
        self.error_path = Path(error_path) if error_path else None
        self.snapshot_dir = Path(snapshot_dir) if snapshot_dir else None
        self.device_id = device_id
        self.session_id = session_id or str(uuid.uuid4())
        self.enabled = enabled

    def _append_jsonl(self, path, payload):
        if not self.enabled or path is None:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(payload, ensure_ascii=False) + "\n")

    def event(
        self,
        *,
        source,
        model_path,
        model_type,
        frame_id,
        detections,
        conf_threshold,
        inference_ms,
        fps,
        snapshot_path=None,
    ):
        decision, best = decide(detections, conf_threshold)
        payload = {
            "timestamp": utc_timestamp(),
            "session_id": self.session_id,
            "device_id": self.device_id,
            "source": source,
            "model_path": model_path,
            "model_type": model_type,
            "frame_id": frame_id,
            "detections": detections,
            "best_class": best["class_name"] if best else None,
            "best_confidence": best["confidence"] if best else 0.0,
            "decision": decision,
            "confidence_threshold": conf_threshold,
            "inference_ms": inference_ms,
            "fps": fps,
            "snapshot_path": snapshot_path,
        }
        self._append_jsonl(self.telemetry_path, payload)
        return payload

    def error(self, *, source, model_path, model_type, message, frame_id=None):
        payload = {
            "timestamp": utc_timestamp(),
            "session_id": self.session_id,
            "device_id": self.device_id,
            "source": source,
            "model_path": model_path,
            "model_type": model_type,
            "frame_id": frame_id,
            "message": str(message),
        }
        self._append_jsonl(self.error_path, payload)
        return payload

    def save_snapshot(self, frame, frame_id, decision):
        if not self.enabled or self.snapshot_dir is None:
            return None

        self.snapshot_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{self.session_id}_{frame_id:06d}_{decision}.jpg"
        path = self.snapshot_dir / filename

        import cv2

        if cv2.imwrite(os.fspath(path), frame):
            return os.fspath(path)
        return None
