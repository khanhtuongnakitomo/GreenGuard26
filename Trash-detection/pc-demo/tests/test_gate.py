"""Gate unit tests for pc-demo."""
import sys
from pathlib import Path

import numpy as np
import pytest

SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))

from gate import M1FrameResult, PetGate  # noqa: E402


def test_reset_clears_vote():
    cfg = {
        "gate": {"warmup_s": 0.5, "verdict_hold_s": 1.5, "vote_window": 7, "vote_need": 4},
        "m1": {"miss_hold": 3, "box_smooth": 0.35},
        "m2": {"infer_conf": 0.10, "violation_conf": 0.50},
    }
    gate = PetGate(cfg)
    gate.state.vote.append("REJECT")
    gate.reset()
    assert len(gate.state.vote) == 0
