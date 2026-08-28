"""Two-model detection pipeline for Jetson (Python 3.6)."""
import os

import cv2
import numpy as np

from config_loader import resolve_path
from gate import M1FrameResult, M2Hit, M2_NAMES
from postprocess import center_in_poly, decode_detect, decode_obb, pick_top1_detector, pick_top1_per_class
from preprocess import blob_from_bgr


DISPLAY = {
    "pet": ("PET bottle", (255, 80, 0)),
    "can": ("Aluminum can", (0, 255, 0)),
}


def read_labels(path):
    if not os.path.isfile(path):
        return []
    with open(path, "r") as handle:
        return [line.strip() for line in handle.readlines() if line.strip()]


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
        self.det = ModelRunner(
            m1["detector"]["path"],
            m1["detector"]["engine"],
            det_labels,
            int(m1["detector"]["imgsz"]),
            backend_mode,
        )
        self.det_conf = float(m1["detector"].get("conf", 0.05))
        self.min_area_frac = float(m1.get("min_area_frac", 0.02))
        self.visible_ids = set(int(value) for value in m1["detector"].get("visible_class_ids", [0, 1]))

    def reset_vote(self):
        return None

    def close(self):
        self.det.close()

    def run(self, frame, det_conf=None):
        conf = self.det_conf if det_conf is None else det_conf
        h, w = frame.shape[:2]
        blob, ratio, pad = blob_from_bgr(frame, self.det.imgsz)
        out = self.det.backend.run(blob)
        dets = decode_detect(out, self.det.labels, conf, ratio, pad, self.visible_ids)
        best = pick_top1_detector(dets, self.min_area_frac, h * w)
        if best is None:
            return M1FrameResult()
        poly = best.polygon.astype(np.int32)
        verdict = "pet" if best.class_id == 1 else "can"
        label, color = DISPLAY.get(verdict, (verdict, (200, 200, 200)))
        legend = "%s %.0f%%" % (label, best.confidence * 100)
        return M1FrameResult(poly=poly, is_pet=(verdict == "pet"), color=color, legend=legend)


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
