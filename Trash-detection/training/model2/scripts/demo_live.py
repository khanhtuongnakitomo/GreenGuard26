r"""Live demo — Model 2 ONLY (cap / label / ring detector, OBB).

Single-model app: no Model 1, no gating — draws OBB polygons and a top-left
legend with class + confidence. CPU-only (GPU is for training), 5 FPS default.

Model auto-pick (first found):
  1. export/onnx_640/model.onnx           — train size (PC)
  2. export/onnx_416/model.onnx           — Jetson deploy size
  3. runs/m2v3_seed42_n640/weights/best.pt

Static ONNX graphs only accept their exported imgsz (read from the graph).

Usage (from model2-rebuild/, via model1 venv):
  ..\model1-rebuild\.venv\Scripts\python.exe scripts\demo_live.py
  ..\model1-rebuild\.venv\Scripts\python.exe scripts\demo_live.py --source video.mp4 --conf 0.4
  ..\model1-rebuild\.venv\Scripts\python.exe scripts\demo_live.py --save logs\m2_demo --max-frames 10

Keys: q = quit, s = snapshot to logs\m2_demo_snap.jpg
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]

NAMES = {0: "cap", 1: "label", 2: "ring"}
COLORS = {0: (0, 0, 255), 1: (0, 255, 255), 2: (255, 0, 255)}
DEVICE = "cpu"

CANDIDATES = [
    ROOT / "export" / "candidates" / "m2v6_inmachine_seed42_n640" / "onnx_768" / "model.onnx",
    ROOT / "export" / "candidates" / "m2v6_inmachine_seed42_n640" / "onnx_640" / "model.onnx",
    ROOT / "runs" / "m2v6_inmachine_seed42_n640" / "weights" / "best.pt",
    ROOT / "export" / "candidates" / "m2v5_allangle_seed42_n768" / "onnx_768" / "model.onnx",
    ROOT / "export" / "candidates" / "m2v5_allangle_seed42_n768" / "onnx_640" / "model.onnx",
    ROOT / "runs" / "m2v5_allangle_seed42_n768" / "weights" / "best.pt",
    ROOT / "export" / "candidates" / "m2v4_caplabel_seed42_n640" / "onnx_640" / "model.onnx",
    ROOT / "export" / "candidates" / "m2v4_caplabel_seed42_n640" / "onnx_416" / "model.onnx",
    ROOT / "runs" / "m2v4_caplabel_seed42_n640" / "weights" / "best.pt",
    ROOT / "export" / "onnx_640" / "model.onnx",
    ROOT / "export" / "onnx_416" / "model.onnx",
    ROOT / "runs" / "m2v3_seed42_n640" / "weights" / "best.pt",
]

REF_WEIGHTS = (
    ROOT / "runs" / "m2v6_inmachine_seed42_n640" / "weights" / "best.pt"
    if (ROOT / "runs" / "m2v6_inmachine_seed42_n640" / "weights" / "best.pt").is_file()
    else ROOT / "runs" / "m2v5_allangle_seed42_n768" / "weights" / "best.pt"
    if (ROOT / "runs" / "m2v5_allangle_seed42_n768" / "weights" / "best.pt").is_file()
    else ROOT / "runs" / "m2v4_caplabel_seed42_n640" / "weights" / "best.pt"
    if (ROOT / "runs" / "m2v4_caplabel_seed42_n640" / "weights" / "best.pt").is_file()
    else ROOT / "runs" / "m2v3_seed42_n640" / "weights" / "best.pt"
)


def onnx_date(path: Path) -> str | None:
    try:
        import onnx
        for prop in onnx.load(str(path), load_external_data=False).metadata_props:
            if prop.key == "date":
                return prop.value
    except Exception:
        pass
    return None


def stale_onnx(path: Path) -> bool:
    return (path.suffix == ".onnx" and REF_WEIGHTS.is_file()
            and path.stat().st_mtime < REF_WEIGHTS.stat().st_mtime)


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
        if not path.is_file():
            continue
        if stale_onnx(path):
            print(f"STALE EXPORT - skipping {path} (older than {REF_WEIGHTS})")
            continue
        print(f"[m2 demo] using model: {path}")
        if path.suffix == ".onnx":
            print(f"[m2 demo] onnx date: {onnx_date(path)}")
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0", help="webcam index or image/video path")
    ap.add_argument("--model", default="auto")
    ap.add_argument("--fps", type=float, default=5.0)
    ap.add_argument("--conf", type=float, default=0.25)
    ap.add_argument("--imgsz", type=int, default=640,
                    help="inference size (.pt only; ONNX uses exported size)")
    ap.add_argument("--save", default=None, help="save annotated frames to folder")
    ap.add_argument("--max-frames", type=int, default=0)
    args = ap.parse_args()

    model_path, onnx_sz = resolve_model(args.model)
    imgsz = onnx_sz or args.imgsz
    if onnx_sz:
        print(f"[m2 demo] ONNX static imgsz={imgsz}")
    model = YOLO(model_path, task="obb" if model_path.endswith(".onnx") else None)

    src = int(args.source) if args.source.isdigit() else args.source
    single = isinstance(src, str) and Path(src).suffix.lower() in {
        ".jpg", ".jpeg", ".png", ".bmp", ".webp",
    }
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

        r = model.predict(frame, imgsz=imgsz, conf=args.conf,
                          device=DEVICE, verbose=False)[0]
        legend: list[tuple[str, tuple]] = []
        if r.obb is not None and len(r.obb):
            from single_instance import pick_top1_per_class
            polys = r.obb.xyxyxyxy.cpu().numpy()
            clss = r.obb.cls.cpu().numpy().astype(int)
            confs = r.obb.conf.cpu().numpy()
            keep = sorted(pick_top1_per_class(polys, clss, confs, (0, 1, 2)).values())
            legend = draw_detections(frame, polys[keep], clss[keep], confs[keep])
        draw_legend(frame, legend or [("no cap / label / ring detected", (160, 160, 160))])

        n += 1
        actual = 1.0 / max(time.perf_counter() - t0, 1e-6)
        status = f"frame {n} | {args.fps:.0f} fps target | {actual:.1f} actual | det: {len(legend)}"
        cv2.putText(frame, status, (10, frame.shape[0] - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
        print(status, "|", ", ".join(t for t, _ in legend) if legend else "-")

        if save_dir:
            cv2.imwrite(str(save_dir / f"m2_demo_{n:04d}.jpg"), frame)
        if not save_dir or single:
            cv2.imshow("Model 2 demo — cap / label / ring (q=quit, s=snapshot)", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("s"):
                snap = ROOT / "logs" / "m2_demo_snap.jpg"
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
