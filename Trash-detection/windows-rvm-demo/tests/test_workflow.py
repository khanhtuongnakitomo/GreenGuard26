import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from serial_controller import RVMSerialController  # noqa: E402
from workflow import DemoWorkflow, SignalLatch  # noqa: E402
from gate import M1FrameResult  # noqa: E402


def test_serial_is_disabled_by_default():
    controller = RVMSerialController({"enabled": False, "port": "auto", "baud": 115200})
    assert controller.enabled is False
    assert controller.connect() is False
    assert controller.send("1") is False


def test_signal_latch_never_sends_when_serial_disabled():
    controller = RVMSerialController({"enabled": False})
    latch = SignalLatch()
    assert latch.send_once(controller, "1") is False
    assert latch.sent is False


class _EnabledController:
    enabled = True

    def __init__(self):
        self.signals = []

    def send_signal(self, signal):
        self.signals.append(signal)
        return True

    def emergency_stop(self):
        return True

    def reset_emergency(self):
        return True


def test_signal_zero_is_valid_and_latched_once():
    controller = _EnabledController()
    latch = SignalLatch()
    assert latch.send_once(controller, 0) is True
    assert controller.signals == [0]
    assert latch.send_once(controller, 0) is False


class _FakeM1:
    def __init__(self):
        self.rows = iter([M1FrameResult(poly=np.zeros((4, 2), dtype=np.int32), is_pet=False)] * 7)

    def run(self, frame):
        del frame
        return next(self.rows)


class _FakeM2:
    def run(self, frame, poly):
        del frame, poly
        return []


def test_windows_adapter_uses_canonical_signal_zero():
    cfg = {
        "runtime": {"decision_window": 7, "decision_quorum": 4, "clear_frames": 8, "result_hold_s": 0.0},
        "gate": {"warmup_s": 0.0, "vote_window": 7, "vote_need": 4},
        "m2": {"violation_conf": 0.5},
    }
    controller = _EnabledController()
    workflow = DemoWorkflow(cfg, _FakeM1(), _FakeM2(), None, controller)
    for index in range(7):
        view = workflow.update(object(), now=index * 0.01)
    assert view.state == "SIGNAL_SENT"
    assert controller.signals == [0]
    assert view.signal == 0


def test_emergency_stop_latches_until_explicit_reset():
    controller = _EnabledController()
    workflow = DemoWorkflow(
        {"runtime": {"decision_window": 7, "decision_quorum": 4, "clear_frames": 8}, "gate": {}, "m2": {}},
        _FakeM1(), _FakeM2(), None, controller,
    )
    workflow.update(object(), now=0.0)
    workflow.emergency_stop()
    assert workflow.core.emergency_latched is True
    assert workflow.update(object(), now=1.0).state == "ERROR"
    workflow.reset_after_emergency()
    assert workflow.core.emergency_latched is False
    assert workflow.core.phase == "WAIT_CLEAR"


def test_system_toggle_requires_clear_before_same_item_can_signal():
    controller = _EnabledController()
    workflow = DemoWorkflow(
        {"runtime": {"decision_window": 7, "decision_quorum": 4, "clear_frames": 8}, "gate": {}, "m2": {}},
        _FakeM1(), _FakeM2(), None, controller,
    )
    workflow.update(object(), now=0.0)
    workflow.toggle_system()
    workflow.toggle_system()
    for index in range(6):
        workflow.update(object(), now=1.0 + index * 0.01)
    assert controller.signals == []
    assert workflow.core.phase == "WAIT_CLEAR"


def test_pause_invalidates_in_progress_vote_until_clear():
    controller = _EnabledController()
    workflow = DemoWorkflow(
        {"runtime": {"decision_window": 7, "decision_quorum": 4, "clear_frames": 8}, "gate": {}, "m2": {}},
        _FakeM1(), _FakeM2(), None, controller,
    )
    workflow.update(object(), now=0.0)
    workflow.toggle_pause()
    workflow.toggle_pause()
    for index in range(6):
        workflow.update(object(), now=1.0 + index * 0.01)
    assert controller.signals == []
    assert workflow.core.phase == "WAIT_CLEAR"
