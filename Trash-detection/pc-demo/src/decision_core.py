"""Canonical seven-observation decision workflow.

This module is deliberately independent of the UI and serial transport.  The
PC reference demo and the Windows RVM shell both import it, so a change to the
decision contract cannot silently diverge between the two launchers.
"""
from __future__ import annotations

import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Iterable

from gate import M1FrameResult, M2Hit

SIGNAL_ALUMINUM = 0
SIGNAL_GOOD_PET = 1
SIGNAL_BAD_PET = 2
FINAL_SIGNALS = frozenset({SIGNAL_ALUMINUM, SIGNAL_GOOD_PET, SIGNAL_BAD_PET})

M1_ALUMINUM = "ALUMINUM"
M1_PET = "PET"
M2_GOOD = "GOOD"
M2_BAD = "BAD"


@dataclass(frozen=True)
class WindowResult:
    """The immutable result of one complete observation window."""

    observations: tuple[str | None, ...]
    counts: dict[str, int]
    decision: str | None

    @property
    def complete(self) -> bool:
        return True


class ExactWindowVoter:
    """Collect exactly *size* observations before resolving a quorum.

    A quorum is intentionally not an early-exit condition.  Once a window is
    opened every frame consumes one observation, including missing/unknown
    frames represented by ``None``.  This prevents a transient early streak
    from becoming a machine command.
    """

    def __init__(self, labels: Iterable[str], size: int = 7, quorum: int = 4):
        self.labels = frozenset(str(label) for label in labels)
        self.size = int(size)
        self.quorum = int(quorum)
        if self.size <= 0 or not 0 < self.quorum <= self.size:
            raise ValueError("window size/quorum must satisfy 0 < quorum <= size")
        self.reset()

    def reset(self) -> None:
        self._observations: list[str | None] = []
        self._result: WindowResult | None = None

    @property
    def observations(self) -> tuple[str | None, ...]:
        return tuple(self._observations)

    @property
    def complete(self) -> bool:
        return self._result is not None

    @property
    def result(self) -> WindowResult | None:
        return self._result

    def add(self, observation: str | None) -> WindowResult | None:
        if self.complete:
            raise RuntimeError("exact observation window is already complete")
        if observation is not None:
            observation = str(observation).upper()
            if observation not in self.labels:
                raise ValueError(f"unsupported observation: {observation!r}")
        self._observations.append(observation)
        if len(self._observations) != self.size:
            return None
        counts = Counter(value for value in self._observations if value is not None)
        decision = next(
            (label for label in self.labels if counts[label] >= self.quorum),
            None,
        )
        # Sort keys to make diagnostics and serialized tests deterministic.
        self._result = WindowResult(
            observations=tuple(self._observations),
            counts={label: counts[label] for label in sorted(self.labels)},
            decision=decision,
        )
        return self._result


@dataclass
class WorkflowStep:
    """Public, UI-neutral state returned for one camera frame."""

    phase: str
    m1_raw: M1FrameResult | None = None
    m2_hits: list[M2Hit] = field(default_factory=list)
    signal: int | None = None
    result: str = ""
    m1_window: WindowResult | None = None
    m2_window: WindowResult | None = None
    detail: str = ""


