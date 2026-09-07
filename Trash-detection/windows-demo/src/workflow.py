"""Detection-only Windows adapter around the canonical decision workflow."""
from __future__ import annotations

import sys
import time
from dataclasses import dataclass
from pathlib import Path

try:
    from decision_core import CanonicalWorkflow
except ModuleNotFoundError:  # source-checkout tests; bundle copies this module
    pc_src = Path(__file__).resolve().parents[2] / "pc-demo" / "src"
    if str(pc_src) not in sys.path:
        sys.path.insert(0, str(pc_src))
    from decision_core import CanonicalWorkflow


@dataclass
class WorkflowView:
    state: str
    title: str
    subtitle: str
    result: str = ""
    signal: int | None = None
    color: tuple[int, int, int] = (160, 160, 160)


class DemoWorkflow:
    """Expose canonical detection state without machine-control ownership."""

    def __init__(self, cfg: dict, m1, m2, gate=None):
        # ``gate`` is accepted only for source compatibility with older callers;
        # CanonicalWorkflow owns the complete seven-observation contract.
        del gate
        self.core = CanonicalWorkflow(cfg, m1, m2)
        self.state = "READY"
        self.system_on = True
        self.paused = False
        self.result_name = ""
        self._last_signal: int | None = None

    def _apply_step(self, step) -> None:
        if step.phase == "READY" and step.detail == "re-armed after eight clear frames":
            self.result_name = ""
            self._last_signal = None
        if step.result:
            self.result_name = step.result
        self.state = step.phase
        if step.signal is not None:
            self._last_signal = step.signal

    def update(self, frame, now: float | None = None) -> WorkflowView:
        now = time.perf_counter() if now is None else float(now)
        if not self.system_on or self.paused:
            return self.view()
        step = self.core.update(frame, now=now)
        self._apply_step(step)
        return self.view(step.signal)

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

    def view(self, signal: int | None = None) -> WorkflowView:
        labels = {
            "READY": ("Insert one item", "PET bottles and aluminum cans only", (80, 210, 120)),
            "M1_VOTING": ("Checking your item", "Seven-frame material decision", (40, 190, 240)),
            "M2_WARMUP": ("Inspecting PET bottle", "Preparing the bottle inspection", (40, 190, 240)),
            "M2_VOTING": ("Inspecting PET bottle", "Seven-frame quality decision", (40, 190, 240)),
            "RESULT": ("Detection complete", "Result is available to the external consumer", (80, 210, 120)),
            "WAIT_CLEAR": ("Remove the item", "Ready for the next item", (80, 210, 120)),
        }
        title, subtitle, color = labels.get(self.state, labels["READY"])
        return WorkflowView(self.state, title, subtitle, self.result_name, signal=signal, color=color)
