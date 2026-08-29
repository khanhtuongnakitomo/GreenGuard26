"""Generate reference outputs for the active PC HBB Model 1 contract."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path(__file__).resolve().parent / "fixtures"
CONTRACTS = Path(__file__).resolve().parent / "contracts"

M1_NAMES = {0: "metal_can", 1: "pet_bottle", 2: "pp_cup"}
M1_VISIBLE_IDS = {0, 1}
M1_INFER_CONF = 0.05
M1_DECISION_CONF = 0.65
M1_MIN_AREA_FRAC = 0.02


def _poly_list(poly: np.ndarray) -> list[list[float]]:
    return poly.astype(float).tolist()


def _xyxy_to_poly(box: np.ndarray) -> np.ndarray:
    x1, y1, x2, y2 = [float(value) for value in box]
    return np.asarray([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32)


def _box_area(poly: np.ndarray) -> float:
    xs, ys = poly[:, 0], poly[:, 1]
    return float((xs.max() - xs.min()) * (ys.max() - ys.min()))


def m1_reference(det_path: Path, image: np.ndarray) -> dict:
    """Return raw and public-selection results for the current HBB M1 path."""
    from ultralytics import YOLO

    det = YOLO(str(det_path), task="detect")
    imgsz = 640 if "640" in det_path.name else 416
    result = det.predict(image, imgsz=imgsz, conf=M1_INFER_CONF, device="cpu", verbose=False)[0]
    out = {
        "detections": 0,
        "raw_detections": 0,
        "candidate_detections": 0,
        "decision_conf": M1_DECISION_CONF,
    }
    if result.boxes is None or not len(result.boxes):
        return out

    boxes = result.boxes.xyxy.cpu().numpy()
    clss = result.boxes.cls.cpu().numpy().astype(int)
    confs = result.boxes.conf.cpu().numpy()
    out["raw_detections"] = len(boxes)
    candidates = []
    frame_area = image.shape[0] * image.shape[1]
    for box, cls, confidence in zip(boxes, clss, confs):
        poly = _xyxy_to_poly(box)
        if int(cls) not in M1_VISIBLE_IDS:
            continue
        if _box_area(poly) < frame_area * M1_MIN_AREA_FRAC:
            continue
        candidates.append((poly, int(cls), float(confidence)))
    out["candidate_detections"] = len(candidates)
    if not candidates:
        return out

    poly, class_id, confidence = max(candidates, key=lambda item: item[2])
    if confidence < M1_DECISION_CONF:
        return out

    out.update(
        {
            "detections": 1,
            "det_class_id": class_id,
            "class_name": M1_NAMES[class_id],
            "confidence": confidence,
            "polygon": _poly_list(poly),
        }
    )
    return out


def m2_reference(m2_path: Path, image: np.ndarray, pet_poly: np.ndarray | None) -> dict:
    if pet_poly is None:
        return {"m2_hits": [], "m2_count": 0}

    from ultralytics import YOLO

    m2 = YOLO(str(m2_path), task="obb")
    imgsz = 640 if "640" in m2_path.name else 416
    result = m2.predict(image, imgsz=imgsz, conf=0.1, device="cpu", verbose=False)[0]
    hits: list[dict] = []
    if result.obb is not None and len(result.obb):
        polys = result.obb.xyxyxyxy.cpu().numpy()
        confs = result.obb.conf.cpu().numpy()
        clss = result.obb.cls.cpu().numpy().astype(int)
        names = {0: "cap", 1: "label", 2: "ring"}
        for poly, confidence, class_id in zip(polys, confs, clss):
            if pet_poly is not None:
                center = poly.mean(axis=0)
                if cv2.pointPolygonTest(
                    pet_poly.astype(np.float32), (float(center[0]), float(center[1])), False
                ) < 0:
                    continue
            hits.append(
                {
                    "class_id": int(class_id),
                    "class_name": names.get(int(class_id), str(int(class_id))),
                    "confidence": float(confidence),
                    "polygon": _poly_list(poly),
                }
            )
    return {"m2_hits": hits, "m2_count": len(hits)}


def resolve_models(models_root: str) -> tuple[Path, Path]:
    root = ROOT / models_root
    return root / "m1_detect_640.onnx", root / "m2_obb_640.onnx"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--models-root", default="pc-demo/models")
    args = parser.parse_args()

    det_path, m2_path = resolve_models(args.models_root)
    if not det_path.is_file() or not m2_path.is_file():
        print(f"ERROR: missing PC models under {det_path.parent}")
        return 1

    contract: dict = {
        "profile": "hbb_dt3_pc",
        "m1_contract": "hbb_dt3_pc",
        "m1_settings": {
            "imgsz": 640,
            "infer_conf": M1_INFER_CONF,
            "decision_conf": M1_DECISION_CONF,
            "min_area_frac": M1_MIN_AREA_FRAC,
            "visible_class_ids": sorted(M1_VISIBLE_IDS),
        },
        "fixtures": {},
    }
    for fixture in sorted(FIXTURES.glob("*.jpg")):
        image = cv2.imread(str(fixture))
        if image is None:
            continue
        m1 = m1_reference(det_path, image)
        pet_poly = np.asarray(m1["polygon"], dtype=np.float32) if m1.get("polygon") else None
        m2 = m2_reference(m2_path, image, pet_poly if m1.get("class_name") == "pet_bottle" else None)
        contract["fixtures"][fixture.name] = {"m1": m1, "m2": m2}
        print(f"{fixture.name}: m1={m1['detections']} raw={m1['raw_detections']} m2={m2['m2_count']}")

    CONTRACTS.mkdir(parents=True, exist_ok=True)
    output = CONTRACTS / "baseline.json"
    output.write_text(json.dumps(contract, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
