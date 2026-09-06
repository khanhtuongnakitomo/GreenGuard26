"""M1 -> optional M2 -> optional RVM workflow with one-command latching."""
from __future__ import annotations

import time
from dataclasses import dataclass

from decisions import command_for_result


@dataclass
class WorkflowView:
    state: str
    title: str
    subtitle: str
    result: str = ""
    color: tuple[int, int, int] = (160, 160, 160)


class SignalLatch:
    def __init__(self):
        self.sent = False

    def send_once(self, controller, command: str) -> bool:
        if self.sent or not controller.enabled:
            return False
        if not controller.send(command):
            return False
        self.sent = True
        return True

    def reset(self):
        self.sent = False


class DemoWorkflow:
    def __init__(self, cfg: dict, m1, m2, gate, controller):
        self.m1, self.m2, self.gate, self.controller = m1, m2, gate, controller
        runtime = cfg["runtime"]
        self.routing = cfg["routing"]
        self.can_stable_frames = int(runtime.get("can_stable_frames", 3))
        self.clear_frames_needed = int(runtime.get("clear_frames", 8))
        self.decision_process_s = float(runtime.get("decision_process_s", 1.0))
        self.result_hold_s = float(runtime.get("result_hold_s", 1.5))
        self.signal = SignalLatch()
        self.state = "READY"
        self.state_since = time.perf_counter()
        self.system_on = True
        self.paused = False
        self.pause_started = None
        self.can_streak = 0
        self.last_kind = None
        self.decision_since = None
        self.pending_result = None
        self.clear_frames = 0
        self.result_name = ""

    def _set_state(self, state: str, now: float):
        self.state, self.state_since = state, now

    def _send_result(self, result: str, now: float):
        self.result_name = result
        if not self.controller.enabled:
            self._set_state("CAMERA_ONLY", now)
            return
        command = command_for_result(result, self.routing)
        if command is None or not self.signal.send_once(self.controller, command):
            self._set_state("ERROR", now)
        else:
            self._set_state("SIGNAL_SENT", now)

    def _reset_for_next_item(self, now: float):
        self.gate.reset(); self.m1.reset_vote(); self.signal.reset()
        self.state, self.state_since = "READY", now
        self.can_streak = 0; self.last_kind = None; self.decision_since = None
        self.pending_result = None; self.clear_frames = 0; self.result_name = ""

    def update(self, frame, now: float | None = None) -> WorkflowView:
        now = time.perf_counter() if now is None else now
        if not self.system_on or self.paused:
            return self.view()
        if self.state in {"SIGNAL_SENT", "CAMERA_ONLY", "ERROR"}:
            if now - self.state_since >= self.result_hold_s:
                self._set_state("WAIT_CLEAR", now)
            return self.view()
        if self.state == "WAIT_CLEAR":
            raw = self.m1.run(frame)
            if raw.poly is None:
                self.clear_frames += 1
                if self.clear_frames >= self.clear_frames_needed:
                    self._reset_for_next_item(now)
            else:
                self.clear_frames = 0
            return self.view()
        raw = self.m1.run(frame)
        if raw.poly is None:
            self.can_streak = 0; self.last_kind = None; self.decision_since = None; self.pending_result = None
            if self.state != "READY": self._set_state("READY", now)
            return self.view()
        if not raw.is_pet:
            if self.last_kind == "ALUMINUM_CAN": self.can_streak += 1
            else: self.last_kind, self.can_streak, self.decision_since = "ALUMINUM_CAN", 1, now
            self._set_state("DETECTING", now)
            if self.can_streak >= self.can_stable_frames: self.pending_result = "ALUMINUM_CAN"
        else:
            self.last_kind = "PET"; self.decision_since = self.decision_since or now
            self._set_state("INSPECTING", now)
            held = self.gate.update_m1_hold(raw, now=now)
            if held is not None:
                result = self.gate.evaluate_pet(held, self.m2.run(frame, held.poly), now=now)
                if result["verdict"].startswith("PET ACCEPT"): self.pending_result = "PET_CLEAN"
                elif result["verdict"].startswith("PET REJECT"): self.pending_result = "PET_REJECT"
        if self.pending_result and self.decision_since is not None and now - self.decision_since >= self.decision_process_s:
            self._send_result(self.pending_result, now)
        return self.view()

    def toggle_system(self):
        self.system_on = not self.system_on
        return self.system_on

    def toggle_pause(self):
        self.paused = not self.paused
        return self.paused

    def emergency_stop(self, now: float | None = None):
        if self.controller.enabled: self.controller.send("0")
        self._set_state("ERROR", time.perf_counter() if now is None else now)
        self.result_name = "EMERGENCY STOP"

    def view(self) -> WorkflowView:
        labels = {
            "READY": ("Insert one item", "PET bottles and aluminum cans only", (80, 210, 120)),
            "DETECTING": ("Checking your item", "Please hold it still", (40, 190, 240)),
            "INSPECTING": ("Inspecting PET bottle", "Checking the bottle", (40, 190, 240)),
            "CAMERA_ONLY": ("Item detected", "Camera-only validation; no signal sent", (80, 210, 120)),
            "SIGNAL_SENT": ("Sorting item", "Signal sent to machine", (80, 210, 120)),
            "WAIT_CLEAR": ("Remove the item", "Ready for the next item", (80, 210, 120)),
            "ERROR": ("Machine needs attention", "Detection is still available", (50, 80, 230)),
        }
        title, subtitle, color = labels.get(self.state, labels["READY"])
        return WorkflowView(self.state, title, subtitle, self.result_name, color)
