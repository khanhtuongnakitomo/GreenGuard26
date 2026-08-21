"""Capture live PET crops and optionally fine-tune Model 2 in a subprocess.

This is outcome-driven learning from kiosk decisions, not classic RL
(Q-learning). Rejected PET crops keep Model 2's cap/label/liquid boxes as labels.
Accepted PET crops are stored with empty labels so the model sees prepared bottles.
"""

from __future__ import annotations

import json
import subprocess
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path

import cv2

from rl_config import (
    MODEL2_ROOT,
    live_dataset_root,
    rl_auto_train,
    rl_device,
    rl_enabled,
    rl_epochs,
    rl_min_samples,
    rl_save_accepts,
)

CLASS_TO_ID = {"bottle": 0, "cap": 1, "label": 2, "liquid": 3, "water": 3}
RELOAD_FLAG = MODEL2_ROOT / "models" / "reload.flag"


def _utc_stamp():
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")


def _crop_from_inspection(frame, inspection):
    bbox = inspection.get("crop_bbox") if inspection else None
    if not bbox or len(bbox) != 4:
        return None, None
    x1, y1, x2, y2 = [int(v) for v in bbox]
    if x2 <= x1 or y2 <= y1:
        return None, None
    crop = frame[y1:y2, x1:x2]
    if crop is None or crop.size == 0:
        return None, None
    return crop.copy(), (x1, y1, x2, y2)


def _obb_line(class_name, polygon, crop_box):
    class_id = CLASS_TO_ID.get(class_name)
    if class_id is None or not polygon:
        return None
    x1, y1, x2, y2 = crop_box
    width = max(1.0, x2 - x1)
    height = max(1.0, y2 - y1)
    coords = []
    for point in polygon:
        if not point or len(point) < 2:
            return None
        nx = min(1.0, max(0.0, (float(point[0]) - x1) / width))
        ny = min(1.0, max(0.0, (float(point[1]) - y1) / height))
        coords.extend([nx, ny])
    if len(coords) != 8:
        return None
    return f"{class_id} " + " ".join(f"{value:.6f}" for value in coords)


class ReinforcementLearner:
    def __init__(self):
        self.enabled = rl_enabled()
        self.auto_train = rl_auto_train()
        self.save_accepts = rl_save_accepts()
        self.min_samples = rl_min_samples()
        self.epochs = rl_epochs()
        self.device = rl_device()
        self.root = live_dataset_root()
        self.image_dir = self.root / "images"
        self.label_dir = self.root / "labels"
        self.unsynced_path = self.root / "unsynced.txt"
        self.lock = threading.Lock()
        self.train_proc = None
        self.last_message = "off"
        self.saved_count = 0
        if self.enabled:
            self.image_dir.mkdir(parents=True, exist_ok=True)
            self.label_dir.mkdir(parents=True, exist_ok=True)
            self.saved_count = len(list(self.image_dir.glob("*.jpg")))
            self.last_message = f"on · {self.saved_count} samples"
            print(f"Reinforcement learning ON. Samples → {self.root}")
            if self.auto_train:
                print(f"Auto-train after {self.min_samples} new samples (background process).")

    def status(self):
        training = self.train_proc is not None and self.train_proc.poll() is None
        return {
            "enabled": self.enabled,
            "training": training,
            "saved_count": self.saved_count,
            "message": self.last_message,
        }

    def maybe_record(self, event, frame, inspection):
        if not self.enabled or not event:
            return
        if event == "accept" and not self.save_accepts:
            return
        if inspection is None:
            return
        crop, crop_box = _crop_from_inspection(frame, inspection)
        if crop is None:
            return

        stamp = _utc_stamp()
        stem = f"{stamp}_{event}"
        image_path = self.image_dir / f"{stem}.jpg"
        label_path = self.label_dir / f"{stem}.txt"
        meta_path = self.root / f"{stem}.json"

        lines = []
        if event == "reject":
            for item in inspection.get("detections") or []:
                line = _obb_line(item.get("class_name"), item.get("polygon"), crop_box)
                if line:
                    lines.append(line)

        cv2.imwrite(str(image_path), crop)
        label_path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
        meta_path.write_text(
            json.dumps(
                {
                    "event": event,
                    "decision": inspection.get("decision"),
                    "reason": inspection.get("reason"),
                    "timestamp": stamp,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        with self.lock:
            self.unsynced_path.parent.mkdir(parents=True, exist_ok=True)
            with self.unsynced_path.open("a", encoding="utf-8") as handle:
                handle.write(stem + "\n")
            self.saved_count += 1
            unsynced = self._unsynced_count()
            self.last_message = f"saved {event} · {self.saved_count} total"
            print(f"RL saved {event} sample {stem}")
        if self.auto_train and unsynced >= self.min_samples:
            self._start_train()

    def poll_reload(self, pipeline):
        self._reap_train()
        if not RELOAD_FLAG.exists() or pipeline is None:
            return False
        try:
            ok = pipeline.reload_weights(MODEL2_ROOT / "models" / "best.pt")
            RELOAD_FLAG.unlink(missing_ok=True)
            if ok:
                self.last_message = "weights reloaded"
                print("RL: Model 2 weights reloaded from live fine-tune.")
            return ok
        except Exception as exc:
            self.last_message = f"reload failed: {exc}"
            print(f"RL reload failed: {exc}")
            return False

    def _unsynced_count(self):
        if not self.unsynced_path.exists():
            return 0
        lines = [line.strip() for line in self.unsynced_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        return len(lines)

    def _clear_unsynced(self):
        if self.unsynced_path.exists():
            self.unsynced_path.write_text("", encoding="utf-8")

    def _start_train(self):
        if self.train_proc is not None and self.train_proc.poll() is None:
            return
        script = MODEL2_ROOT / "src" / "finetune_live.py"
        python = sys.executable
        self.last_message = "training..."
        print("RL: starting background Model 2 fine-tune")
        self.train_proc = subprocess.Popen(
            [
                python,
                str(script),
                "--epochs",
                str(self.epochs),
                "--device",
                self.device,
            ],
            cwd=str(MODEL2_ROOT),
        )

    def _reap_train(self):
        if self.train_proc is None:
            return
        code = self.train_proc.poll()
        if code is None:
            return
        if code == 0:
            self._clear_unsynced()
            self.last_message = "train done"
            print("RL: background fine-tune finished.")
        else:
            self.last_message = f"train failed ({code})"
            print(f"RL: background fine-tune failed with code {code}")
        self.train_proc = None
