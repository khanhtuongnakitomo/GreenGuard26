"""Temporal PET gate logic shared with run_live_demo.py semantics."""
from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np


M2_NAMES = {0: "cap", 1: "label", 2: "ring"}
M2_COLORS = {0: (0, 0, 255), 1: (0, 255, 255), 2: (255, 0, 255)}


@dataclass
class M1FrameResult:
    poly: np.ndarray | None = None
    is_pet: bool = False
    color: tuple[int, int, int] = (160, 160, 160)
    legend: str = ""


@dataclass
class M2Hit:
    name: str
    confidence: float
    polygon: np.ndarray
    class_id: int


@dataclass
class GateState:
    vote: deque = field(default_factory=deque)
    held_box: np.ndarray | None = None
    held_is_pet: bool = False
    held_color: tuple[int, int, int] = (160, 160, 160)
    held_legend: str = ""
    miss_frames: int = 0
    pet_since: float | None = None
    locked_verdict: str = ""
    locked_color: tuple[int, int, int] = (160, 160, 160)
    locked_hits: list[tuple[str, float]] = field(default_factory=list)
    locked_until: float = 0.0


def smooth_poly(prev: np.ndarray | None, new: np.ndarray, alpha: float) -> np.ndarray:
    new_f = new.astype(np.float32)
    if prev is None or prev.shape != new_f.shape:
        return new_f
    return (alpha * new_f) + ((1.0 - alpha) * prev.astype(np.float32))


def center_in_poly(center: tuple[float, float], poly: np.ndarray) -> bool:
    return cv2.pointPolygonTest(poly.astype(np.float32), center, False) >= 0


def pick_top1_per_class(polys, clss, confs, classes):
    out = {}
    for c in classes:
        idx = [i for i in range(len(polys)) if int(clss[i]) == c]
        if not idx:
            continue
        out[c] = max(idx, key=lambda i: (float(confs[i]), -i))
    return out


class PetGate:
    """Stateful gate: M1 hold/smooth, PET warmup, M2 vote, verdict hold."""

    def __init__(self, cfg: dict):
        gate = cfg["gate"]
        m1 = cfg["m1"]
        m2 = cfg["m2"]
        self.warmup_s = float(gate["warmup_s"])
        self.verdict_hold_s = float(gate["verdict_hold_s"])
        self.vote_window = int(gate["vote_window"])
        self.vote_need = max(1, min(int(gate["vote_need"]), self.vote_window))
        self.miss_hold = int(m1["miss_hold"])
        self.box_alpha = float(m1["box_smooth"])
        self.m2_infer_conf = float(m2["infer_conf"])
        self.m2_violation_conf = float(m2["violation_conf"])
        self.state = GateState(vote=deque(maxlen=self.vote_window))

    def reset(self) -> None:
        self.state = GateState(vote=deque(maxlen=self.vote_window))

    def update_m1_hold(self, raw: M1FrameResult, now: float | None = None) -> M1FrameResult | None:
        st = self.state
        if raw.poly is not None:
            st.miss_frames = 0
            st.held_box = smooth_poly(st.held_box, raw.poly, self.box_alpha)
            st.held_is_pet = raw.is_pet
            st.held_color = raw.color
            st.held_legend = raw.legend
        elif st.held_box is not None and st.miss_frames < self.miss_hold:
            st.miss_frames += 1
        else:
            st.held_box = None
            st.held_is_pet = False
            st.held_legend = ""
            st.miss_frames = 0
            st.pet_since = None
            st.vote.clear()
            now_val = now if now is not None else time.perf_counter()
            if now_val >= st.locked_until:
                st.locked_verdict = ""
                st.locked_hits = []

        if st.held_box is None:
            return None
        return M1FrameResult(
            poly=st.held_box.astype(np.int32),
            is_pet=st.held_is_pet,
            color=st.held_color,
            legend=st.held_legend,
        )

    def evaluate_pet(
        self,
        frame_result: M1FrameResult,
        m2_hits: list[M2Hit],
        now: float | None = None,
    ) -> dict[str, Any]:
        now_val = now if now is not None else time.perf_counter()
        st = self.state
        verdict = ""
        vcolor = (160, 160, 160)
        legend: list[tuple[str, tuple[int, int, int]]] = []
        gate_active = False

        if frame_result.legend:
            legend.append((frame_result.legend, frame_result.color))

        if not frame_result.is_pet:
            st.pet_since = None
            st.vote.clear()
            if now_val >= st.locked_until:
                st.locked_verdict = ""
                st.locked_hits = []
            return {"verdict": verdict, "color": vcolor, "legend": legend, "gate_active": gate_active, "m2_hits": []}

        if st.pet_since is None:
            st.pet_since = now_val
        gate_active = True
        warm = now_val - st.pet_since
        warming = warm < self.warmup_s

        if st.locked_verdict and now_val < st.locked_until:
            verdict, vcolor = st.locked_verdict, st.locked_color
            for name, cf in st.locked_hits:
                cid = next((k for k, v in M2_NAMES.items() if v == name), None)
                color = M2_COLORS.get(cid, (255, 255, 255))
                legend.append((f"{name} {cf * 100:.0f}%", color))
            return {
                "verdict": verdict,
                "color": vcolor,
                "legend": legend,
                "gate_active": gate_active,
                "m2_hits": [],
            }

        hits: list[tuple[str, float]] = []
        visible: list[M2Hit] = []
        for hit in m2_hits:
            color = M2_COLORS.get(hit.class_id, (255, 255, 255))
            legend.append((f"{hit.name} {hit.confidence * 100:.0f}%", color))
            visible.append(hit)
            if hit.confidence >= self.m2_violation_conf:
                hits.append((hit.name, hit.confidence))

        if warming:
            remain = self.warmup_s - warm
            verdict = f"PET locked — inspecting in {remain:.1f}s"
            vcolor = (0, 200, 255)
            st.vote.clear()
        else:
            st.vote.append("REJECT" if hits else "ACCEPT")
            rejects = st.vote.count("REJECT")
            accepts = st.vote.count("ACCEPT")
            if rejects >= self.vote_need:
                parts = ", ".join(f"{k} {v * 100:.0f}%" for k, v in hits) or "residual"
                verdict = f"PET REJECT — {parts}"
                vcolor = (0, 0, 255)
                st.locked_verdict = verdict
                st.locked_color = vcolor
                st.locked_hits = list(hits)
                st.locked_until = now_val + self.verdict_hold_s
                st.vote.clear()
            elif accepts >= self.vote_need:
                verdict = "PET ACCEPT (no cap/label/ring)"
                vcolor = (0, 200, 0)
                st.locked_verdict = verdict
                st.locked_color = vcolor
                st.locked_hits = []
                st.locked_until = now_val + self.verdict_hold_s
                st.vote.clear()
            else:
                verdict = f"judging... {rejects}R/{accepts}A need {self.vote_need}/{self.vote_window}"

        return {
            "verdict": verdict,
            "color": vcolor,
            "legend": legend,
            "gate_active": gate_active,
            "m2_hits": visible,
        }
