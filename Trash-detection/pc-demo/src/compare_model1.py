"""Diagnostic active-versus-challenger Model 1 comparison.

The two pipelines receive the same captured frame, run independently, and
maintain independent seven-observation vote windows. This module deliberately
does not import Model 2 or the serial transport.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np

SRC = Path(__file__).resolve().parent
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from config_loader import load_config, load_manifest, validate_manifest  # noqa: E402
from pipeline import M1DetectionTrace, M1Pipeline  # noqa: E402
from ui import draw_controls, draw_paused_banner, hit_button, scale_for_display  # noqa: E402


CLASS_NAMES = {0: "metal_can", 1: "pet_bottle"}
MAX_CAM_INDEX = 7


@dataclass
class VoteState:
    """Exactly-seven observation vote with an eight-clear-frame re-arm."""

    window: int = 7
    quorum: int = 4
    clear_required: int = 8
    observations: list[int | None] = field(default_factory=list)
    result: str | None = None
    waiting_clear: bool = False
    clear_frames: int = 0
    completed_windows: int = 0

    def reset(self) -> None:
        self.observations.clear()
        self.result = None
        self.waiting_clear = False
        self.clear_frames = 0

    def consume(self, class_id: int | None) -> str | None:
        if self.waiting_clear:
            if class_id is None:
                self.clear_frames += 1
                if self.clear_frames >= self.clear_required:
                    self.waiting_clear = False
                    self.observations.clear()
                    self.result = None
                    self.clear_frames = 0
            else:
                self.clear_frames = 0
            return None

        if len(self.observations) < self.window:
            self.observations.append(class_id if class_id in CLASS_NAMES else None)
        if len(self.observations) < self.window:
            return None

        counts = Counter(value for value in self.observations if value in CLASS_NAMES)
        winners = [class_id for class_id, count in counts.items() if count >= self.quorum]
        self.result = CLASS_NAMES[winners[0]] if len(winners) == 1 else None
        self.completed_windows += 1
        self.waiting_clear = True
        self.clear_frames = 0
        return self.result

    @property
    def count_text(self) -> str:
        counts = Counter(value for value in self.observations if value in CLASS_NAMES)
        return f"{counts.get(0, 0)} can / {counts.get(1, 0)} PET ({len(self.observations)}/{self.window})"


def accepted_class(trace: M1DetectionTrace) -> int | None:
    if trace.reason == "ACCEPTED_METAL_CAN":
        return 0
    if trace.reason == "ACCEPTED_PET_BOTTLE":
        return 1
    return None


def _open_source(source: str, camera_index: int | None = None):
    value: Any = camera_index if camera_index is not None else (int(source) if source.isdigit() else source)
    if isinstance(value, int):
        cap = cv2.VideoCapture(value, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap.release()
            cap = cv2.VideoCapture(value)
        return cap, value
    return cv2.VideoCapture(value), None


def _draw_trace(panel: np.ndarray, trace: M1DetectionTrace, title: str, vote: VoteState) -> None:
    cv2.putText(panel, title, (12, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2)
    for row in trace.raw_detections:
        x1, y1, x2, y2 = [int(round(value)) for value in row["xyxy"]]
        class_id = int(row["class_id"])
        color = (0, 220, 0) if trace.selected is row else ((255, 180, 0) if class_id == 1 else (0, 180, 255))
        cv2.rectangle(panel, (x1, y1), (x2, y2), color, 2)
        text = f"{row['class_name']} {float(row['confidence']) * 100:.1f}%"
        cv2.putText(panel, text, (max(4, x1), max(54, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.58, color, 2)
    reason_color = (0, 220, 0) if trace.reason.startswith("ACCEPTED_") else (0, 200, 255)
    cv2.putText(panel, trace.reason, (12, 62), cv2.FONT_HERSHEY_SIMPLEX, 0.58, reason_color, 2)
    cv2.putText(panel, f"vote: {vote.count_text}", (12, 88), cv2.FONT_HERSHEY_SIMPLEX, 0.56, (230, 230, 230), 2)
    if vote.waiting_clear:
        text = f"REMOVE OBJECT / clear {vote.clear_frames}/{vote.clear_required}"
        cv2.putText(panel, text, (12, 114), cv2.FONT_HERSHEY_SIMPLEX, 0.56, (0, 180, 255), 2)
    elif vote.result:
        cv2.putText(panel, vote.result.upper(), (12, 114), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 220, 0), 2)


def _status_line(active: VoteState, candidate: VoteState, running: bool) -> str:
    if not running:
        return "PAUSED"
    if active.waiting_clear or candidate.waiting_clear:
        return "REMOVE OBJECT"
    if active.result or candidate.result:
        return f"ACTIVE: {active.result or 'NO QUORUM'} | CANDIDATE: {candidate.result or 'NO QUORUM'}"
    return "DETECTING — seven observations required"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="0", help="camera index or recorded file")
    parser.add_argument("--active-config", default="default")
    parser.add_argument("--candidate-config", default="m1_candidate")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--auto-start", action="store_true")
    parser.add_argument("--max-frames", type=int, default=0)
    parser.add_argument("--save", default=None)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    active_cfg = load_config(args.active_config)
    candidate_cfg = load_config(args.candidate_config)
    validate_manifest(load_manifest(active_cfg.get("manifest")))
    validate_manifest(load_manifest(candidate_cfg.get("manifest")))
    active = M1Pipeline(active_cfg)
    candidate = M1Pipeline(candidate_cfg)
    cap, camera_index = _open_source(args.source)
    if not cap.isOpened():
        print(f"ERROR: cannot open source {args.source!r}", file=sys.stderr)
        return 1

    running = bool(args.auto_start or args.headless)
    active_vote = VoteState()
    candidate_vote = VoteState()
    save_dir = Path(args.save) if args.save else None
    if save_dir:
        save_dir.mkdir(parents=True, exist_ok=True)
    window = "Model 1 Active vs Candidate"
    controls = ((0, 0, 0, 0),) * 3
    ui = {"running": running, "switch": False, "quit": False}
    frame_number = 0
    if not args.headless:
        cv2.namedWindow(window, cv2.WINDOW_NORMAL)

        def on_mouse(event, x, y, _flags, _userdata):
            if event != cv2.EVENT_LBUTTONDOWN:
                return
            if not ui["running"] and hit_button(x, y, controls[0]):
                ui["running"] = True
                active_vote.reset()
                candidate_vote.reset()
            elif ui["running"] and hit_button(x, y, controls[1]):
                ui["running"] = False
                active_vote.reset()
                candidate_vote.reset()
            elif hit_button(x, y, controls[2]) and camera_index is not None:
                ui["switch"] = True

        cv2.setMouseCallback(window, on_mouse)

    while True:
        running = bool(ui["running"])
        ok, frame = cap.read()
        if not ok:
            break
        frame_number += 1
        active_trace = M1DetectionTrace("PAUSED", (), None, str(active.det_path), active.decision_conf, active.min_area_frac, frame.shape[:2], 0.0) if not running else active.trace(frame)
        candidate_trace = M1DetectionTrace("PAUSED", (), None, str(candidate.det_path), candidate.decision_conf, candidate.min_area_frac, frame.shape[:2], 0.0) if not running else candidate.trace(frame)
        active_result = active_vote.consume(accepted_class(active_trace)) if running else None
        candidate_result = candidate_vote.consume(accepted_class(candidate_trace)) if running else None

        left = frame.copy()
        right = frame.copy()
        _draw_trace(left, active_trace, "ACTIVE", active_vote)
        _draw_trace(right, candidate_trace, "CANDIDATE — NOT ACTIVE", candidate_vote)
        combined = np.hstack((left, right))
        status = _status_line(active_vote, candidate_vote, running)
        cv2.putText(combined, status, (12, combined.shape[0] - 62), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 220, 255), 2)
        if not running:
            draw_paused_banner(combined)

        if save_dir and running:
            cv2.imwrite(str(save_dir / f"compare_{frame_number:06d}.jpg"), combined)
        if args.headless:
            print(json.dumps({
                "frame": frame_number,
                "active": {"reason": active_trace.reason, "class": accepted_class(active_trace), "confidence": active_trace.effective_decision_conf, "vote": active_vote.count_text, "result": active_result},
                "candidate": {"reason": candidate_trace.reason, "class": accepted_class(candidate_trace), "confidence": candidate_trace.effective_decision_conf, "vote": candidate_vote.count_text, "result": candidate_result},
            }))
        else:
            display = scale_for_display(combined, 0.75)
            start_rect, pause_rect, cam_rect = draw_controls(display, running, f"CAM {camera_index}" if camera_index is not None else "FILE")
            controls = (start_rect, pause_rect, cam_rect)
            cv2.imshow(window, display)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), ord("Q"), 27):
                break
            if key in (ord("s"), ord("S"), ord(" ")):
                ui["running"] = True
                active_vote.reset()
                candidate_vote.reset()
            elif key in (ord("p"), ord("P")):
                ui["running"] = False
                active_vote.reset()
                candidate_vote.reset()
            elif key in (ord("c"), ord("C")) and camera_index is not None:
                ui["switch"] = True
            if ui["switch"] and camera_index is not None:
                next_index = (int(camera_index) + 1) % (MAX_CAM_INDEX + 1)
                new_cap, new_idx = _open_source(args.source, next_index)
                if new_cap.isOpened():
                    cap.release()
                    cap, camera_index = new_cap, new_idx
                    ui["running"] = False
                    active_vote.reset()
                    candidate_vote.reset()
                ui["switch"] = False
            mouse_state = {"start": start_rect, "pause": pause_rect, "cam": cam_rect}
            # Mouse handling is intentionally keyboard-first; controls are
            # still visible and clickable through the shared helper contract.
            _ = mouse_state
        if args.max_frames and frame_number >= args.max_frames:
            break

    cap.release()
    if not args.headless:
        cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
