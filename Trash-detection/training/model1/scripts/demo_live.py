r"""Live demo — Model 1 with two-stage PET/can classifier (Fix B).

Stage 1: OBB detector localizes object (low conf, class-agnostic).
Stage 2: yolov8n-cls on crop decides PET vs aluminum.

Falls back to detector-only labels if --no-cls or no classifier weights.

Usage (from model1-rebuild/):
  .\.venv\Scripts\python.exe scripts\demo_live.py
  .\.venv\Scripts\python.exe scripts\demo_live.py --det-conf 0.05 --save logs\m1_diag
Keys: q = quit, s = snapshot to logs\demo_snap.jpg
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]

DISPLAY_LEGACY = {"bottle": ("PET bottle", (255, 80, 0)),
                  "aluminum": ("Aluminum can", (0, 255, 0))}
DEVICE = "cpu"

CANDIDATES = [
    (ROOT / "export" / "onnx_416" / "model.onnx", {0: "bottle", 1: "aluminum"}),
    (ROOT / "runs" / "seed42_n640" / "weights" / "best.pt", {0: "bottle", 1: "aluminum"}),
    (ROOT / "export" / "v1_4class" / "onnx_416" / "model.onnx",
     {0: "bottle", 1: "cap", 2: "wrapper", 3: "aluminum"}),
    (ROOT / "runs" / "v1_4class" / "seed7_n640" / "weights" / "best.pt",
     {0: "bottle", 1: "cap", 2: "wrapper", 3: "aluminum"}),
    (ROOT / "runs" / "v1_4class" / "seed42_n640" / "weights" / "best.pt",
     {0: "bottle", 1: "cap", 2: "wrapper", 3: "aluminum"}),
]


def resolve_model(arg: str):
    if arg and arg != "auto":
        return arg, None
    for path, cmap in CANDIDATES:
        if path.is_file():
            masked = sorted(set(cmap.values()) - DISPLAY_LEGACY.keys())
            print(f"[demo] using model: {path}")
            if masked:
                print(f"[demo] masking non-scope classes: {masked}")
            return str(path), cmap
    print("ERROR: no model found.")
    raise SystemExit(1)


def draw(frame: np.ndarray, polys, clss, confs, cmap) -> list[tuple[str, tuple]]:
    entries = sorted(zip(polys, clss, confs), key=lambda t: -float(t[2]))
    legend = []
    for poly, c, cf in entries:
        name = (cmap or {}).get(int(c))
        if name not in DISPLAY_LEGACY:
            continue
        label, color = DISPLAY_LEGACY[name]
        cv2.polylines(frame, [poly.astype(np.int32)], True, color, 2)
        legend.append((f"{label} {float(cf) * 100:.0f}%", color))
    return legend


def draw_legend(frame: np.ndarray, legend: list[tuple[str, tuple]]) -> None:
    x, y, line_h = 10, 12, 30
    overlay = frame.copy()
    w = max((cv2.getTextSize(t, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0][0] for t, _ in legend),
            default=0) + 20
    cv2.rectangle(overlay, (x - 4, y), (x + w, y + line_h * len(legend) + 4), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.45, frame, 0.55, 0, frame)
    for i, (text, color) in enumerate(legend):
        cv2.putText(frame, text, (x + 4, y + 22 + i * line_h),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)


sys.path.insert(0, str(ROOT / "scripts"))
from m1_two_stage import PetCanDecider, resolve_classifier  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0", help="webcam index or file path")
    ap.add_argument("--model", default="auto", help="detector path (auto)")
    ap.add_argument("--cls-model", default="auto", help="classifier path (auto)")
    ap.add_argument("--no-cls", action="store_true", help="detector-only (legacy)")
    ap.add_argument("--fps", type=float, default=5.0)
    ap.add_argument("--conf", type=float, default=0.25,
                    help="detector conf when --no-cls")
    ap.add_argument("--det-conf", type=float, default=0.05,
                    help="detector conf for localization (two-stage)")
    ap.add_argument("--imgsz", type=int, default=416)
    ap.add_argument("--min-area", type=float, default=0.02,
                    help="min box area as fraction of frame (two-stage)")
    ap.add_argument("--vote", type=int, default=5, help="majority vote window")
    ap.add_argument("--save", default=None)
    ap.add_argument("--max-frames", type=int, default=0)
    args = ap.parse_args()

    use_cls = not args.no_cls
    decider = None
    det_model = None
    cmap = None

    if use_cls:
        try:
            resolve_classifier(args.cls_model)
            decider = PetCanDecider(
                det_path=args.model,
                cls_path=args.cls_model,
                det_imgsz=args.imgsz,
                det_conf=args.det_conf,
                min_area_frac=args.min_area,
                vote_frames=args.vote,
            )
            print("[demo] mode: two-stage (detect + classify)")
        except FileNotFoundError as e:
            print(f"[demo] classifier missing ({e}); falling back to detector-only")
            use_cls = False

    if not use_cls:
        model_path, cmap = resolve_model(args.model)
        det_model = YOLO(model_path, task="obb" if model_path.endswith(".onnx") else None)
        print("[demo] mode: detector-only (legacy)")

    src = int(args.source) if args.source.isdigit() else args.source
    single = isinstance(src, str) and Path(src).suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    cap = None if single else cv2.VideoCapture(src)
    if cap is not None and not cap.isOpened():
        print(f"ERROR: cannot open source {src!r}")
        return 1
    save_dir = Path(args.save) if args.save else None
    if save_dir:
        save_dir.mkdir(parents=True, exist_ok=True)

    interval = 1.0 / max(args.fps, 0.1)
    n = 0
    while True:
        t0 = time.perf_counter()
        if single:
            frame = cv2.imread(src)
        else:
            ok, frame = cap.read()
            if not ok:
                print("source ended")
                break
        if frame is None:
            print("ERROR: empty frame")
            break

        legend: list[tuple[str, tuple]] = []
        if decider is not None:
            out = decider.run(frame)
            if out.get("label"):
                cv2.polylines(frame, [out["poly"]], True, out["color"], 2)
                legend.append((out["legend_text"], out["color"]))
        else:
            r = det_model.predict(frame, imgsz=args.imgsz, conf=args.conf,
                                  device=DEVICE, verbose=False)[0]
            if r.obb is not None and len(r.obb):
                legend = draw(frame, r.obb.xyxyxyxy.cpu().numpy(),
                              r.obb.cls.cpu().numpy(), r.obb.conf.cpu().numpy(), cmap)

        draw_legend(frame, legend or [("no PET bottle / can in frame", (160, 160, 160))])

        n += 1
        actual = 1.0 / max(time.perf_counter() - t0, 1e-6)
        mode = "2-stage" if decider else "det-only"
        status = (f"frame {n} | {args.fps:.0f} fps target | {actual:.1f} actual | "
                  f"{mode} | det: {len(legend)}")
        cv2.putText(frame, status, (10, frame.shape[0] - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
        print(status, "|", ", ".join(t for t, _ in legend) if legend else "-")

        if save_dir:
            cv2.imwrite(str(save_dir / f"demo_{n:04d}.jpg"), frame)
        if not save_dir or single:
            cv2.imshow("Model 1 demo — PET / Aluminum (q=quit)", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("s"):
                snap = ROOT / "logs" / "demo_snap.jpg"
                snap.parent.mkdir(exist_ok=True)
                cv2.imwrite(str(snap), frame)
                print(f"saved {snap}")
        if single or (args.max_frames and n >= args.max_frames):
            break
        remaining = interval - (time.perf_counter() - t0)
        if remaining > 0:
            time.sleep(remaining)

    if cap is not None:
        cap.release()
    cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
