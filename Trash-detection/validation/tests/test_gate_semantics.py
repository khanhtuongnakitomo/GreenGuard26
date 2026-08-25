"""Unit tests for temporal gate semantics."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import numpy as np
import pytest

PC_SRC = Path(__file__).resolve().parents[2] / "pc-demo" / "src"
if str(PC_SRC) not in sys.path:
    sys.path.insert(0, str(PC_SRC))

from gate import M1FrameResult, M2Hit, PetGate  # noqa: E402


@pytest.fixture
def gate_cfg():
    return {
        "gate": {"warmup_s": 0.5, "verdict_hold_s": 1.5, "vote_window": 7, "vote_need": 4},
        "m1": {"miss_hold": 3, "box_smooth": 0.35},
        "m2": {"infer_conf": 0.10, "violation_conf": 0.50},
    }


def test_can_skips_m2(gate_cfg):
    gate = PetGate(gate_cfg)
    raw = M1FrameResult(poly=np.array([[0, 0], [10, 0], [10, 10], [0, 10]]), is_pet=False, legend="can")
    held = gate.update_m1_hold(raw, now=0.0)
    result = gate.evaluate_pet(held, [], now=0.0)
    assert result["verdict"] == ""
    assert result["gate_active"] is False


def test_warmup_blocks_verdict(gate_cfg):
    gate = PetGate(gate_cfg)
    poly = np.array([[100, 100], [200, 100], [200, 300], [100, 300]], dtype=np.int32)
    held = gate.update_m1_hold(M1FrameResult(poly=poly, is_pet=True, legend="pet"), now=0.0)
    hits = [M2Hit("cap", 0.9, poly.astype(np.float32), 0)]
    result = gate.evaluate_pet(held, hits, now=0.1)
    assert "inspecting" in result["verdict"]


def test_vote_accept_after_warmup(gate_cfg):
    gate = PetGate(gate_cfg)
    poly = np.array([[100, 100], [200, 100], [200, 300], [100, 300]], dtype=np.int32)
    held = gate.update_m1_hold(M1FrameResult(poly=poly, is_pet=True, legend="pet"), now=0.0)
    gate.evaluate_pet(held, [], now=0.0)  # starts warmup clock
    result = None
    for i in range(4):
        result = gate.evaluate_pet(held, [], now=0.6 + i * 0.01)
    assert result is not None
    assert "ACCEPT" in result["verdict"]


def test_vote_reject_on_violation(gate_cfg):
    gate = PetGate(gate_cfg)
    poly = np.array([[100, 100], [200, 100], [200, 300], [100, 300]], dtype=np.int32)
    held = gate.update_m1_hold(M1FrameResult(poly=poly, is_pet=True, legend="pet"), now=0.0)
    hit = M2Hit("cap", 0.9, poly.astype(np.float32), 0)
    gate.evaluate_pet(held, [hit], now=0.0)  # starts warmup clock
    result = None
    for i in range(4):
        result = gate.evaluate_pet(held, [hit], now=0.6 + i * 0.01)
    assert result is not None
    assert "REJECT" in result["verdict"]


def test_miss_hold(gate_cfg):
    gate = PetGate(gate_cfg)
    poly = np.array([[0, 0], [10, 0], [10, 10], [0, 10]], dtype=np.int32)
    gate.update_m1_hold(M1FrameResult(poly=poly, is_pet=True), now=0.0)
    held = gate.update_m1_hold(M1FrameResult(), now=0.01)
    assert held is not None
    held = gate.update_m1_hold(M1FrameResult(), now=0.02)
    held = gate.update_m1_hold(M1FrameResult(), now=0.03)
    held = gate.update_m1_hold(M1FrameResult(), now=0.04)
    assert held is None
