r"""GreenGuard gating demo — Model 1 (PET) triggers Model 2 (cap/label/ring).

Logic (owner, 2026-08-23 — direction C, full-frame Model 2):
  Model 1 detects objects; when a PET BOTTLE is the best detection above
  --m1-conf, Model 2 runs on the SAME FULL FRAME (its training distribution —
  crops made confidences collapse) and only detections whose box center lies
  INSIDE the bottle polygon count. Any of cap/label/ring >= --m2-conf
  -> big red "PET REJECT" (+ which parts); none -> big green "PET ACCEPT".
  Verdict is held to a 3-of-last-5-frames vote so a borderline ring (~0.5)
  cannot flicker the banner frame to frame.

CPU-ONLY (app rule; GPU is for training only). 5 FPS governor. Top-left legend
lists detections; verdict banner sits top-center.

Inference imgsz is read from the model file itself for static ONNX graphs
(calling a 416 graph at 640 crashes onnxruntime), falling back to the CLI
value for .pt weights.

Model 1 default = v2 2-class ONNX @416 (0=bottle 1=aluminum), falling back to
the archived v1 4-class model (cap/wrapper classes are masked, gate stays off).

Usage (from model2-rebuild/, via model1 venv):
  ..\model1-rebuild\.venv\Scripts\python.exe scripts\pipeline_demo.py
"""
from __future__ import annotations

import argparse
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
M1_ROOT = ROOT.parent / "model1-rebuild"

M1_CANDIDATES = [  # (path, bottle_id, aluminum_id) — first existing wins
    (M1_ROOT / "export" / "onnx_416" / "model.onnx", 0, 1),                 # v2 2-class (in use)
    (M1_ROOT / "runs" / "seed42_n640" / "weights" / "best.pt", 0, 1),       # v2 2-class
    (M1_ROOT / "export" / "v1_4class" / "onnx_416" / "model.onnx", 0, 3),   # v1 4-class (legacy)
    (M1_ROOT / "runs" / "v1_4class" / "seed7_n640" / "weights" / "best.pt", 0, 3),
    (M1_ROOT / "runs" / "v1_4class" / "seed42_n640" / "weights" / "best.pt", 0, 3),
]
M2_CANDIDATES = [
    ROOT / "export" / "onnx_640" / "model.onnx",   # train size (PC)
    ROOT / "export" / "onnx_416" / "model.onnx",   # Jetson deploy size
    ROOT / "runs" / "m2v3_seed42_n640" / "weights" / "best.pt",
]
M2_NAMES = {0: "cap", 1: "label", 2: "ring"}
M2_COLORS = {0: (0, 0, 255), 1: (0, 255, 255), 2: (255, 0, 255)}
DEVICE = "cpu"


def pick(candidates, label: str):
    for c in candidates:
        if isinstance(c, tuple):
            if c[0].is_file():
                print(f"[gate] {label}: {c[0]}")
                return c
        elif c.is_file():
            print(f"[gate] {label}: {c}")
            return c
    print(f"[gate] ERROR: no {label} model. Looked for:\n  "
          + "\n  ".join(str(c[0] if isinstance(c, tuple) else c) for c in candidates))
    raise SystemExit(1)


