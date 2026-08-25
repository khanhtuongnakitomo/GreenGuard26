"""Ultralytics inference for M1 two-stage and conditional M2."""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from ultralytics import YOLO

from config_loader import resolve_path
from gate import M1FrameResult, M2Hit, M2_NAMES, center_in_poly, pick_top1_per_class

DEVICE = "cpu"
DISPLAY = {
    "pet": ("PET bottle", (255, 80, 0)),
    "can": ("Aluminum can", (0, 255, 0)),
}


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


def crop_from_obb(frame: np.ndarray, poly: np.ndarray, margin: float) -> np.ndarray | None:
    xs, ys = poly[:, 0], poly[:, 1]
    x1, x2 = float(xs.min()), float(xs.max())
    y1, y2 = float(ys.min()), float(ys.max())
    bw, bh = x2 - x1, y2 - y1
    if bw < 4 or bh < 4:
        return None
    h, w = frame.shape[:2]
    x1 = max(0, int(x1 - bw * margin))
    y1 = max(0, int(y1 - bh * margin))
    x2 = min(w, int(x2 + bw * margin))
    y2 = min(h, int(y2 + bh * margin))
    crop = frame[y1:y2, x1:x2]
    return crop if crop.size else None


def pick_top1_detector(polys, confs, min_area_frac: float, frame_area: int):
    best_i, best_cf = -1, -1.0
    min_area = frame_area * min_area_frac
    for i, (poly, cf) in enumerate(zip(polys, confs)):
        if box_area(poly) < min_area:
            continue
        if float(cf) > best_cf:
            best_cf, best_i = float(cf), i
    if best_i < 0:
        return None, 0.0
    return polys[best_i], best_cf


class M1Pipeline:
    def __init__(self, cfg: dict):
        det_cfg = cfg["m1"]["detector"]
        cls_cfg = cfg["m1"]["classifier"]
        self.det_path = resolve_path(det_cfg["path"])
        self.cls_path = resolve_path(cls_cfg["path"])
        self.det_imgsz = onnx_imgsz(self.det_path) or int(det_cfg.get("imgsz", 416))
        self.cls_imgsz = onnx_imgsz(self.cls_path) or int(cls_cfg.get("imgsz", 224))
        self.det_conf = float(det_cfg.get("conf", 0.05))
        self.min_area_frac = float(cfg["m1"].get("min_area_frac", 0.02))
        self.crop_margin = float(cfg["m1"].get("crop_margin", 0.10))
        self.vote_frames = int(cfg["m1"].get("vote_frames", 7))
        self._votes: deque[str] = deque(maxlen=self.vote_frames)
        self.det = YOLO(str(self.det_path), task="obb")
        self.cls = YOLO(str(self.cls_path), task="classify")

    def reset_vote(self) -> None:
        self._votes.clear()

    def run(self, frame: np.ndarray, det_conf: float | None = None) -> M1FrameResult:
        conf = self.det_conf if det_conf is None else det_conf
        h, w = frame.shape[:2]
        result = self.det.predict(frame, imgsz=self.det_imgsz, conf=conf, device=DEVICE, verbose=False)[0]
        if result.obb is None or not len(result.obb):
            self._votes.clear()
            return M1FrameResult()

        polys = result.obb.xyxyxyxy.cpu().numpy()
        confs = result.obb.conf.cpu().numpy()
        poly, det_cf = pick_top1_detector(polys, confs, self.min_area_frac, h * w)
        if poly is None:
            self._votes.clear()
            return M1FrameResult()

        crop = crop_from_obb(frame, poly, self.crop_margin)
        if crop is None:
            self._votes.clear()
            return M1FrameResult()

        cls_result = self.cls.predict(crop, imgsz=self.cls_imgsz, device=DEVICE, verbose=False)[0]
        if cls_result.probs is None:
            self._votes.clear()
            return M1FrameResult()

        idx = int(cls_result.probs.top1)
        raw = cls_result.names.get(idx, str(idx)).lower()
        if raw in {"bottle", "0", "pet"}:
            cls_name = "pet"
        elif raw in {"aluminum", "1", "can"}:
            cls_name = "can"
        else:
            cls_name = raw
        self._votes.append(cls_name)
        voted = max(set(self._votes), key=self._votes.count)
        label, color = DISPLAY.get(voted, (voted, (200, 200, 200)))
        cls_cf = float(cls_result.probs.top1conf)
        legend = f"{label} {cls_cf * 100:.0f}% (det {det_cf * 100:.0f}%)"
        if len(self._votes) > 1 and voted != cls_name:
            legend += f" vote={voted}"
        return M1FrameResult(
            poly=poly.astype(np.int32),
            is_pet=voted == "pet",
            color=color,
            legend=legend,
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
