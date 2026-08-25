"""Three-model detection pipeline for Jetson (Python 3.6)."""
import os
from collections import deque

import cv2
import numpy as np

from config_loader import resolve_path
from gate import M1FrameResult, M2Hit, M2_NAMES
from postprocess import center_in_poly, decode_obb, pick_top1_detector, pick_top1_per_class
from preprocess import blob_from_bgr, classifier_blob_from_bgr


DISPLAY = {
    "pet": ("PET bottle", (255, 80, 0)),
    "can": ("Aluminum can", (0, 255, 0)),
}


def read_labels(path):
    if not os.path.isfile(path):
        return []
    with open(path, "r") as handle:
        return [line.strip() for line in handle.readlines() if line.strip()]


def crop_from_obb(frame, poly, margin):
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


def classify_logits(logits, labels):
    scores = np.asarray(logits, dtype=np.float64).reshape(-1)
    # Softmax for numerical stability (Ultralytics classify postprocess)
    scores = scores - scores.max()
    exp = np.exp(scores)
    probs = exp / (exp.sum() + 1e-12)
    idx = int(probs.argmax())
    raw = labels[idx].lower() if idx < len(labels) else str(idx)
    if raw in ("bottle", "0", "pet"):
        name = "pet"
    elif raw in ("aluminum", "1", "can"):
        name = "can"
    else:
        name = raw
    conf = float(probs[idx])
    return name, conf


class ModelRunner(object):
    def __init__(self, onnx_path, engine_path, labels, imgsz, backend_mode="auto"):
        self.onnx_path = resolve_path(onnx_path)
        self.engine_path = resolve_path(engine_path)
        self.labels = labels
        self.imgsz = imgsz
        self.backend = None
        self.backend_name = "none"
        self._open_backend(backend_mode)

    def _open_backend(self, backend_mode):
        from backends.onnx_backend import OnnxBackend

        if backend_mode in ("auto", "tensorrt"):
            try:
                from backends.tensorrt_backend import TensorRTBackend, engine_is_valid

                if engine_is_valid(self.engine_path, self.onnx_path):
                    self.backend = TensorRTBackend(self.engine_path, onnx_path=self.onnx_path)
                    self.backend_name = "tensorrt"
                    return
                if backend_mode == "tensorrt":
                    raise RuntimeError(
                        "TensorRT engine invalid or missing: %s" % self.engine_path
                    )
                print("[pipeline] TensorRT engine invalid/missing; trying ONNX")
            except Exception as exc:
                if backend_mode == "tensorrt":
                    raise
                print("[pipeline] TensorRT unavailable: %s" % exc)
        if backend_mode in ("auto", "onnx"):
            self.backend = OnnxBackend(self.onnx_path)
            self.backend_name = "onnx"
            return
        raise RuntimeError("no backend available for %s" % self.onnx_path)

    def close(self):
        if self.backend is not None:
            self.backend.close()
            self.backend = None


class M1Pipeline(object):
    def __init__(self, cfg, backend_mode="auto"):
        m1 = cfg["m1"]
        root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "labels")
        det_labels = read_labels(os.path.join(root, "m1_detector.txt"))
        cls_labels = read_labels(os.path.join(root, "m1_classifier.txt"))
        self.det = ModelRunner(
            m1["detector"]["path"],
            m1["detector"]["engine"],
            det_labels,
            int(m1["detector"]["imgsz"]),
            backend_mode,
        )
        self.cls = ModelRunner(
            m1["classifier"]["path"],
            m1["classifier"]["engine"],
            cls_labels,
            int(m1["classifier"]["imgsz"]),
            backend_mode,
        )
        self.det_conf = float(m1["detector"].get("conf", 0.05))
        self.min_area_frac = float(m1.get("min_area_frac", 0.02))
        self.crop_margin = float(m1.get("crop_margin", 0.10))
        self.vote_frames = int(m1.get("vote_frames", 7))
        self._votes = deque(maxlen=self.vote_frames)

    def reset_vote(self):
        self._votes.clear()

    def close(self):
        self.det.close()
        self.cls.close()

    def run(self, frame, det_conf=None):
        conf = self.det_conf if det_conf is None else det_conf
        h, w = frame.shape[:2]
        blob, ratio, pad = blob_from_bgr(frame, self.det.imgsz)
        out = self.det.backend.run(blob)
        dets = decode_obb(out, self.det.labels, conf, ratio, pad)
        best = pick_top1_detector(dets, self.min_area_frac, h * w)
        if best is None:
            self._votes.clear()
            return M1FrameResult()
        poly = best.polygon.astype(np.int32)
        crop = crop_from_obb(frame, poly, self.crop_margin)
        if crop is None:
            self._votes.clear()
            return M1FrameResult()
        cls_blob = classifier_blob_from_bgr(crop, self.cls.imgsz)
        cls_out = self.cls.backend.run(cls_blob)
        cls_name, cls_cf = classify_logits(cls_out, self.cls.labels)
        self._votes.append(cls_name)
        voted = max(set(self._votes), key=self._votes.count)
        label, color = DISPLAY.get(voted, (voted, (200, 200, 200)))
        legend = "%s %.0f%% (det %.0f%%)" % (label, cls_cf * 100, best.confidence * 100)
        if len(self._votes) > 1 and voted != cls_name:
            legend += " vote=%s" % voted
        return M1FrameResult(poly=poly, is_pet=(voted == "pet"), color=color, legend=legend)


class M2Pipeline(object):
    def __init__(self, cfg, backend_mode="auto"):
        m2 = cfg["m2"]
        root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "labels")
        labels = read_labels(os.path.join(root, "m2_obb.txt"))
        self.runner = ModelRunner(
            m2["path"],
            m2["engine"],
            labels,
            int(m2["imgsz"]),
            backend_mode,
        )
        self.infer_conf = float(m2.get("infer_conf", 0.10))

    def close(self):
        self.runner.close()

    def run(self, frame, pet_poly, infer_conf=None):
        conf = self.infer_conf if infer_conf is None else infer_conf
        blob, ratio, pad = blob_from_bgr(frame, self.runner.imgsz)
        out = self.runner.backend.run(blob)
        dets = decode_obb(out, self.runner.labels, conf, ratio, pad)
        contour = pet_poly.astype(np.float32)
        inside = [
            d
            for d in dets
            if center_in_poly(
                (float(d.polygon.mean(axis=0)[0]), float(d.polygon.mean(axis=0)[1])),
                contour,
            )
        ]
        top = pick_top1_per_class(inside, (0, 1, 2))
        hits = []
        for ci, det in top.items():
            hits.append(
                M2Hit(
                    M2_NAMES.get(ci, str(ci)),
                    det.confidence,
                    det.polygon.astype(np.float32),
                    ci,
                )
            )
        return hits
