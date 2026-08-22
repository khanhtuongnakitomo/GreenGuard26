"""Live demo — GreenGuard Model 1 rebuild (YOLOv8n-OBB, 4 classes).

Runs the exported ONNX model on a webcam (or video/image) and draws rotated
detection boxes, throttled to a fixed FPS (default 5).

Usage (PowerShell, from model1-rebuild/):
  .\.venv\Scripts\python.exe scripts\demo_live.py                 # webcam, onnx_416, 5 fps
  .\.venv\Scripts\python.exe scripts\demo_live.py --fps 10
  .\.venv\Scripts\python.exe scripts\demo_live.py --source path\to\video.mp4
  .\.venv\Scripts\python.exe scripts\demo_live.py --model runs\seed7_n640\weights\best.pt --device 0
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
NAMES = {0: "bottle", 1: "cap", 2: "wrapper", 3: "aluminum"}
COLORS = {0: (255, 80, 0), 1: (0, 0, 255), 2: (0, 255, 255), 3: (0, 255, 0)}


def draw(frame: np.ndarray, polys: np.ndarray, clss, confs) -> list[str]:
    lines = []
    for poly, c, cf in zip(polys, clss, confs):
        c = int(c)
        pts = poly.astype(np.int32)
        color = COLORS.get(c, (255, 255, 255))
        cv2.polylines(frame, [pts], True, color, 2)
        x, y = int(pts[0][0]), max(18, int(pts[0][1]) - 6)
        label = f"{NAMES.get(c, c)} {float(cf):.2f}"
        cv2.putText(frame, label, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        lines.append(label)
    return lines


def resolve_model(arg: str) -> tuple[str, str]:
    """Return (model_path, device) — auto-picks the best available artifact."""
    if arg and arg != "auto":
        return arg, "auto"
    candidates = [
        ROOT / "export" / "onnx_416" / "model.onnx",      # deploy candidate
        ROOT / "export" / "onnx_320" / "model.onnx",
        ROOT / "runs" / "seed7_n640" / "weights" / "best.pt",
        ROOT / "runs" / "seed42_n640" / "weights" / "best.pt",
    ]
    for c in candidates:
        if c.is_file():
            print(f"[demo] using model: {c}")
            return str(c), "auto"
    print("ERROR: no model found. Looked for:\n  " + "\n  ".join(str(c) for c in candidates))
    raise SystemExit(1)


def resolve_device(model_path: str, arg: str) -> str:
    if arg and arg != "auto":
        return arg
    if model_path.endswith(".onnx"):
        return "cpu"  # onnxruntime CPU build
    import torch  # noqa: PLC0415

    if torch.cuda.is_available():
        return "0"
    print("[demo] CUDA not available for torch — using CPU (install a CUDA-matching "
          "torch build for GPU, see requirements.txt notes)")
    return "cpu"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0", help="webcam index or file path")
    ap.add_argument("--model", default="auto",
                    help="'auto' = first of onnx_416/onnx_320/best.pt(seed7/42)")
    ap.add_argument("--fps", type=float, default=5.0)
    ap.add_argument("--conf", type=float, default=0.25)
    ap.add_argument("--imgsz", type=int, default=416)
    ap.add_argument("--device", default="auto", help="'auto', 'cpu', or '0' for GPU")
    ap.add_argument("--save", default=None, help="save annotated frames to this dir (headless)")
    ap.add_argument("--max-frames", type=int, default=0, help="stop after N frames (0 = unlimited)")
    args = ap.parse_args()

    model_path, _ = resolve_model(args.model)
    device = resolve_device(model_path, args.device)
    is_onnx = model_path.endswith(".onnx")
    model = YOLO(model_path, task="obb" if is_onnx else None)

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
                                device=device, verbose=False)
        r = results[0]
        labels: list[str] = []
        if getattr(r, "obb", None) is not None and r.obb is not None and len(r.obb):
            labels = draw(frame, r.obb.xyxyxyxy.cpu().numpy(),
                          r.obb.cls.cpu().numpy(), r.obb.conf.cpu().numpy())

        n += 1
        actual = 1.0 / max(time.perf_counter() - t0, 1e-6)
        status = f"frame {n} | target {args.fps:.0f} fps | actual {actual:.1f} fps | det: {len(labels)}"
        cv2.putText(frame, status, (10, frame.shape[0] - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
        print(status, "|", ", ".join(labels) if labels else "-")

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
