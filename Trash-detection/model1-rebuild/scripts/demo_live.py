r"""Live demo — GreenGuard Model 1 rebuild v2 (YOLOv8n-OBB, 2 classes).

CPU-ONLY by design (owner directive 2026-08-22): the GPU is reserved for
training; the application must run on CPU everywhere. Inference uses the ONNX
artifact via onnxruntime CPU when available, else best.pt on CPU.

UI: rotated boxes drawn without inline labels; the TOP-LEFT CORNER lists each
detection as "<class> <confidence%>", plus the target/actual FPS at the bottom.

Usage (PowerShell, from model1-rebuild/):
  .\.venv\Scripts\python.exe scripts\demo_live.py                 # webcam, onnx_416, 5 fps
  .\.venv\Scripts\python.exe scripts\demo_live.py --fps 10
  .\.venv\Scripts\python.exe scripts\demo_live.py --source path\to\video.mp4
  .\.venv\Scripts\python.exe scripts\demo_live.py --model runs\seed42_n640\weights\best.pt
  .\.venv\Scripts\python.exe scripts\demo_live.py --save logs\demo_out --max-frames 20   # headless test

Keys in the window: q = quit, s = save current frame to logs\demo_snap.jpg
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
NAMES = {0: "bottle", 1: "aluminum"}
COLORS = {0: (255, 80, 0), 1: (0, 255, 0)}
DEVICE = "cpu"  # application is CPU-only; GPU is for training only


def resolve_model(arg: str) -> str:
    """Auto-pick the best available artifact (onnx_416 -> onnx_320 -> best.pt)."""
    if arg and arg != "auto":
        return arg
    candidates = [
        ROOT / "export" / "onnx_416" / "model.onnx",
        ROOT / "export" / "onnx_320" / "model.onnx",
        ROOT / "runs" / "seed42_n640" / "weights" / "best.pt",
        ROOT / "runs" / "seed7_n640" / "weights" / "best.pt",
    ]
    for c in candidates:
        if c.is_file():
            print(f"[demo] using model: {c} (device: {DEVICE})")
            return str(c)
    print("ERROR: no model found. Looked for:\n  " + "\n  ".join(str(c) for c in candidates))
    raise SystemExit(1)


def draw(frame: np.ndarray, polys, clss, confs) -> list[tuple[str, tuple]]:
    """Draw plain rotated boxes + a top-left legend 'class confidence%'."""
    entries = sorted(zip(polys, clss, confs), key=lambda t: -float(t[2]))
    legend: list[tuple[str, tuple]] = []
    for poly, c, cf in entries:
        c = int(c)
        color = COLORS.get(c, (255, 255, 255))
        cv2.polylines(frame, [poly.astype(np.int32)], True, color, 2)
        legend.append((f"{NAMES.get(c, str(c))} {float(cf) * 100:.0f}%", color))
    return legend


def draw_legend(frame: np.ndarray, legend: list[tuple[str, tuple]]) -> None:
    x, y, line_h = 10, 12, 30
    overlay = frame.copy()
    w = max((cv2.getTextSize(t, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0][0] for t, _ in legend), default=0) + 20
    cv2.rectangle(overlay, (x - 4, y), (x + w, y + line_h * len(legend) + 4), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.45, frame, 0.55, 0, frame)
    for i, (text, color) in enumerate(legend):
        cv2.putText(frame, text, (x + 4, y + 22 + i * line_h),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0", help="webcam index or file path")
    ap.add_argument("--model", default="auto",
                    help="'auto' = first of onnx_416/onnx_320/best.pt")
    ap.add_argument("--fps", type=float, default=5.0)
    ap.add_argument("--conf", type=float, default=0.25)
    ap.add_argument("--imgsz", type=int, default=416)
    ap.add_argument("--save", default=None, help="save annotated frames to this dir (headless)")
    ap.add_argument("--max-frames", type=int, default=0, help="stop after N frames (0 = unlimited)")
    args = ap.parse_args()

    model_path = resolve_model(args.model)
    model = YOLO(model_path, task="obb" if model_path.endswith(".onnx") else None)

    src = int(args.source) if args.source.isdigit() else args.source
    single_image = isinstance(src, str) and Path(src).suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    cap = None if single_image else cv2.VideoCapture(src)
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
        if single_image:
            frame = cv2.imread(src)
        else:
            ok, frame = cap.read()
            if not ok:
                print("source ended")
                break
        if frame is None:
            print("ERROR: empty frame")
            break

        results = model.predict(frame, imgsz=args.imgsz, conf=args.conf,
                                device=DEVICE, verbose=False)
        r = results[0]
        legend: list[tuple[str, tuple]] = []
        if getattr(r, "obb", None) is not None and r.obb is not None and len(r.obb):
            legend = draw(frame, r.obb.xyxyxyxy.cpu().numpy(),
                          r.obb.cls.cpu().numpy(), r.obb.conf.cpu().numpy())
        draw_legend(frame, legend or [("no detection", (160, 160, 160))])

        n += 1
        actual = 1.0 / max(time.perf_counter() - t0, 1e-6)
        status = f"frame {n} | target {args.fps:.0f} fps | actual {actual:.1f} fps | det: {len(legend)}"
        cv2.putText(frame, status, (10, frame.shape[0] - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
        print(status, "|", ", ".join(t for t, _ in legend) if legend else "-")

        if save_dir:
            cv2.imwrite(str(save_dir / f"demo_{n:04d}.jpg"), frame)
        if not save_dir or single_image:
            cv2.imshow("GreenGuard OBB demo (q=quit, s=snap)", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("s"):
                snap = ROOT / "logs" / "demo_snap.jpg"
                snap.parent.mkdir(exist_ok=True)
                cv2.imwrite(str(snap), frame)
                print(f"saved {snap}")
        if single_image or (args.max_frames and n >= args.max_frames):
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
