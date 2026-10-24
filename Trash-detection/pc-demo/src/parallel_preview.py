"""Isolated two-model inference and preview-only three-confirmation workflow."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any

from gate import M2Hit


@dataclass(frozen=True)
class PreviewEvidence:
    m1: Any
    m2_hits: tuple[M2Hit, ...] = ()


@dataclass(frozen=True)
class PreviewStep:
    phase: str
    m1: Any = None
    m2_hits: tuple[M2Hit, ...] = ()
    result: str = ""
    preview_signal: int | None = None
    progress: int = 0
    m1_average: float | None = None
    m2_averages: dict[str, float] = field(default_factory=dict)
    new_result: bool = False
    detail: str = ""


class ParallelInferenceRunner:
    """Two one-worker executors; one submitted job per model per frame."""

    def __init__(self, m1_pipeline, m2_pipeline):
        self.m1_pipeline = m1_pipeline
        self.m2_pipeline = m2_pipeline
        self._m1_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="preview-m1")
        self._m2_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="preview-m2")
        self._closed = False

    def infer(self, frame, m1_conf=None, m2_conf=None) -> PreviewEvidence:
        if self._closed:
            raise RuntimeError("parallel preview workers are closed")
        m1_frame = frame.copy()
        m2_frame = frame.copy()
        m1_future = self._m1_executor.submit(self.m1_pipeline.run_preview, m1_frame, m1_conf)
        m2_future = self._m2_executor.submit(self.m2_pipeline.run_all, m2_frame, m2_conf)
        # Waiting in this order does not serialize execution: both futures were
        # submitted before either result is released.
        return PreviewEvidence(m1=m1_future.result(), m2_hits=tuple(m2_future.result()))

    def infer_m1(self, frame, m1_conf=None):
        if self._closed:
            raise RuntimeError("parallel preview workers are closed")
        return self._m1_executor.submit(self.m1_pipeline.run_preview, frame.copy(), m1_conf).result()

    def close(self) -> None:
        if not self._closed:
            self._m1_executor.shutdown(wait=True, cancel_futures=True)
            self._m2_executor.shutdown(wait=True, cancel_futures=True)
            self._closed = True


class ParallelPreviewWorkflow:
    """Preview-only state machine; it never creates a production signal event."""

    def __init__(
        self,
        window_size=3,
        quorum=3,
        hold_s=1.5,
        clear_frames=8,
        m2_threshold=0.5,
        m2_thresholds=None,
    ):
        self.window_size = int(window_size)
        self.quorum = int(quorum)
        self.hold_s = float(hold_s)
        self.clear_frames = int(clear_frames)
        self.m2_threshold = float(m2_threshold)
        configured = m2_thresholds if isinstance(m2_thresholds, dict) else {}
        self.m2_thresholds = {
            name: float(configured.get(name, self.m2_threshold))
            for name in ("cap", "label", "ring")
        }
        self.reset()

    def reset(self) -> None:
        self.phase = "READY"
        self._observations: list[PreviewEvidence] = []
        self._result = ""
        self._signal = None
        self._hold_until = 0.0
        self._clear_count = 0
        self._frozen: PreviewStep | None = None
        self.last_step = PreviewStep(phase="READY")

    pause = reset

    @staticmethod
    def _m1_accepted(m1) -> bool:
        return bool(getattr(m1, "accepted", getattr(m1, "poly", None) is not None))

    @staticmethod
    def _m1_kind(m1) -> str:
        label = str(getattr(m1, "label", ""))
        if label:
            return "PET" if "PET" in label.upper() else "ALUMINUM"
        return "PET" if bool(getattr(m1, "is_pet", False)) else "ALUMINUM"

    def _step(self, **kwargs) -> PreviewStep:
        step = PreviewStep(phase=self.phase, **kwargs)
        self.last_step = step
        return step

    def _live_step(self, evidence: PreviewEvidence) -> PreviewStep:
        m1 = evidence.m1
        values = {"cap": 0.0, "label": 0.0, "ring": 0.0}
        for hit in evidence.m2_hits:
            if hit.name in values:
                values[hit.name] = float(hit.confidence)
        return self._step(
            m1=m1,
            m2_hits=evidence.m2_hits,
            progress=len(self._observations),
            detail="accepted" if self._m1_accepted(m1) else "below threshold / abstain",
            m2_averages=values,
        )

    def _m2_hit_is_bad(self, hit: M2Hit) -> bool:
        return float(hit.confidence) >= self.m2_thresholds.get(hit.name, self.m2_threshold)

    def _m2_averages(self) -> dict[str, float]:
        count = max(len(self._observations), 1)
        return {
            name: sum(
                max((float(hit.confidence) for hit in item.m2_hits if hit.name == name), default=0.0)
                for item in self._observations
            ) / count
            for name in ("cap", "label", "ring")
        }

    def _finish_result(
        self,
        winner: str,
        evidence: PreviewEvidence,
        now: float,
        *,
        m1_average: float | None,
        detail: str,
    ) -> PreviewStep:
        self._result = winner
        self._signal = {"ALUMINUM": 0, "GOOD PET": 1, "BAD PET": 2}[winner]
        self.phase = "RESULT"
        self._hold_until = now + self.hold_s
        self._frozen = PreviewStep(
            phase="RESULT",
            m1=evidence.m1,
            m2_hits=evidence.m2_hits,
            result=winner,
            preview_signal=self._signal,
            progress=len(self._observations),
            m1_average=m1_average,
            m2_averages=self._m2_averages(),
            new_result=True,
            detail=detail,
        )
        self.last_step = self._frozen
        return self._frozen

    def update(self, evidence: PreviewEvidence, now: float) -> PreviewStep:
        if self.phase == "RESULT":
            if now >= self._hold_until:
                self.phase = "WAIT_CLEAR"
                self._clear_count = 0
            else:
                return self.last_step
        if self.phase == "WAIT_CLEAR":
            return self.last_step
        self.phase = "VOTING"
        self._observations.append(evidence)
        live = self._live_step(evidence)
        # Model 2 runs alongside Model 1 and may reject a PET immediately.
        # Aluminum still finishes its separate three-vote path.
        is_pet_frame = self._m1_accepted(evidence.m1) and self._m1_kind(evidence.m1) == "PET"
        bad_hit = next((hit for hit in evidence.m2_hits if self._m2_hit_is_bad(hit)), None)
        if is_pet_frame and bad_hit is not None:
            return self._finish_result(
                "BAD PET",
                evidence,
                now,
                m1_average=float(getattr(evidence.m1, "confidence", 0.0)),
                detail=f"Model 2 {bad_hit.name} reached threshold",
            )
        if len(self._observations) < self.window_size:
            return live

        m1_votes = [self._m1_kind(item.m1) for item in self._observations if self._m1_accepted(item.m1)]
        aluminum = m1_votes.count("ALUMINUM")
        pet = m1_votes.count("PET")
        winner = ""
        if aluminum >= self.quorum:
            winner = "ALUMINUM"
        elif pet >= self.quorum:
            winner = "GOOD PET"
        if not winner:
            self.phase = "READY"
            self._observations.clear()
            return self._step(progress=0, detail="no three-frame quorum")

        bad_hit = next(
            (
                hit
                for item in self._observations
                for hit in item.m2_hits
                if self._m2_hit_is_bad(hit)
            ),
            None,
        ) if winner == "GOOD PET" else None

        winning_obs = [
            item for item in self._observations
            if self._m1_accepted(item.m1) and self._m1_kind(item.m1) == ("ALUMINUM" if winner == "ALUMINUM" else "PET")
        ]
        m1_average = sum(float(getattr(item.m1, "confidence", 0.0)) for item in winning_obs) / len(winning_obs)
        return self._finish_result(
            "BAD PET" if bad_hit is not None else winner,
            evidence,
            now,
            m1_average=m1_average,
            detail=(
                f"Model 2 {bad_hit.name} reached threshold"
                if bad_hit is not None
                else "Model 1 three-frame quorum"
            ),
        )

    def hold_step(self, now: float) -> PreviewStep:
        if self.phase == "RESULT" and now >= self._hold_until:
            self.phase = "WAIT_CLEAR"
            self._clear_count = 0
            return self._step(progress=0, detail=f"remove object — clear 0/{self.clear_frames}")
        return self.last_step

    def update_clear(self, m1, now: float) -> PreviewStep:
        del now
        if self.phase != "WAIT_CLEAR":
            return self.last_step
        if self._m1_accepted(m1):
            self._clear_count = 0
        else:
            self._clear_count += 1
        if self._clear_count >= self.clear_frames:
            self.reset()
            return self.last_step
        return self._step(
            m1=m1,
            progress=self._clear_count,
            detail=f"remove object — clear {self._clear_count}/{self.clear_frames}",
        )
