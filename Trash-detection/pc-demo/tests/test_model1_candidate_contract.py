"""Contracts for the isolated Model 1 challenger and A/B diagnostic."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from compare_model1 import VoteState  # noqa: E402


def test_vote_requires_exactly_seven_observations_and_four_votes():
    vote = VoteState()
    for _ in range(4):
        assert vote.consume(0) is None
    assert len(vote.observations) == 4
    assert vote.completed_windows == 0
    assert vote.consume(1) is None
    assert vote.consume(None) is None
    assert vote.consume(0) == "metal_can"
    assert len(vote.observations) == 7
    assert vote.completed_windows == 1
    assert vote.waiting_clear is True


def test_vote_rearms_only_after_eight_clear_observations():
    vote = VoteState()
    for class_id in [1, 1, 1, 1, 0, None, None]:
        vote.consume(class_id)
    assert vote.result == "pet_bottle"
    assert vote.waiting_clear
    for _ in range(7):
        assert vote.consume(None) is None
        assert vote.waiting_clear
    vote.consume(None)
    assert vote.waiting_clear is False
    assert vote.observations == []
    assert vote.consume(1) is None


def test_candidate_config_is_isolated_from_active_config():
    active = json.loads((ROOT / "config" / "default.json").read_text(encoding="utf-8"))
    candidate = json.loads((ROOT / "config" / "m1_candidate.json").read_text(encoding="utf-8"))
    assert active["m1"]["detector"]["path"] != candidate["m1"]["detector"]["path"]
    assert candidate["m1"]["detector"]["candidate_only"] is True
    assert candidate["m1"]["detector"]["classes"] == ["metal_can", "pet_bottle"]
    assert candidate["runtime"]["decision_window"] == 7
    assert candidate["runtime"]["decision_quorum"] == 4


def test_candidate_and_compare_sources_do_not_construct_m2_or_serial():
    candidate_launcher = (ROOT.parent / "demo_model1_candidate.bat").read_text(encoding="utf-8").lower()
    compare_launcher = (ROOT.parent / "compare_model1.bat").read_text(encoding="utf-8").lower()
    compare_source = (SRC / "compare_model1.py").read_text(encoding="utf-8").lower()
    assert "serial" not in candidate_launcher
    assert "serial" not in compare_launcher
    assert "m2pipeline" not in compare_source
    assert "serial_transport" not in compare_source


def test_efficient_config_has_balanced_four_thousand_ninety_six_draw_epoch():
    config_path = ROOT.parent / "training" / "model1" / "config" / "m1_machine_efficient_finetune.yaml"
    import yaml

    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    quotas = config["replay"]["quotas"]
    assert sum(int(value) for value in quotas.values()) == 4096
    assert quotas["new_can"] == 64
    assert quotas["new_pet"] == 192
    assert quotas["negative"] == 64
    assert config["publication"]["candidate_only"] is True
    assert config["training"]["resume"] is False
