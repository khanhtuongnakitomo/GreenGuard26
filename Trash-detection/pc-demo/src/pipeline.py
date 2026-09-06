"""Ultralytics inference for the single-stage M1 detector and conditional M2."""
from __future__ import annotations

from pathlib import Path
from dataclasses import dataclass
from typing import Any

import numpy as np
from ultralytics import YOLO

from config_loader import resolve_path
from gate import M1FrameResult, M2Hit, M2_NAMES, center_in_poly, pick_top1_per_class

DEVICE = "cpu"
M1_CLASS_NAMES = {0: "metal_can", 1: "pet_bottle"}
DISPLAY = {
    "pet": ("PET bottle", (255, 80, 0)),
    "can": ("Aluminum can", (0, 255, 0)),
}


@dataclass(frozen=True)
class M1DetectionTrace:
    """Non-public diagnostic evidence for one Model 1 frame."""

    reason: str
    raw_detections: tuple[dict[str, Any], ...]
    selected: dict[str, Any] | None
    model_path: str
    decision_conf: float
    min_area_frac: float
    frame_shape: tuple[int, int]
    inference_ms: float


def _decision_conf(det_cfg: dict[str, Any]) -> float:
    if "decision_conf" in det_cfg:
        return float(det_cfg["decision_conf"])
    # Main's old configuration exposed one candidate floor. Keep it readable,
    # but make the fallback explicit so callers can migrate safely.
    return float(det_cfg.get("conf", 0.05))


def onnx_imgsz(path: Path) -> int | None:
    try:
        import onnxruntime as ort

        session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        size = session.get_inputs()[0].shape[2]
        return int(size) if isinstance(size, int) else None
    except Exception:
        return None


def box_area(poly: np.ndarray) -> float:
    xs, ys = poly[:, 0], poly[:, 1]
    return float((xs.max() - xs.min()) * (ys.max() - ys.min()))