class CanonicalWorkflow:
    """M1 seven-frame gate followed by the M2 seven-frame gate.

    ``m1`` and ``m2`` are inference adapters.  They are intentionally passed
    in, which keeps this state machine deterministic in tests and lets both
    the PC and Windows entrypoints use exactly the same implementation.
    """

    def __init__(self, cfg: dict[str, Any], m1, m2):
        self.m1 = m1
        self.m2 = m2
        runtime = cfg.get("runtime", {})
        gate = cfg.get("gate", {})
        m1_cfg = cfg.get("m1", {})
        m2_cfg = cfg.get("m2", {})
        self.window_size = int(runtime.get("decision_window", gate.get("vote_window", 7)))
        self.quorum = int(runtime.get("decision_quorum", gate.get("vote_need", 4)))
        if self.window_size != 7 or self.quorum != 4:
            raise ValueError("the production decision contract requires a 7/4 window")
        self.warmup_s = float(gate.get("warmup_s", 0.5))
        self.m2_violation_conf = float(m2_cfg.get("violation_conf", 0.50))
        self.result_hold_s = float(runtime.get("result_hold_s", gate.get("verdict_hold_s", 1.5)))
        self.clear_frames_needed = int(runtime.get("clear_frames", 8))
        if self.clear_frames_needed < 8:
            raise ValueError("the production re-arm contract requires eight clear frames")
        self.emergency_latched = False
        self._reset_state()

    def _reset_state(self) -> None:
        self.phase = "READY"
        self.m1_vote = ExactWindowVoter((M1_ALUMINUM, M1_PET), self.window_size, self.quorum)
        self.m2_vote = ExactWindowVoter((M2_GOOD, M2_BAD), self.window_size, self.quorum)
        self.signal_emitted = False
        self.signal: int | None = None
        self.result = ""
        self.signal_since = 0.0
        self.clear_frames = 0
        self.warmup_since: float | None = None
        self.last_pet_poly = None
        self.last_step = WorkflowStep("READY")

    def reset(self) -> None:
        """Reset normal workflow state without clearing an emergency stop."""
        if self.emergency_latched:
            self.phase = "EMERGENCY_STOP"
            self.last_step = WorkflowStep("EMERGENCY_STOP", result="EMERGENCY STOP", detail="operator reset required")
            return
        self._reset_state()

    def emergency_stop(self) -> None:
        """Latch a stop until the explicit operator reset path is used."""
        self.emergency_latched = True
        self.phase = "EMERGENCY_STOP"
        self.m1_vote.reset()
        self.m2_vote.reset()
        self.clear_frames = 0
        self.last_step = WorkflowStep("EMERGENCY_STOP", result="EMERGENCY STOP", detail="operator reset required")

    def clear_emergency(self) -> None:
        """Explicitly leave emergency mode, requiring eight clear frames."""
        if not self.emergency_latched:
            return
        self.emergency_latched = False
        self._reset_state()
        self.phase = "WAIT_CLEAR"
        self.clear_frames = 0
        self.last_step = WorkflowStep("WAIT_CLEAR", detail="operator reset; clear item before re-arm")

    def pause_for_clear(self) -> None:
        """Invalidate an in-progress vote when the system is turned off."""
        if self.emergency_latched or self.phase in {"SIGNAL", "EMERGENCY_STOP", "WAIT_CLEAR"}:
            return
        self.m1_vote.reset()
        self.m2_vote.reset()
        self.phase = "WAIT_CLEAR"
        self.clear_frames = 0
        self.warmup_since = None
        self.last_pet_poly = None

    @staticmethod
    def _m1_observation(raw: M1FrameResult | None) -> str | None:
        if raw is None or raw.poly is None:
            return None
        return M1_PET if raw.is_pet else M1_ALUMINUM

    def _emit(self, signal: int, now: float, *, m1_window=None, m2_window=None, detail="") -> WorkflowStep:
        if signal not in FINAL_SIGNALS:
            raise ValueError(f"invalid final signal: {signal!r}")
        if self.signal_emitted:
            return WorkflowStep(self.phase, signal=None, result=self.result, detail="signal already emitted")
        self.signal_emitted = True
        self.signal = signal
        self.result = {
            SIGNAL_ALUMINUM: "ALUMINUM_CAN",
            SIGNAL_GOOD_PET: "PET_CLEAN",
            SIGNAL_BAD_PET: "PET_REJECT",
        }[signal]
        self.signal_since = now
        self.phase = "SIGNAL"
        return WorkflowStep(
            phase=self.phase,
            signal=signal,
            result=self.result,
            m1_window=m1_window,
            m2_window=m2_window,
            detail=detail,
        )

    def _wait_clear(self, now: float, detail: str) -> WorkflowStep:
        self.phase = "WAIT_CLEAR"
        self.clear_frames = 0
        self.warmup_since = None
        self.m1_vote.reset()
        self.m2_vote.reset()
        self.last_pet_poly = None
        self.signal_emitted = False
        self.signal = None
        self.result = ""
        self.signal_since = now
        return WorkflowStep(phase=self.phase, detail=detail)

    def _clear_and_rearm(self, raw: M1FrameResult | None, now: float) -> WorkflowStep:
        if raw is None or raw.poly is None:
            self.clear_frames += 1
            if self.clear_frames >= self.clear_frames_needed:
                self.reset()
                return WorkflowStep("READY", detail="re-armed after eight clear frames")
        else:
            self.clear_frames = 0
        return WorkflowStep("WAIT_CLEAR", m1_raw=raw, detail=f"clear {self.clear_frames}/{self.clear_frames_needed}")

    def _m2_observation(self, raw: M1FrameResult | None, frame) -> tuple[str | None, list[M2Hit]]:
        # A missing M1 track is an abstention, never a clean PET result.
        if raw is None or raw.poly is None or not raw.is_pet:
            return None, []
        hits = self.m2.run(frame, raw.poly)
        bad = any(float(hit.confidence) >= self.m2_violation_conf for hit in hits)
        return (M2_BAD if bad else M2_GOOD), hits

    def update(self, frame, now: float | None = None) -> WorkflowStep:
        now = time.perf_counter() if now is None else float(now)
        if self.emergency_latched:
            step = WorkflowStep("EMERGENCY_STOP", result="EMERGENCY STOP", detail="operator reset required")
            self.last_step = step
            return step
        if self.phase == "SIGNAL":
            if now - self.signal_since < self.result_hold_s:
                return WorkflowStep("SIGNAL", signal=None, result=self.result, detail="result hold")
            self.phase = "WAIT_CLEAR"
            self.clear_frames = 0
        raw = self.m1.run(frame)

        if self.phase == "WAIT_CLEAR":
            step = self._clear_and_rearm(raw, now)
            self.last_step = step
            return step

        if self.phase == "READY":
            if self._m1_observation(raw) is not None:
                self.phase = "M1_VOTING"
                self.m1_vote.add(self._m1_observation(raw))
            step = WorkflowStep(self.phase, m1_raw=raw, detail=f"M1 {len(self.m1_vote.observations)}/{self.window_size}")
            self.last_step = step
            return step

        if self.phase == "M1_VOTING":
            result = self.m1_vote.add(self._m1_observation(raw))
            if raw is not None and raw.poly is not None and raw.is_pet:
                self.last_pet_poly = raw.poly
            if result is None:
                step = WorkflowStep("M1_VOTING", m1_raw=raw, detail=f"M1 {len(self.m1_vote.observations)}/{self.window_size}")
                self.last_step = step
                return step
            if result.decision == M1_ALUMINUM:
                step = self._emit(SIGNAL_ALUMINUM, now, m1_window=result, detail="M1 aluminum quorum")
                step.m1_raw = raw
                self.last_step = step
                return step
            if result.decision != M1_PET:
                step = self._wait_clear(now, "M1 window complete without aluminum/PET quorum")
                step.m1_raw = raw
                step.m1_window = result
                self.last_step = step
                return step
            self.phase = "M2_WARMUP"
            self.warmup_since = now
            self.m2_vote.reset()
            step = WorkflowStep("M2_WARMUP", m1_raw=raw, m1_window=result, detail="PET quorum; Model 2 warmup")
            self.last_step = step
            return step

        if self.phase == "M2_WARMUP":
            if raw is not None and raw.poly is not None and raw.is_pet:
                self.last_pet_poly = raw.poly
            if self.warmup_since is not None and now - self.warmup_since < self.warmup_s:
                step = WorkflowStep("M2_WARMUP", m1_raw=raw, detail="PET quorum; Model 2 warmup")
                self.last_step = step
                return step
            self.phase = "M2_VOTING"

        if self.phase == "M2_VOTING":
            observation, hits = self._m2_observation(raw, frame)
            result = self.m2_vote.add(observation)
            if result is None:
                step = WorkflowStep("M2_VOTING", m1_raw=raw, m2_hits=hits, detail=f"M2 {len(self.m2_vote.observations)}/{self.window_size}")
                self.last_step = step
                return step
            if result.decision == M2_GOOD:
                step = self._emit(SIGNAL_GOOD_PET, now, m2_window=result, detail="M2 good-PET quorum")
            elif result.decision == M2_BAD:
                step = self._emit(SIGNAL_BAD_PET, now, m2_window=result, detail="M2 bad-PET quorum")
            else:
                step = self._wait_clear(now, "M2 window complete without quorum")
                step.m2_window = result
            step.m1_raw = raw
            step.m2_hits = hits
            self.last_step = step
            return step

        raise RuntimeError(f"unknown workflow phase: {self.phase}")