def onnx_imgsz(path: Path) -> int | None:
    """Static ONNX graphs accept only their exported size — read it from the graph."""
    try:
        import onnxruntime as ort
        session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        n = session.get_inputs()[0].shape[2]
        return int(n) if isinstance(n, int) else None
    except Exception:
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0")
    ap.add_argument("--fps", type=float, default=5.0)
    ap.add_argument("--m1-conf", type=float, default=0.5)
    ap.add_argument("--m2-conf", type=float, default=0.5)
    ap.add_argument("--m2-imgsz", type=int, default=640,
                    help="Model 2 input size (used for .pt weights; ONNX graphs"
                         " always run at their exported size)")
    ap.add_argument("--save", default=None)
    ap.add_argument("--max-frames", type=int, default=0)
    args = ap.parse_args()

    m1_c = pick(M1_CANDIDATES, "Model 1 (PET/aluminum)")
    m2_path = pick(M2_CANDIDATES, "Model 2 (cap/label/ring)")
    m1_path, m1_bottle, m1_aluminum = m1_c
    m1 = YOLO(str(m1_path), task="obb" if m1_path.suffix == ".onnx" else None)
    m2 = YOLO(str(m2_path), task="obb" if m2_path.suffix == ".onnx" else None)
    m1_imgsz = onnx_imgsz(m1_path) or 416
    m2_imgsz = onnx_imgsz(m2_path) or args.m2_imgsz
    print(f"[gate] inference sizes: M1={m1_imgsz}, M2={m2_imgsz}")

    src = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"ERROR: cannot open source {src!r}")
        return 1
    save_dir = Path(args.save) if args.save else None
    if save_dir:
        save_dir.mkdir(parents=True, exist_ok=True)

    interval = 1.0 / max(args.fps, 0.1)
    vote: deque[str] = deque(maxlen=5)
    n = 0
    while True:
        t0 = time.perf_counter()
        ok, frame = cap.read()
        if not ok:
            print("source ended")
            break
        n += 1
        legend: list[tuple[str, tuple]] = []
        verdict, vcolor = "", (160, 160, 160)
        gate_active = False

        r1 = m1.predict(frame, imgsz=m1_imgsz, conf=args.m1_conf, device=DEVICE, verbose=False)[0]
        if r1.obb is not None and len(r1.obb):
            polys = r1.obb.xyxyxyxy.cpu().numpy()
            clss = r1.obb.cls.cpu().numpy().astype(int)
            confs = r1.obb.conf.cpu().numpy()
            # Model 1 presents exactly two outcomes: PET bottle (gate ON) or
            # Aluminum can (gate OFF). Other v1 classes (cap/wrapper) are
            # Model 2's job and stay masked.
            bottle_idx = np.where(clss == m1_bottle)[0]
            alu_idx = np.where(clss == m1_aluminum)[0]
            if len(bottle_idx):
                best = bottle_idx[int(np.argmax(confs[bottle_idx]))]
                is_pet, color = True, (255, 80, 0)
            elif len(alu_idx):
                best = alu_idx[int(np.argmax(confs[alu_idx]))]
                is_pet, color = False, (0, 255, 0)
            else:
                best = int(np.argmax(confs))  # masked class: draw faint, gate OFF
                is_pet, color = False, (120, 120, 120)
            box = polys[best].astype(np.int32)
            cv2.polylines(frame, [box], True, color, 2)
            legend.append(("PET bottle" if is_pet else
                           "Aluminum can" if len(alu_idx) else "other (gate off)", color))

            if is_pet:
                gate_active = True
                # Direction C: Model 2 sees the FULL frame (like training);
                # only detections inside the bottle polygon belong to it.
                r2 = m2.predict(frame, imgsz=m2_imgsz, conf=0.1,
                                device=DEVICE, verbose=False)[0]
                hits: list[tuple[str, float]] = []
                if r2.obb is not None and len(r2.obb):
                    p2 = r2.obb.xyxyxyxy.cpu().numpy()
                    c2 = r2.obb.cls.cpu().numpy().astype(int)
                    f2 = r2.obb.conf.cpu().numpy()
                    contour = polys[best].astype(np.float32)
                    for poly, ci, cf in zip(p2, c2, f2):
                        cx, cy = poly.mean(axis=0)
                        if cv2.pointPolygonTest(contour, (float(cx), float(cy)), False) < 0:
                            continue  # belongs to another object / background
                        cv2.polylines(frame, [poly.astype(np.int32)], True,
                                      M2_COLORS.get(ci, (255, 255, 255)), 2)
                        legend.append((f"{M2_NAMES.get(ci, ci)} {cf*100:.0f}%",
                                       M2_COLORS.get(ci, (255, 255, 255))))
                        if cf >= args.m2_conf:
                            hits.append((M2_NAMES.get(ci, str(ci)), float(cf)))
                vote.append("REJECT" if hits else "ACCEPT")
                if vote.count("REJECT") >= 3:
                    parts = ", ".join(f"{k} {v*100:.0f}%" for k, v in hits) or "residual"
                    verdict, vcolor = f"PET REJECT — {parts}", (0, 0, 255)
                elif vote.count("ACCEPT") >= 3:
                    verdict, vcolor = "PET ACCEPT (no cap/label/ring)", (0, 200, 0)
                else:
                    verdict = (f"judging... {vote.count('REJECT')}R/"
                               f"{vote.count('ACCEPT')}A of {len(vote)}")
        else:
            legend.append(("no PET bottle / aluminum can in frame", (160, 160, 160)))
        if not gate_active:
            vote.clear()

        # verdict banner (top center) + left legend + bottom status
        if verdict:
            (tw, th), _ = cv2.getTextSize(verdict, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
            cv2.rectangle(frame, (frame.shape[1] // 2 - tw // 2 - 8, 8),
                          (frame.shape[1] // 2 + tw // 2 + 8, 8 + th + 16), (0, 0, 0), -1)
            cv2.putText(frame, verdict, (frame.shape[1] // 2 - tw // 2, 8 + th + 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, vcolor, 2)
        for i, (text, color) in enumerate(legend):
            cv2.putText(frame, text, (12, 30 + i * 28),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2)
        actual = 1.0 / max(time.perf_counter() - t0, 1e-6)
        cv2.putText(frame, f"{n} | {args.fps:.0f} fps target | {actual:.1f} actual",
                    (10, frame.shape[0] - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

        if save_dir:
            cv2.imwrite(str(save_dir / f"gate_{n:04d}.jpg"), frame)
        cv2.imshow("GreenGuard gate: PET -> cap/label/ring (q=quit)", frame)
        if (cv2.waitKey(1) & 0xFF) == ord("q"):
            break
        if args.max_frames and n >= args.max_frames:
            break
        remaining = interval - (time.perf_counter() - t0)
        if remaining > 0:
            time.sleep(remaining)

    cap.release()
    cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