def xyxy_to_poly(box: np.ndarray) -> np.ndarray:
    x1, y1, x2, y2 = [float(value) for value in box]
    return np.asarray([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32)


def pick_top1_detector(polys, clss, confs, min_area_frac: float, frame_area: int, allowed_ids: set[int]):
    best_i, best_cf = -1, -1.0
    min_area = frame_area * min_area_frac
    for i, (poly, cls, cf) in enumerate(zip(polys, clss, confs)):
        if int(cls) not in allowed_ids:
            continue
        if box_area(poly) < min_area:
            continue
        if float(cf) > best_cf:
            best_cf, best_i = float(cf), i
    if best_i < 0:
        return None, 0.0, -1
    return polys[best_i], best_cf, best_i


class M1Pipeline:
    def __init__(self, cfg: dict):
        det_cfg = cfg["m1"]["detector"]
        self.det_path = resolve_path(det_cfg["path"])
        self.det_imgsz = onnx_imgsz(self.det_path) or int(det_cfg.get("imgsz", 416))
        self.infer_conf = float(det_cfg.get("infer_conf", det_cfg.get("conf", 0.05)))
        self.decision_conf = _decision_conf(det_cfg)
        self.min_area_frac = float(cfg["m1"].get("min_area_frac", 0.02))
        self.allowed_ids = {int(item) for item in det_cfg.get("visible_class_ids", [0, 1])}
        self.det = YOLO(str(self.det_path), task="detect")

    def reset_vote(self) -> None:
        return None

    def run(self, frame: np.ndarray, det_conf: float | None = None) -> M1FrameResult:
        conf = self.infer_conf if det_conf is None else det_conf
        h, w = frame.shape[:2]
        result = self.det.predict(frame, imgsz=self.det_imgsz, conf=conf, device=DEVICE, verbose=False)[0]
        if result.boxes is None or not len(result.boxes):
            return M1FrameResult()

        boxes = result.boxes.xyxy.cpu().numpy()
        clss = result.boxes.cls.cpu().numpy().astype(int)
        confs = result.boxes.conf.cpu().numpy()
        polys = np.asarray([xyxy_to_poly(box) for box in boxes], dtype=np.float32)
        best = pick_top1_detector(polys, clss, confs, self.min_area_frac, h * w, self.allowed_ids)
        if best[0] is None:
            return M1FrameResult()

        poly, det_cf, best_index = best
        if det_cf < self.decision_conf:
            return M1FrameResult()
        class_id = int(clss[best_index])
        verdict = "pet" if class_id == 1 else "can"
        label, color = DISPLAY[verdict]
        legend = f"{label} {det_cf * 100:.0f}%"
        return M1FrameResult(
            poly=poly.astype(np.int32),
            is_pet=verdict == "pet",
            color=color,
            legend=legend,
        )

    def trace(self, frame: np.ndarray, det_conf: float | None = None) -> M1DetectionTrace:
        """Run one frame and expose rejection reasons without changing routing."""
        import time

        start = time.perf_counter()
        conf = self.infer_conf if det_conf is None else det_conf
        h, w = frame.shape[:2]
        result = self.det.predict(frame, imgsz=self.det_imgsz, conf=conf, device=DEVICE, verbose=False)[0]
        raw: list[dict[str, Any]] = []
        if result.boxes is not None:
            boxes = result.boxes.xyxy.cpu().numpy()
            clss = result.boxes.cls.cpu().numpy().astype(int)
            confs = result.boxes.conf.cpu().numpy()
            for box, class_id, score in zip(boxes, clss, confs):
                x1, y1, x2, y2 = [float(value) for value in box]
                area_frac = max(0.0, (x2 - x1) * (y2 - y1)) / max(float(h * w), 1.0)
                raw.append({
                    "class_id": int(class_id),
                    "class_name": M1_CLASS_NAMES.get(int(class_id), f"unknown_{int(class_id)}"),
                    "confidence": float(score),
                    "xyxy": [x1, y1, x2, y2],
                    "area_frac": area_frac,
                })
        visible = [row for row in raw if row["class_id"] in self.allowed_ids]
        if not visible:
            reason = "NO_DETECTION" if not raw else "IGNORED_CLASS_ONLY"
            selected = None
        else:
            area_ok = [row for row in visible if row["area_frac"] >= self.min_area_frac]
            if not area_ok:
                reason, selected = "AREA_TOO_SMALL", max(visible, key=lambda row: row["confidence"])
            else:
                selected = max(area_ok, key=lambda row: row["confidence"])
                if selected["confidence"] < self.decision_conf:
                    reason = "BELOW_DECISION_CONF"
                else:
                    reason = "ACCEPTED_METAL_CAN" if selected["class_id"] == 0 else "ACCEPTED_PET_BOTTLE"
        return M1DetectionTrace(
            reason=reason,
            raw_detections=tuple(raw),
            selected=selected,
            model_path=str(self.det_path),
            decision_conf=self.decision_conf,
            min_area_frac=self.min_area_frac,
            frame_shape=(h, w),
            inference_ms=(time.perf_counter() - start) * 1000.0,
        )


class M2Pipeline:
    def __init__(self, cfg: dict):
        m2_cfg = cfg["m2"]
        self.path = resolve_path(m2_cfg["path"])
        self.imgsz = onnx_imgsz(self.path) or int(m2_cfg.get("imgsz", 640))
        self.infer_conf = float(m2_cfg.get("infer_conf", 0.10))
        self.model = YOLO(str(self.path), task="obb")

    def run(self, frame: np.ndarray, pet_poly: np.ndarray, infer_conf: float | None = None) -> list[M2Hit]:
        conf = self.infer_conf if infer_conf is None else infer_conf
        result = self.model.predict(frame, imgsz=self.imgsz, conf=conf, device=DEVICE, verbose=False)[0]
        if result.obb is None or not len(result.obb):
            return []
        polys = result.obb.xyxyxyxy.cpu().numpy()
        confs = result.obb.conf.cpu().numpy()
        clss = result.obb.cls.cpu().numpy().astype(int)
        contour = pet_poly.astype(np.float32)
        inside = [
            i
            for i in range(len(polys))
            if center_in_poly(
                (float(polys[i].mean(axis=0)[0]), float(polys[i].mean(axis=0)[1])),
                contour,
            )
        ]
        top = pick_top1_per_class(polys[inside], clss[inside], confs[inside], (0, 1, 2)) if inside else {}
        hits: list[M2Hit] = []
        for ci, ii in top.items():
            poly = polys[inside][ii]
            cf = float(confs[inside][ii])
            hits.append(M2Hit(name=M2_NAMES.get(ci, str(ci)), confidence=cf, polygon=poly.astype(np.float32), class_id=ci))
        return hits
