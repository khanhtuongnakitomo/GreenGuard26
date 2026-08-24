r"""Model 1 two-stage inference: OBB localize -> cls PET vs can (Fix B)."""
from __future__ import annotations

from collections import deque
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DEVICE = "cpu"

DISPLAY = {
    "pet": ("PET bottle", (255, 80, 0)),
    "can": ("Aluminum can", (0, 255, 0)),
}

DET_CANDIDATES = [
    (ROOT / "export" / "onnx_416" / "model.onnx", {0: "bottle", 1: "aluminum"}),
    (ROOT / "runs" / "seed42_n640" / "weights" / "best.pt", {0: "bottle", 1: "aluminum"}),
]

CLS_CANDIDATES = [
    ROOT / "export" / "cls_onnx_224" / "model.onnx",
    ROOT / "runs" / "cls_pet_can_seed42_n224" / "weights" / "best.pt",
]


def onnx_imgsz(path: Path) -> int | None:
    try:
        import onnxruntime as ort
        session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        n = session.get_inputs()[0].shape[2]
        return int(n) if isinstance(n, int) else None
    except Exception:
        return None


def resolve_detector(arg: str = "auto"):
    if arg and arg != "auto":
        return str(arg), None, onnx_imgsz(Path(arg)) if arg.endswith(".onnx") else None
    for path, cmap in DET_CANDIDATES:
        if path.is_file():
            sz = onnx_imgsz(path) if path.suffix == ".onnx" else None
            return str(path), cmap, sz
    raise FileNotFoundError("no Model 1 detector found")


def resolve_classifier(arg: str = "auto"):
    if arg and arg != "auto":
        p = Path(arg)
        return str(p), onnx_imgsz(p) if p.suffix == ".onnx" else 224
    ref = ROOT / "runs" / "cls_pet_can_seed42_n224" / "weights" / "best.pt"
    for path in CLS_CANDIDATES:
        if not path.is_file():
            continue
        if path.suffix == ".onnx" and ref.is_file() and path.stat().st_mtime < ref.stat().st_mtime:
            print(f"STALE EXPORT - skipping classifier {path}")
            continue
        sz = onnx_imgsz(path) if path.suffix == ".onnx" else 224
        return str(path), sz
    raise FileNotFoundError("no PET/can classifier found; run run_classifier_training.ps1")


def crop_from_obb(frame: np.ndarray, poly: np.ndarray, margin: float = 0.10) -> np.ndarray | None:
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


def box_area(poly: np.ndarray) -> float:
    xs, ys = poly[:, 0], poly[:, 1]
    return float((xs.max() - xs.min()) * (ys.max() - ys.min()))


def pick_top1(polys, confs, min_area_frac: float, frame_area: int):
    """Return (poly, det_conf) for highest-confidence box above min area."""
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


def classify_crop(cls_model: YOLO, crop: np.ndarray, imgsz: int) -> tuple[str, float]:
    r = cls_model.predict(crop, imgsz=imgsz, device=DEVICE, verbose=False)[0]
    if r.probs is None:
        return "pet", 0.0
    idx = int(r.probs.top1)
    name = r.names.get(idx, str(idx)).lower()
    if name in {"bottle", "0"}:
        name = "pet"
    elif name in {"aluminum", "1"}:
        name = "can"
    return name, float(r.probs.top1conf)


class PetCanDecider:
    """Detector localizes; classifier decides pet vs can with optional vote."""

    def __init__(
        self,
        det_path: str = "auto",
        cls_path: str = "auto",
        det_imgsz: int = 416,
        det_conf: float = 0.05,
        min_area_frac: float = 0.02,
        vote_frames: int = 5,
    ):
        det_p, _, det_onnx_sz = resolve_detector(det_path)
        cls_p, cls_sz = resolve_classifier(cls_path)
        self.det = YOLO(det_p, task="obb" if det_p.endswith(".onnx") else None)
        self.cls = YOLO(cls_p, task="classify")
        self.det_imgsz = det_onnx_sz or det_imgsz
        self.cls_imgsz = cls_sz
        self.det_conf = det_conf
        self.min_area_frac = min_area_frac
        self.vote_frames = vote_frames
        self._votes: deque[str] = deque(maxlen=vote_frames)
        print(f"[m1 two-stage] detector={det_p} imgsz={self.det_imgsz}")
        print(f"[m1 two-stage] classifier={cls_p} imgsz={self.cls_imgsz}")

    def reset_vote(self) -> None:
        self._votes.clear()

    def run(self, frame: np.ndarray) -> dict:
        """Returns dict with keys: label, color, legend_text, poly, det_conf, cls_conf, voted."""
        h, w = frame.shape[:2]
        r = self.det.predict(
            frame, imgsz=self.det_imgsz, conf=self.det_conf, device=DEVICE, verbose=False
        )[0]
        if r.obb is None or not len(r.obb):
            self._votes.clear()
            return {"label": None}

        polys = r.obb.xyxyxyxy.cpu().numpy()
        confs = r.obb.conf.cpu().numpy()
        poly, det_cf = pick_top1(polys, confs, self.min_area_frac, h * w)
        if poly is None:
            self._votes.clear()
            return {"label": None}

        crop = crop_from_obb(frame, poly)
        if crop is None:
            self._votes.clear()
            return {"label": None}

        cls_name, cls_cf = classify_crop(self.cls, crop, self.cls_imgsz)
        self._votes.append(cls_name)
        voted = max(set(self._votes), key=self._votes.count)
        label, color = DISPLAY.get(voted, (voted, (200, 200, 200)))
        legend = f"{label} {cls_cf * 100:.0f}% (det {det_cf * 100:.0f}%)"
        if len(self._votes) > 1 and voted != cls_name:
            legend += f" vote={voted}"
        return {
            "label": voted,
            "display": label,
            "color": color,
            "legend_text": legend,
            "poly": poly.astype(np.int32),
            "det_conf": det_cf,
            "cls_conf": cls_cf,
            "voted": voted,
        }
