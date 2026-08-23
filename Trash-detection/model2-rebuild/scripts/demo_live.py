r"""Snapshot demo — Model 2 ONLY (cap / label / ring detector, OBB).

NO live inference: the camera preview runs clean (no model calls). Press **H**
to freeze the frame, run OBB detection ONCE, and show a side-by-side review
(original | annotated). **Q** quits from either mode.

Model auto-pick (first found):
  1. export/onnx_640/model.onnx           — train size (PC)
  2. export/onnx_416/model.onnx           — Jetson deploy size
  3. runs/m2v3_seed42_n640/weights/best.pt

Static ONNX graphs only accept their exported imgsz (read from the graph).

Usage (from model2-rebuild/, via model1 venv):
  ..\model1-rebuild\.venv\Scripts\python.exe scripts\demo_live.py
  ..\model1-rebuild\.venv\Scripts\python.exe scripts\demo_live.py --conf 0.4
  ..\model1-rebuild\.venv\Scripts\python.exe scripts\demo_live.py --source photo.jpg

Keys: H = capture + detect (in review: new capture), Q = quit.
Each capture pair is saved to logs\m2_captures\*_orig.jpg / *_det.jpg.
"""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]

NAMES = {0: "cap", 1: "label", 2: "ring"}
COLORS = {0: (0, 0, 255), 1: (0, 255, 255), 2: (255, 0, 255)}
DEVICE = "cpu"

CANDIDATES = [
    ROOT / "export" / "onnx_640" / "model.onnx",
    ROOT / "export" / "onnx_416" / "model.onnx",
    ROOT / "runs" / "m2v3_seed42_n640" / "weights" / "best.pt",
]


def onnx_imgsz(path: Path) -> int | None:
    try:
        import onnxruntime as ort

        session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        n = session.get_inputs()[0].shape[2]
        return int(n) if isinstance(n, int) else None
    except Exception:
        return None


def resolve_model(arg: str) -> tuple[str, int | None]:
    if arg and arg != "auto":
        p = Path(arg)
        if not p.is_file():
            print(f"ERROR: model not found: {p}")
            raise SystemExit(1)
        print(f"[m2 demo] using model: {p}")
        return str(p), onnx_imgsz(p) if p.suffix == ".onnx" else None
    for path in CANDIDATES:
        if path.is_file():
            print(f"[m2 demo] using model: {path}")
            return str(path), onnx_imgsz(path) if path.suffix == ".onnx" else None
    print("ERROR: no Model 2 found. Looked for:\n  " + "\n  ".join(str(p) for p in CANDIDATES))
    raise SystemExit(1)


