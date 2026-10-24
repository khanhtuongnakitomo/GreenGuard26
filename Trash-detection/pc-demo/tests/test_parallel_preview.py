from __future__ import annotations

import sys
import threading
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from gate import M2Hit  # noqa: E402
from parallel_preview import ParallelInferenceRunner, ParallelPreviewWorkflow, PreviewEvidence  # noqa: E402


def m1(label="NONE", confidence=0.0, accepted=False):
    return SimpleNamespace(
        label=label,
        confidence=confidence,
        accepted=accepted,
        is_pet=label == "PET",
        poly=np.asarray([[1, 1], [10, 1], [10, 10], [1, 10]], dtype=np.int32) if accepted else None,
        color=(0, 255, 0),
    )


def hit(name, confidence):
    return M2Hit(name=name, confidence=confidence, polygon=np.zeros((4, 2), dtype=np.float32), class_id={"cap": 0, "label": 1, "ring": 2}[name])


def feed(workflow, m1_value, m2_by_frame=(), start=0.0):
    step = None
    for index in range(workflow.window_size):
        step = workflow.update(PreviewEvidence(m1_value, tuple(m2_by_frame[index]) if index < len(m2_by_frame) else ()), start + index)
    return step


def test_workers_begin_before_either_is_released_and_one_frame_is_one_pair():
    barrier = threading.Barrier(2)
    calls = []

    class M1:
        def run_preview(self, frame, conf):
            calls.append(("m1", id(frame), conf))
            barrier.wait(timeout=2)
            return m1("PET", 0.9, True)

    class M2:
        def run_all(self, frame, conf):
            calls.append(("m2", id(frame), conf))
            barrier.wait(timeout=2)
            return [hit("cap", 0.1)]

    runner = ParallelInferenceRunner(M1(), M2())
    try:
        evidence = runner.infer(np.zeros((20, 20, 3), dtype=np.uint8), 0.05, 0.1)
    finally:
        runner.close()
    assert {call[0] for call in calls} == {"m1", "m2"}
    assert len(calls) == 2
    assert calls[0][1] != calls[1][1]
    assert evidence.m1.label == "PET"
    assert len(evidence.m2_hits) == 1


def test_aluminum_quorum_without_model2_flag_returns_preview_zero():
    workflow = ParallelPreviewWorkflow()
    step = feed(workflow, m1("ALUMINUM", 0.9, True))
    assert step.result == "ALUMINUM"
    assert step.preview_signal == 0


def test_pet_with_no_bad_frames_returns_good_pet_signal_one():
    workflow = ParallelPreviewWorkflow()
    step = feed(workflow, m1("PET", 0.8, True))
    assert step.result == "GOOD PET"
    assert step.preview_signal == 1


@pytest.mark.parametrize("name,confidence", [("cap", 0.51), ("label", 0.50), ("ring", 0.30)])
def test_model2_threshold_hit_returns_bad_on_the_first_pet_frame(name, confidence):
    workflow = ParallelPreviewWorkflow(m2_thresholds={"cap": 0.5, "label": 0.5, "ring": 0.3})
    step = workflow.update(PreviewEvidence(m1("PET", 0.9, True), (hit(name, confidence),)), 0.0)
    assert step.result == "BAD PET"
    assert step.preview_signal == 2
    assert step.progress == 1


def test_model2_threshold_hit_does_not_override_an_aluminum_vote():
    workflow = ParallelPreviewWorkflow()
    step = feed(workflow, m1("ALUMINUM", 0.95, True), [[hit("cap", 0.8)]] * 3)
    assert step.result == "ALUMINUM"
    assert step.preview_signal == 0


def test_ring_uses_point_three_threshold_while_cap_and_label_remain_point_five():
    thresholds = {"cap": 0.5, "label": 0.5, "ring": 0.3}
    ring_workflow = ParallelPreviewWorkflow(m2_thresholds=thresholds)
    ring_step = ring_workflow.update(PreviewEvidence(m1("PET", 0.8, True), (hit("ring", 0.31),)), 0.0)
    assert ring_step.result == "BAD PET"

    cap_workflow = ParallelPreviewWorkflow(m2_thresholds=thresholds)
    cap_step = feed(cap_workflow, m1("PET", 0.8, True), [[hit("cap", 0.31)]] * 4)
    assert cap_step.result == "GOOD PET"


def test_m2_hits_anywhere_are_counted_and_missing_classes_average_zero():
    workflow = ParallelPreviewWorkflow()
    frames = [[hit("cap", 0.2)], [], [hit("ring", 0.2)]]
    step = feed(workflow, m1("PET", 0.8, True), frames)
    assert step.result == "GOOD PET"
    assert step.m2_averages["cap"] == pytest.approx(0.2 / 3)
    assert round(step.m2_averages["ring"], 8) == round(0.2 / 3, 8)


def test_missing_m1_abstains_and_no_decision_occurs_before_three_frames():
    workflow = ParallelPreviewWorkflow()
    for index in range(2):
        step = workflow.update(PreviewEvidence(m1("PET", 0.9, index == 0)), index)
        assert step.result == ""
    step = workflow.update(PreviewEvidence(m1()), 2)
    assert step.result == ""
    assert step.phase == "READY"


def test_result_averages_freeze_then_eight_clear_frames_rearm():
    workflow = ParallelPreviewWorkflow(hold_s=1.5, clear_frames=8)
    step = feed(workflow, m1("PET", 0.8, True), [[hit("cap", 0.2)]] + [[]] * 2)
    assert step.m1_average == pytest.approx(0.8)
    assert step.m2_averages["cap"] == pytest.approx(0.2 / 3)
    frozen = workflow.update(PreviewEvidence(m1("PET", 0.99, True), (hit("cap", 0.99),)), 3.0)
    assert frozen.m1_average == pytest.approx(0.8)
    wait_step = workflow.hold_step(4.0)
    assert workflow.phase == "WAIT_CLEAR"
    assert wait_step.phase == "WAIT_CLEAR"
    assert wait_step.result == ""
    assert wait_step.preview_signal is None
    for index in range(8):
        workflow.update_clear(m1(), 10.0 + index)
    assert workflow.phase == "READY"
    assert workflow.last_step.result == ""


def test_good_pet_result_survives_hold_and_rearms_without_a_post_signal_crash():
    workflow = ParallelPreviewWorkflow(hold_s=1.5, clear_frames=8)
    result = feed(workflow, m1("PET", 0.85, True))
    assert result.preview_signal == 1
    for moment in (2.1, 2.7, 3.4):
        assert workflow.hold_step(moment).preview_signal == 1
    wait = workflow.hold_step(3.6)
    assert wait.phase == "WAIT_CLEAR"
    for index in range(3):
        step = workflow.update_clear(m1("PET", 0.85, True), 8.0 + index)
        assert step.phase == "WAIT_CLEAR"
        assert step.progress == 0
    for index in range(8):
        workflow.update_clear(m1(), 12.0 + index)
    assert workflow.phase == "READY"
