"""Generate Ultralytics reference outputs for validation/contracts/baseline.json."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path(__file__).resolve().parent / "fixtures"
CONTRACTS = Path(__file__).resolve().parent / "contracts"
TRAINING = ROOT / "training"


def _poly_list(poly: np.ndarray) -> list[list[float]]:
    return poly.astype(float).tolist()


def m1_reference(det_path: Path, cls_path: Path, image: np.ndarray) -> dict:
    from ultralytics import YOLO

    det = YOLO(str(det_path), task="obb")
    cls = YOLO(str(cls_path), task="classify")
    r = det.predict(image, imgsz=416, conf=0.05, device="cpu", verbose=False)[0]
    out: dict = {"detections": 0}
    if r.obb is None or not len(r.obb):
        return out
    polys = r.obb.xyxyxyxy.cpu().numpy()
    confs = r.obb.conf.cpu().numpy().astype(float)
    clss = r.obb.cls.cpu().numpy().astype(int)
    best = int(np.argmax(confs))
    poly = polys[best]
    xs, ys = poly[:, 0], poly[:, 1]
    x1, x2 = float(xs.min()), float(xs.max())
    y1, y2 = float(ys.min()), float(ys.max())
    crop = image[int(y1) : int(y2), int(x1) : int(x2)]
    if crop.size == 0:
        return out
    cr = cls.predict(crop, imgsz=224, device="cpu", verbose=False)[0]
    cls_name = "pet"
    cls_conf = 0.0
    if cr.probs is not None:
        idx = int(cr.probs.top1)
        name = cr.names.get(idx, str(idx)).lower()
        cls_name = "pet" if name in {"bottle", "0", "pet"} else "can"
        cls_conf = float(cr.probs.top1conf)
    return {
        "detections": 1,
        "det_class_id": int(clss[best]),
        "det_conf": float(confs[best]),
        "cls_name": cls_name,
        "cls_conf": cls_conf,
        "polygon": _poly_list(poly),
    }


def m2_reference(m2_path: Path, image: np.ndarray, pet_poly: np.ndarray | None) -> dict:
    from ultralytics import YOLO

    m2 = YOLO(str(m2_path), task="obb")
    imgsz = 640 if "640" in m2_path.name else 416
    r = m2.predict(image, imgsz=imgsz, conf=0.1, device="cpu", verbose=False)[0]
    hits: list[dict] = []
    if r.obb is not None and len(r.obb):
        polys = r.obb.xyxyxyxy.cpu().numpy()
        confs = r.obb.conf.cpu().numpy()
        clss = r.obb.cls.cpu().numpy().astype(int)
        names = {0: "cap", 1: "label", 2: "ring"}
        for i in range(len(polys)):
            if pet_poly is not None:
                c = polys[i].mean(axis=0)
                if cv2.pointPolygonTest(pet_poly.astype(np.float32), (float(c[0]), float(c[1])), False) < 0:
                    continue
            hits.append(
                {
                    "class_id": int(clss[i]),
                    "class_name": names.get(int(clss[i]), str(int(clss[i]))),
                    "confidence": float(confs[i]),
                    "polygon": _poly_list(polys[i]),
                }
            )
    return {"m2_hits": hits, "m2_count": len(hits)}


def resolve_models(models_root: str | None) -> tuple[Path, Path, Path]:
    if models_root:
        root = ROOT / models_root
        det = root / "m1_detector_416.onnx"
        cls = root / "m1_classifier_224.onnx"
        m2 = root / "m2_obb_640.onnx"
        if not m2.is_file():
            m2 = root / "m2_obb_416.onnx"
        return det, cls, m2
    det = TRAINING / "model1" / "export" / "onnx_416" / "model.onnx"
    cls = TRAINING / "model1" / "export" / "cls_onnx_224" / "model.onnx"
    m2 = TRAINING / "model2" / "export" / "onnx_640" / "model.onnx"
    return det, cls, m2


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models-root", default=None, help="pc-demo/models or jetson-runtime/models")
    args = ap.parse_args()

    det, cls, m2 = resolve_models(args.models_root)
    if not det.is_file() or not cls.is_file() or not m2.is_file():
        print("ERROR: missing ONNX models", file=sys.stderr)
        return 1

    contract: dict = {"source": "ultralytics", "fixtures": {}}
    for name in sorted(FIXTURES.glob("*.jpg")):
        img = cv2.imread(str(name))
        if img is None:
            continue
        m1 = m1_reference(det, cls, img)
        pet_poly = np.array(m1["polygon"], dtype=np.float32) if m1.get("polygon") else None
        m2r = m2_reference(m2, img, pet_poly if m1.get("cls_name") == "pet" else None)
        contract["fixtures"][name.name] = {"m1": m1, "m2": m2r}
        print(f"{name.name}: m1_dets={m1.get('detections',0)} m2_hits={m2r['m2_count']}")

    CONTRACTS.mkdir(parents=True, exist_ok=True)
    out = CONTRACTS / "baseline.json"
    out.write_text(json.dumps(contract, indent=2), encoding="utf-8")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
