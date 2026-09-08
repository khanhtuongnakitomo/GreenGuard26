"""Machine-facing state adapter around the shared canonical workflow.

The canonical workflow keeps the internal signals 0/1/2 and the public names
ALUMINUM_CAN/PET_CLEAN/PET_REJECT.  This adapter owns only machine presentation
and the one-shot result event; transport translates the result name to a raw
controller byte at the final boundary.
"""
from __future__ import annotations

from dataclasses import dataclass

from decision_core import CanonicalWorkflow


RESULT_NAMES = {
    "ALUMINUM_CAN": "CANS",
    "PET_CLEAN": "GOOD",
    "PET_REJECT": "BAD",
}


@dataclass(frozen=True)
class MachineView:
    """Redacted state for the fixed-camera operator UI."""

    state: str
    result: str = ""
    command: str | None = None
    phase: str = ""


class MachineWorkflow:
    """Run/pause lifecycle around :class:`CanonicalWorkflow`.

    The wrapper deliberately does not know anything about serial ports.  A
    command is exposed exactly once on the canonical result step and callers
    must pass only that event to the transport.
    """

    def __init__(self, cfg: dict, m1, m2):
        self.core = CanonicalWorkflow(cfg, m1, m2)
        self.running = False
        self.paused = False
        self.camera_required = False
        self.item_started = False
        self.requires_clear = False
        self.last_result = ""

    @staticmethod
    def _accepted_m1(raw) -> bool:
        return raw is not None and raw.poly is not None

    def start(self) -> MachineView:
        """Run detection; an unfinished item remains behind its clear gate."""
        if self.camera_required:
            return self.view()
        self.running = True
        self.paused = False
        return self.view()

    def pause(self) -> MachineView:
        """Stop inference and invalidate an unfinished vote without output."""
        if not self.running and not self.paused:
            return self.view()
        had_item = self.item_started or self.core.phase in {
            "M1_VOTING",
            "M2_WARMUP",
            "M2_VOTING",
            "RESULT",
            "WAIT_CLEAR",
        }
        if had_item and self.core.phase not in {"RESULT", "WAIT_CLEAR"}:
            self.core.pause_for_clear()
            self.requires_clear = True
        elif not had_item:
            self.core.reset()
            self.requires_clear = False
        self.running = False
        self.paused = True
        return self.view()

    def camera_failed(self) -> MachineView:
        """Fail closed after an unavailable camera or a read failure."""
        self.running = False
        self.paused = False
        self.camera_required = True
        return self.view()

    def update(self, frame, now: float | None = None) -> MachineView:
        if self.camera_required or not self.running or self.paused:
            return self.view()

        before = self.core.phase
        step = self.core.update(frame, now=now)
        if before == "READY" and self._accepted_m1(step.m1_raw):
            self.item_started = True
        if step.phase in {"M1_VOTING", "M2_WARMUP", "M2_VOTING", "RESULT", "WAIT_CLEAR"}:
            self.item_started = True

        command = None
        if step.result:
            self.last_result = RESULT_NAMES.get(step.result, "")
        if step.signal is not None:
            command = RESULT_NAMES.get(step.result)

        if step.phase == "READY":
            self.item_started = False
            self.requires_clear = False
            self.last_result = ""
        return self.view(command=command, phase=step.phase)

    def view(self, command: str | None = None, phase: str | None = None) -> MachineView:
        phase = self.core.phase if phase is None else phase
        if self.camera_required:
            state = "CAMERA 1 REQUIRED"
        elif self.paused:
            state = "PAUSED"
        elif not self.running:
            state = "WAITING TO START"
        elif phase == "READY":
            state = "WAITING FOR OBJECT"
        elif phase in {"M1_VOTING", "M2_WARMUP", "M2_VOTING"}:
            state = "DETECTING..."
        elif phase == "RESULT":
            state = self.last_result or "DETECTING..."
        elif phase == "WAIT_CLEAR":
            state = "REMOVE OBJECT"
        else:
            state = "WAITING FOR OBJECT"
        return MachineView(state=state, result=self.last_result, command=command, phase=phase)
