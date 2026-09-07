"""Deterministic tests for the shared seven-observation workflow."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from decision_core import (  # noqa: E402
    CanonicalWorkflow,
    ExactWindowVoter,
    M1_ALUMINUM,
    M1_PET,
    SIGNAL_ALUMINUM,
    SIGNAL_BAD_PET,
    SIGNAL_GOOD_PET,
)
from gate import M1FrameResult, M2Hit  # noqa: E402


POLY = np.asarray([[0, 0], [10, 0], [10, 10], [0, 10]], dtype=np.int32)


def cfg():
    return {
        "runtime": {"decision_window": 7, "decision_quorum": 4, "clear_frames": 8, "result_hold_s": 0.0},
        "gate": {"warmup_s": 0.0, "vote_window": 7, "vote_need": 4},
        "m1": {"miss_hold": 3, "box_smooth": 0.35},
        "m2": {"infer_conf": 0.10, "violation_conf": 0.50},
    }


class FakeM1:
    def __init__(self, rows):
        self.rows = iter(rows)

    def run(self, frame):
        del frame
        return next(self.rows)


class FakeM2:
    def __init__(self, hits=None):
        self.hits = hits or []
        self.calls = 0

    def run(self, frame, poly):
        del frame, poly
        self.calls += 1
        return list(self.hits)


def can():
    return M1FrameResult(poly=POLY, is_pet=False, legend="can")


def pet():
    return M1FrameResult(poly=POLY, is_pet=True, legend="pet")


def missing():
    return M1FrameResult()


def advance(engine, rows, start=0.0):
    steps = []
    for index, row in enumerate(rows):
        steps.append(engine.update(object(), now=start + index * 0.01))
    return steps


def test_exact_window_does_not_resolve_early():
    voter = ExactWindowVoter((M1_ALUMINUM, M1_PET), size=7, quorum=4)
    for _ in range(4):
        assert voter.add(M1_ALUMINUM) is None
    assert voter.complete is False
    result = voter.add(None)
    assert result is None
    voter.add(None)
    result = voter.add(None)
    assert result is not None
    assert result.decision == M1_ALUMINUM
    assert len(result.observations) == 7


def test_m1_four_of_seven_can_emits_signal_zero():
    m2 = FakeM2()
    engine = CanonicalWorkflow(cfg(), FakeM1([can(), can(), can(), can(), missing(), missing(), missing()]), m2)
    steps = advance(engine, range(7))
    assert steps[-1].signal == SIGNAL_ALUMINUM
    assert steps[-1].phase == "RESULT"
    assert engine.result == "ALUMINUM_CAN"
    assert m2.calls == 0


def test_m1_abstentions_do_not_invoke_m2():
    m2 = FakeM2()
    engine = CanonicalWorkflow(cfg(), FakeM1([missing()] * 7), m2)
    steps = advance(engine, range(7))
    assert steps[-1].signal is None
    assert m2.calls == 0


def test_m1_four_of_seven_pet_enters_m2_then_good_emits_one():
    m1_rows = [pet(), pet(), pet(), pet(), missing(), missing(), missing()] + [pet()] * 7
    engine = CanonicalWorkflow(cfg(), FakeM1(m1_rows), FakeM2())
    steps = advance(engine, range(7))
    assert steps[-1].phase == "M2_WARMUP"
    steps = advance(engine, range(7), start=1.0)
    assert steps[-1].signal == SIGNAL_GOOD_PET


def test_m2_four_of_seven_bad_emits_two():
    m1_rows = [pet()] * 7 + [pet()] * 7
    bad = M2Hit("cap", 0.9, POLY.astype(np.float32), 0)
    engine = CanonicalWorkflow(cfg(), FakeM1(m1_rows), FakeM2([bad]))
    advance(engine, range(7))
    steps = advance(engine, range(7), start=1.0)
    assert steps[-1].signal == SIGNAL_BAD_PET


def test_missing_m2_tracking_is_abstain_and_no_quorum_rearms():
    # Seven M1 PET observations, then 3 valid clean frames, 3 valid bad
    # frames, and one missing frame: no side wins four observations.
    bad = M2Hit("cap", 0.9, POLY.astype(np.float32), 0)
    m1_rows = [pet()] * 7 + [pet()] * 3 + [pet()] * 3 + [missing()]
    class MixedM2:
        def __init__(self): self.i = 0
        def run(self, frame, poly):
            del frame, poly
            self.i += 1
            return [bad] if 4 <= self.i <= 6 else []
    engine = CanonicalWorkflow(cfg(), FakeM1(m1_rows), MixedM2())
    advance(engine, range(7))
    steps = advance(engine, range(7), start=1.0)
    assert steps[-1].signal is None
    assert steps[-1].phase == "WAIT_CLEAR"


def test_signal_latches_once_and_eight_clear_frames_rearm():
    engine = CanonicalWorkflow(cfg(), FakeM1([can()] * 7 + [missing()] * 9), FakeM2())
    first = advance(engine, range(7))[-1]
    assert first.signal == 0
    # The result hold is over, then exactly eight missing frames rearm.
    rearm_steps = advance(engine, range(8), start=1.0)
    assert all(step.signal is None for step in rearm_steps)
    assert rearm_steps[-1].phase == "READY"


def test_reset_returns_detection_workflow_to_ready():
    engine = CanonicalWorkflow(cfg(), FakeM1([can()] * 20), FakeM2())
    advance(engine, range(7))
    engine.reset()
    assert engine.phase == "READY"
