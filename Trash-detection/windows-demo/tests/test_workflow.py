from __future__ import annotations

import io
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from gate import M1FrameResult  # noqa: E402
from signal_sink import SignalSink  # noqa: E402
from workflow import DemoWorkflow  # noqa: E402


class _FakeM1:
    def __init__(self):
        self.rows = iter([M1FrameResult(poly=np.zeros((4, 2), dtype=np.int32), is_pet=False)] * 7 + [M1FrameResult()] * 8)

    def run(self, frame):
        del frame
        return next(self.rows)


class _FakeM2:
    def run(self, frame, poly):
        del frame, poly
        return []


def _cfg():
    return {
        "runtime": {"decision_window": 7, "decision_quorum": 4, "clear_frames": 8, "result_hold_s": 0.0},
        "gate": {"warmup_s": 0.0, "vote_window": 7, "vote_need": 4},
        "m2": {"violation_conf": 0.5},
    }


def test_windows_adapter_emits_canonical_zero_once_without_controller():
    workflow = DemoWorkflow(_cfg(), _FakeM1(), _FakeM2())
    signals = []
    for index in range(7):
        view = workflow.update(object(), now=index * 0.01)
        if view.signal is not None:
            signals.append(view.signal)
    assert signals == [0]
    assert view.state == "RESULT"
    assert view.signal == 0


def test_result_hold_view_has_no_repeated_signal():
    workflow = DemoWorkflow(_cfg(), _FakeM1(), _FakeM2())
    for index in range(7):
        view = workflow.update(object(), now=index * 0.01)
    assert view.signal == 0
    held = workflow.update(object(), now=0.1)
    assert held.state == "WAIT_CLEAR"
    assert held.signal is None


def test_signal_sink_accepts_all_values_and_flushes():
    class Stream(io.StringIO):
        def __init__(self):
            super().__init__()
            self.flushes = 0

        def flush(self):
            self.flushes += 1
            super().flush()

    stream = Stream()
    sink = SignalSink(stream)
    for value in (0, 1, 2):
        sink.emit(value)
    assert stream.getvalue() == "0\n1\n2\n"
    assert stream.flushes == 3


def test_signal_sink_rejects_invalid_values_without_coercion():
    stream = io.StringIO()
    sink = SignalSink(stream)
    for value in (-1, 3, "0", True, None):
        try:
            sink.emit(value)
        except ValueError:
            pass
        else:
            raise AssertionError(f"accepted invalid value {value!r}")
    assert stream.getvalue() == ""
