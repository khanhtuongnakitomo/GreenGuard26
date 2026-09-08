"""Deterministic fixed-camera workflow contract tests."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from gate import M1FrameResult, M2Hit  # noqa: E402
from machine_workflow import MachineWorkflow  # noqa: E402


POLY = np.asarray([[0, 0], [100, 0], [100, 100], [0, 100]], dtype=np.int32)


def cfg():
    return {
        "runtime": {"decision_window": 7, "decision_quorum": 4, "clear_frames": 8, "result_hold_s": 1.5},
        "gate": {"warmup_s": 0.5, "vote_window": 7, "vote_need": 4},
        "m1": {"miss_hold": 3, "box_smooth": 0.35},
        "m2": {"infer_conf": 0.10, "violation_conf": 0.50},
    }


class FakeM1:
    def __init__(self, rows):
        self.rows = iter(rows)
        self.calls = 0

    def run(self, frame):
        del frame
        self.calls += 1
        return next(self.rows)


class FakeM2:
    def __init__(self, hits=None, rows=None):
        self.hits = list(hits or [])
        self.rows = iter(rows) if rows is not None else None
        self.calls = 0

    def run(self, frame, poly):
        del frame, poly
        self.calls += 1
        return list(next(self.rows)) if self.rows is not None else list(self.hits)


def can():
    return M1FrameResult(poly=POLY, is_pet=False)


def pet():
    return M1FrameResult(poly=POLY, is_pet=True)


def missing():
    return M1FrameResult()


def hit(name, confidence=0.9):
    ids = {"cap": 0, "label": 1, "ring": 2}
    return M2Hit(name, confidence, POLY.astype(np.float32), ids[name])


def updates(workflow, count, start=0.0, step=0.01):
    return [workflow.update(object(), now=start + index * step) for index in range(count)]


def test_start_waits_for_object_and_consumes_exactly_seven_can_observations():
    m1 = FakeM1([can()] * 7 + [missing()] * 8)
    workflow = MachineWorkflow(cfg(), m1, FakeM2())
    assert workflow.view().state == "WAITING TO START"
    workflow.start()
    assert workflow.view().state == "WAITING FOR OBJECT"
    steps = updates(workflow, 7)
    assert steps[-1].state == "CANS"
    assert steps[-1].command == "CANS"
    assert workflow.core.m1_vote.result is not None
    assert len(workflow.core.m1_vote.result.observations) == 7
    assert m1.calls == 7
    assert updates(workflow, 1, start=0.1)[0].command is None


@pytest.mark.parametrize("defect", ["cap", "label", "ring"])
def test_each_defect_at_or_above_half_is_bad(defect):
    m1 = FakeM1([pet()] * 14)
    workflow = MachineWorkflow(cfg(), m1, FakeM2([hit(defect, 0.50)]))
    workflow.start()
    updates(workflow, 7)
    steps = updates(workflow, 7, start=0.6)
    assert steps[-1].state == "BAD"
    assert steps[-1].command == "BAD"


def test_four_clean_pet_observations_after_warmup_are_good():
    workflow = MachineWorkflow(cfg(), FakeM1([pet()] * 14), FakeM2())
    workflow.start()
    updates(workflow, 7)
    steps = updates(workflow, 7, start=0.6)
    assert steps[-1].state == "GOOD"
    assert steps[-1].command == "GOOD"


def test_missing_m1_during_m2_is_abstention_and_no_quorum_has_no_command():
    m2_rows = ([[]] * 3) + ([[hit("cap", 0.9)]] * 3) + ([[]])
    m1 = FakeM1([pet()] * 13 + [missing()])
    workflow = MachineWorkflow(cfg(), m1, FakeM2(rows=m2_rows))
    workflow.start()
    updates(workflow, 7)
    steps = updates(workflow, 7, start=0.6)
    assert steps[-1].state == "REMOVE OBJECT"
    assert steps[-1].command is None


def test_pause_invalidates_unfinished_vote_and_resume_requires_clear():
    m1 = FakeM1([pet()] + [missing()] * 8)
    workflow = MachineWorkflow(cfg(), m1, FakeM2())
    workflow.start()
    assert workflow.update(object(), now=0.0).state == "DETECTING..."
    assert workflow.pause().state == "PAUSED"
    assert m1.calls == 1
    workflow.start()
    assert workflow.update(object(), now=1.0).state == "REMOVE OBJECT"
    steps = updates(workflow, 6, start=1.1)
    assert steps[-1].state == "REMOVE OBJECT"
    assert workflow.update(object(), now=1.2).state == "WAITING FOR OBJECT"


def test_hold_remove_rearm_and_one_command_per_item():
    m1 = FakeM1([can()] * 7 + [missing()] * 8 + [can()] * 7)
    workflow = MachineWorkflow(cfg(), m1, FakeM2())
    workflow.start()
    first = updates(workflow, 7)
    assert [step.command for step in first if step.command] == ["CANS"]
    assert workflow.update(object(), now=1.0).state == "CANS"
    assert workflow.update(object(), now=1.6).state == "REMOVE OBJECT"
    assert all(step.command is None for step in updates(workflow, 6, start=1.7))
    assert workflow.update(object(), now=1.8).state == "WAITING FOR OBJECT"
    second = updates(workflow, 7, start=1.9)
    assert [step.command for step in second if step.command] == ["CANS"]


def test_pause_before_any_object_resumes_without_clear_gate():
    workflow = MachineWorkflow(cfg(), FakeM1([]), FakeM2())
    workflow.start()
    workflow.pause()
    workflow.start()
    assert workflow.view().state == "WAITING FOR OBJECT"