def draw_detections(frame: np.ndarray, polys, clss, confs) -> list[tuple[str, tuple]]:
    legend: list[tuple[str, tuple]] = []
    order = sorted(zip(polys, clss, confs), key=lambda t: -float(t[2]))
    for poly, ci, cf in order:
        ci = int(ci)
        name = NAMES.get(ci, str(ci))
        color = COLORS.get(ci, (255, 255, 255))
        cv2.polylines(frame, [poly.astype(np.int32)], True, color, 2)
        x, y = poly.astype(np.int32)[0]
        cv2.putText(frame, f"{name} {float(cf) * 100:.0f}%", (x, max(y - 6, 14)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
        legend.append((f"{name} {float(cf) * 100:.0f}%", color))
    return legend


def draw_legend(frame: np.ndarray, legend: list[tuple[str, tuple]]) -> None:
    x, y, line_h = 10, 12, 28
    overlay = frame.copy()
    w = max((cv2.getTextSize(t, cv2.FONT_HERSHEY_SIMPLEX, 0.65, 2)[0][0] for t, _ in legend),
            default=0) + 20
    cv2.rectangle(overlay, (x - 4, y), (x + w, y + line_h * len(legend) + 4), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.45, frame, 0.55, 0, frame)
    for i, (text, color) in enumerate(legend):
        cv2.putText(frame, text, (x + 4, y + 20 + i * line_h),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2)


def annotate(frame: np.ndarray, result) -> np.ndarray:
    out = frame.copy()
    legend: list[tuple[str, tuple]] = []
    if result.obb is not None and len(result.obb):
        legend = draw_detections(
            out,
            result.obb.xyxyxyxy.cpu().numpy(),
            result.obb.cls.cpu().numpy(),
            result.obb.conf.cpu().numpy(),
        )
    draw_legend(out, legend or [("no cap / label / ring detected", (160, 160, 160))])
    return out


def hstack_review(original: np.ndarray, annotated: np.ndarray,
                  max_w: int = 1600) -> np.ndarray:
    h = min(original.shape[0], annotated.shape[0])
    panels = []
    for img, title in ((original, "ORIGINAL"), (annotated, "DETECTED")):
        p = img[:h]
        cv2.putText(p, title, (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9,
                    (255, 255, 255), 2)
        panels.append(p)
    pair = np.hstack(panels)
    if pair.shape[1] > max_w:
        s = max_w / pair.shape[1]
        pair = cv2.resize(pair, (max_w, int(pair.shape[0] * s)))
    cv2.putText(pair, "H new capture  |  Q quit", (12, pair.shape[0] - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    return pair


def detect_once(model: YOLO, frame: np.ndarray, imgsz: int, conf: float):
    r = model.predict(frame, imgsz=imgsz, conf=conf, device=DEVICE, verbose=False)[0]
    return annotate(frame, r), r


def save_pair(original: np.ndarray, annotated: np.ndarray) -> None:
    d = ROOT / "logs" / "m2_captures"
    d.mkdir(parents=True, exist_ok=True)
    stem = datetime.now().strftime("%Y%m%d_%H%M%S")
    cv2.imwrite(str(d / f"{stem}_orig.jpg"), original)
    cv2.imwrite(str(d / f"{stem}_det.jpg"), annotated)
    print(f"saved {d}\\{stem}_orig.jpg / _det.jpg")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0", help="webcam index or image path")
    ap.add_argument("--model", default="auto")
    ap.add_argument("--conf", type=float, default=0.25)
    ap.add_argument("--imgsz", type=int, default=640,
                    help="inference size (.pt only; ONNX uses exported size)")
    args = ap.parse_args()

    model_path, onnx_sz = resolve_model(args.model)
    imgsz = onnx_sz or args.imgsz
    if onnx_sz:
        print(f"[m2 demo] ONNX static imgsz={imgsz}")
    model = YOLO(model_path, task="obb" if model_path.endswith(".onnx") else None)

    single = Path(args.source).suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    cap = None if single else cv2.VideoCapture(int(args.source)
                                               if args.source.isdigit() else args.source)
    if cap is not None and not cap.isOpened():
        print(f"ERROR: cannot open source {args.source!r}")
        return 1

    review: np.ndarray | None = None
    mode = "review" if single else "preview"   # image source: skip preview

    while True:
        if mode == "preview":
            ok, frame = cap.read()
            if not ok:
                print("source ended")
                break
            cv2.putText(frame, "H capture  |  Q quit", (12, frame.shape[0] - 12),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.imshow("Model 2 snapshot demo — preview (no inference)", frame)
            key = chr(cv2.waitKey(1) & 0xFF).lower()
            if key == "q":
                break
            if key == "h":
                annotated, _ = detect_once(model, frame, imgsz, args.conf)
                save_pair(frame, annotated)
                review = hstack_review(frame, annotated)
                mode = "review"
        else:
            if single:  # image source: (re)detect on the file
                frame = cv2.imread(args.source)
                if frame is None:
                    print(f"ERROR: cannot read {args.source!r}")
                    break
                annotated, _ = detect_once(model, frame, imgsz, args.conf)
                review = hstack_review(frame, annotated)
            cv2.imshow("Model 2 snapshot demo — review (H new capture, Q quit)", review)
            key = chr(cv2.waitKey(1) & 0xFF).lower()
            if key == "q":
                break
            if key == "h" and not single:
                mode = "preview"

    if cap is not None:
        cap.release()
    cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
