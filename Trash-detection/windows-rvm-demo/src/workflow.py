"""Windows kiosk adapter around the canonical PC decision workflow."""
from __future__ import annotations

import sys
import time
from dataclasses import dataclass
from pathlib import Path

try:
    from decision_core import CanonicalWorkflow, FINAL_SIGNALS
except ModuleNotFoundError:  # source-checkout tests; bundle copies this module
    pc_src = Path(__file__).resolve().parents[2] / "pc-demo" / "src"
    if str(pc_src) not in sys.path:
        sys.path.insert(0, str(pc_src))
    from decision_core import CanonicalWorkflow, FINAL_SIGNALS


@dataclass
class WorkflowView:
    state: str
    title: str
    subtitle: str
    result: str = ""
    signal: int | None = None
    color: tuple[int, int, int] = (160, 160, 160)


class SignalLatch:
    """Send at most one final numeric signal for an item."""

    def __init__(self):
        self.sent = False

    def send_once(self, controller, signal: int) -> bool:
        if self.sent or not controller.enabled:
            return False
        if signal not in FINAL_SIGNALS:
            return False
        if not controller.send_signal(signal):
            return False
        self.sent = True
        return True

    def reset(self):
        self.sent = False


class DemoWorkflow:
    """Expose canonical workflow state and optional serial side effects."""

    def __init__(self, cfg: dict, m1, m2, gate, controller):
        # ``gate`` remains an ignored constructor parameter for integration
        # compatibility; full-mode decisions use the shared core.
        del gate
        self.core = CanonicalWorkflow(cfg, m1, m2)
        self.controller = controller
        self.signal = SignalLatch()
        self.state = "READY"
        self.system_on = True
        self.paused = False
        self.result_name = ""
        self.last_signal: int | None = None
        self._last_error = ""

    def _apply_step(self, step) -> None:
        if step.phase == "READY" and step.detail == "re-armed after eight clear frames":
            self.signal.reset()
            self.result_name = ""
            self.last_signal = None
        if step.phase == "EMERGENCY_STOP":
            self.state = "ERROR"
            self.result_name = "EMERGENCY STOP"
            return
        if step.result:
            self.result_name = step.result
        if step.signal is None:
            if step.phase == "SIGNAL" and self.state in {"SIGNAL_SENT", "CAMERA_ONLY", "ERROR"}:
                return
            self.state = step.phase
            return
        # Check None, not truthiness: signal 0 is a valid aluminum command.
        self.result_name = step.result
        self.last_signal = step.signal
        if not self.controller.enabled:
            self.state = "CAMERA_ONLY"
            return
        if self.signal.send_once(self.controller, step.signal):
            self.state = "SIGNAL_SENT"
        else:
            self._last_error = "v2 serial signal was not acknowledged"
            self.state = "ERROR"

    def update(self, frame, now: float | None = None) -> WorkflowView:
        now = time.perf_counter() if now is None else float(now)
        if not self.system_on or self.paused:
            return self.view()
        step = self.core.update(frame, now=now)
        self._apply_step(step)
        return self.view()

    def toggle_system(self):
        self.system_on = not self.system_on
        if not self.system_on:
            self.core.pause_for_clear()
            if self.core.phase == "WAIT_CLEAR":
                self.state = "WAIT_CLEAR"
        return self.system_on

    def toggle_pause(self):
        self.paused = not self.paused
        if self.paused:
            self.core.pause_for_clear()
            if self.core.phase == "WAIT_CLEAR":
                self.state = "WAIT_CLEAR"
        return self.paused

    def emergency_stop(self, now: float | None = None):
        del now
        if self.controller.enabled:
            self.controller.emergency_stop()
        self.core.emergency_stop()
        self.state = "ERROR"
        self.result_name = "EMERGENCY STOP"

    def reset_after_emergency(self):
        """Operator-only reset; workflow still requires eight clear frames."""
        if self.controller.enabled and hasattr(self.controller, "reset_emergency"):
            if not self.controller.reset_emergency():
                self._last_error = "v2 firmware emergency reset was not acknowledged"
                self.state = "ERROR"
                return
        self.core.clear_emergency()
        if self.core.phase == "WAIT_CLEAR":
            self.state = "WAIT_CLEAR"
            self.result_name = ""

    def view(self) -> WorkflowView:
        labels = {
            "READY": ("Insert one item", "PET bottles and aluminum cans only", (80, 210, 120)),
            "M1_VOTING": ("Checking your item", "Seven-frame material decision", (40, 190, 240)),
            "M2_WARMUP": ("Inspecting PET bottle", "Preparing the bottle inspection", (40, 190, 240)),
            "M2_VOTING": ("Inspecting PET bottle", "Seven-frame quality decision", (40, 190, 240)),
            "SIGNAL_SENT": ("Sorting item", "Signal sent to machine", (80, 210, 120)),
            "CAMERA_ONLY": ("Item detected", "Camera-only validation; no signal sent", (80, 210, 120)),
            "WAIT_CLEAR": ("Remove the item", "Ready for the next item", (80, 210, 120)),
            "ERROR": ("Machine needs attention", self._last_error or "Detection is still available", (50, 80, 230)),
        }
        title, subtitle, color = labels.get(self.state, labels["READY"])
        return WorkflowView(self.state, title, subtitle, self.result_name, signal=self.last_signal, color=color)
