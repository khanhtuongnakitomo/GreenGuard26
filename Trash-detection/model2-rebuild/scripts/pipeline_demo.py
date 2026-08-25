r"""GreenGuard gating demo — Model 1 (PET) triggers Model 2 (cap/label/ring).

Logic (owner, 2026-08-23 — direction C, full-frame Model 2):
  Model 1 detects objects; when a PET BOTTLE is the best detection above
  --m1-conf, Model 2 runs on the SAME FULL FRAME (its training distribution —
  crops made confidences collapse) and only detections whose box center lies
  INSIDE the bottle polygon count. Any of cap/label/ring >= --m2-conf
  -> big red "PET REJECT" (+ which parts); none -> big green "PET ACCEPT".

Anti-flicker layers (tuned for ~5 FPS CPU demos):
  1) EMA-smooth the Model 1 polygon so the box does not jump every frame.
  2) Miss-hold: keep the last PET/can for a few lost frames before clearing.
  3) Gate warm-up: wait ~0.5s after PET is stable before Model 2 votes count.
  4) Stronger verdict vote (default 4-of-7) plus sticky hold (~1.5s) once locked.

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
import sys
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
M1_ROOT = ROOT.parent / "model1-rebuild"
sys.path.insert(0, str(M1_ROOT / "scripts"))
from m1_two_stage import PetCanDecider  # noqa: E402
from single_instance import center_in_poly, pick_top1_per_class  # noqa: E402

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
M2_REF = ROOT / "runs" / "m2v3_seed42_n640" / "weights" / "best.pt"
M2_COLORS = {0: (0, 0, 255), 1: (0, 255, 255), 2: (255, 0, 255)}
DEVICE = "cpu"


def onnx_date(path):
    try:
        import onnx
        for prop in onnx.load(str(path), load_external_data=False).metadata_props:
            if prop.key == "date":
                return prop.value
    except Exception:
        pass
    return None


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


def smooth_poly(prev: np.ndarray | None, new: np.ndarray, alpha: float) -> np.ndarray:
    """EMA-smooth OBB polygon corners to reduce box flicker."""
    new_f = new.astype(np.float32)
    if prev is None or prev.shape != new_f.shape:
        return new_f
    return (alpha * new_f) + ((1.0 - alpha) * prev.astype(np.float32))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0")
    ap.add_argument("--fps", type=float, default=5.0)
    ap.add_argument("--m1-conf", type=float, default=0.05,
                    help="Model 1 detector conf for localization (two-stage)")
    ap.add_argument("--no-m1-cls", action="store_true",
                    help="use legacy detector class ids instead of crop classifier")
    ap.add_argument("--m2-conf", type=float, default=0.5)
    ap.add_argument("--m2-imgsz", type=int, default=640,
                    help="Model 2 input size (used for .pt weights; ONNX graphs"
                         " always run at their exported size)")
    ap.add_argument("--gate-warmup", type=float, default=0.5,
                    help="seconds PET must stay visible before Model 2 votes count")
    ap.add_argument("--verdict-hold", type=float, default=1.5,
                    help="seconds to keep a locked ACCEPT/REJECT before re-judging")
    ap.add_argument("--miss-hold", type=int, default=3,
                    help="keep last M1 box this many lost frames before clearing")
    ap.add_argument("--vote-window", type=int, default=7,
                    help="frames kept for ACCEPT/REJECT majority vote")
    ap.add_argument("--vote-need", type=int, default=4,
                    help="votes required to lock ACCEPT or REJECT")
    ap.add_argument("--box-smooth", type=float, default=0.35,
                    help="EMA alpha for M1 polygon (0=sticky, 1=raw)")
    ap.add_argument("--save", default=None)
    ap.add_argument("--max-frames", type=int, default=0)
    args = ap.parse_args()

    vote_need = max(1, min(args.vote_need, args.vote_window))
    box_alpha = min(max(args.box_smooth, 0.05), 1.0)

    m1_c = pick(M1_CANDIDATES, "Model 1 (PET/aluminum)")
    m2_cands = [c for c in M2_CANDIDATES
                if not (c.suffix == ".onnx" and M2_REF.is_file()
                        and c.stat().st_mtime < M2_REF.stat().st_mtime)]
    for c in M2_CANDIDATES:
        if c not in m2_cands:
            print(f"STALE EXPORT - skipping {c} (older than {M2_REF})")
    m2_path = pick(m2_cands, "Model 2 (cap/label/ring)")
    if str(m2_path).endswith(".onnx"):
        print(f"[gate] Model 2 onnx date: {onnx_date(Path(m2_path))}")
    m1_path, m1_bottle, m1_aluminum = m1_c
    m1_imgsz = onnx_imgsz(m1_path) or 416
    m2_imgsz = onnx_imgsz(m2_path) or args.m2_imgsz
    print(f"[gate] inference sizes: M1 det={m1_imgsz}, M2={m2_imgsz}")
    print(
        f"[gate] anti-flicker: warmup={args.gate_warmup:.1f}s "
        f"hold={args.verdict_hold:.1f}s miss={args.miss_hold} "
        f"vote={vote_need}/{args.vote_window} smooth={box_alpha:.2f}"
    )

    m1_decider = None
    m1 = None
    if not args.no_m1_cls:
        try:
            m1_decider = PetCanDecider(
                det_path=str(m1_path),
                det_imgsz=m1_imgsz,
                det_conf=args.m1_conf,
                vote_frames=max(5, args.vote_window),
            )
            print("[gate] Model 1 mode: two-stage (detect + classify)")
        except FileNotFoundError as e:
            print(f"[gate] classifier missing ({e}); legacy detector classes")
    if m1_decider is None:
        m1 = YOLO(str(m1_path), task="obb" if m1_path.suffix == ".onnx" else None)
        print("[gate] Model 1 mode: detector-only")
    m2 = YOLO(str(m2_path), task="obb" if m2_path.suffix == ".onnx" else None)

    src = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"ERROR: cannot open source {src!r}")
        return 1
    save_dir = Path(args.save) if args.save else None
    if save_dir:
        save_dir.mkdir(parents=True, exist_ok=True)

    interval = 1.0 / max(args.fps, 0.1)
    vote: deque[str] = deque(maxlen=max(1, args.vote_window))
    n = 0

    # Temporal state between layers (anti-flicker)
    held_box: np.ndarray | None = None
    held_is_pet = False
    held_color = (160, 160, 160)
    held_legend = ""
    miss_frames = 0
    pet_since: float | None = None
    locked_verdict = ""
    locked_color = (160, 160, 160)
    locked_hits: list[tuple[str, float]] = []
    locked_until = 0.0

    while True:
        t0 = time.perf_counter()
        now = t0
        ok, frame = cap.read()
        if not ok:
            print("source ended")
            break
        n += 1
        legend: list[tuple[str, tuple]] = []
        verdict, vcolor = "", (160, 160, 160)
        gate_active = False
        raw_box = None
        raw_is_pet = False
        raw_color = (160, 160, 160)
        raw_legend = ""

        r1 = m1_decider.run(frame) if m1_decider else None
        if m1_decider and r1.get("label"):
            raw_box = r1["poly"]
            raw_is_pet = r1["voted"] == "pet"
            raw_color = r1["color"]
            raw_legend = r1["legend_text"]
        elif m1 is not None:
            r1_legacy = m1.predict(frame, imgsz=m1_imgsz, conf=max(args.m1_conf, 0.25),
                                   device=DEVICE, verbose=False)[0]
            if r1_legacy.obb is not None and len(r1_legacy.obb):
                polys = r1_legacy.obb.xyxyxyxy.cpu().numpy()
                clss = r1_legacy.obb.cls.cpu().numpy().astype(int)
                confs = r1_legacy.obb.conf.cpu().numpy()
                bottle_idx = np.where(clss == m1_bottle)[0]
                alu_idx = np.where(clss == m1_aluminum)[0]
                if len(bottle_idx):
                    best = bottle_idx[int(np.argmax(confs[bottle_idx]))]
                    raw_is_pet, raw_color = True, (255, 80, 0)
                    raw_legend = "PET bottle"
                elif len(alu_idx):
                    best = alu_idx[int(np.argmax(confs[alu_idx]))]
                    raw_is_pet, raw_color = False, (0, 255, 0)
                    raw_legend = "Aluminum can"
                else:
                    best = int(np.argmax(confs))
                    raw_is_pet, raw_color = False, (120, 120, 120)
                    raw_legend = "other (gate off)"
                raw_box = polys[best].astype(np.int32)

        # Layer delay #1: miss-hold + EMA box so M1 does not blink off
        if raw_box is not None:
            miss_frames = 0
            held_box = smooth_poly(held_box, raw_box, box_alpha)
            held_is_pet = raw_is_pet
            held_color = raw_color
            held_legend = raw_legend
        elif held_box is not None and miss_frames < args.miss_hold:
            miss_frames += 1
        else:
            held_box = None
            held_is_pet = False
            held_legend = ""
            miss_frames = 0
            pet_since = None
            vote.clear()
            if now >= locked_until:
                locked_verdict = ""
                locked_hits = []

        box = held_box.astype(np.int32) if held_box is not None else None
        is_pet = held_is_pet

        if box is not None:
            cv2.polylines(frame, [box], True, held_color, 2)
            if held_legend:
                legend.append((held_legend, held_color))

            if is_pet:
                if pet_since is None:
                    pet_since = now
                gate_active = True
                warm = now - pet_since
                warming = warm < args.gate_warmup

                # Sticky locked verdict: keep banner stable after decision
                if locked_verdict and now < locked_until:
                    verdict, vcolor = locked_verdict, locked_color
                    for name, cf in locked_hits:
                        cid = next((k for k, v in M2_NAMES.items() if v == name), None)
                        color = M2_COLORS.get(cid, (255, 255, 255))
                        legend.append((f"{name} {cf * 100:.0f}%", color))
                else:
                    r2 = m2.predict(frame, imgsz=m2_imgsz, conf=0.1,
                                    device=DEVICE, verbose=False)[0]
                    hits: list[tuple[str, float]] = []
                    if r2.obb is not None and len(r2.obb):
                        p2 = r2.obb.xyxyxyxy.cpu().numpy()
                        c2 = r2.obb.cls.cpu().numpy().astype(int)
                        f2 = r2.obb.conf.cpu().numpy()
                        contour = box.astype(np.float32)
                        inside = [i for i in range(len(p2))
                                  if center_in_poly((float(p2[i].mean(axis=0)[0]),
                                                     float(p2[i].mean(axis=0)[1])), contour)]
                        top = (pick_top1_per_class(p2[inside], c2[inside], f2[inside], (0, 1, 2))
                               if inside else {})
                        for ci, ii in top.items():
                            poly, cf = p2[inside][ii], f2[inside][ii]
                            cv2.polylines(frame, [poly.astype(np.int32)], True,
                                          M2_COLORS.get(ci, (255, 255, 255)), 2)
                            legend.append((f"{M2_NAMES.get(ci, ci)} {cf * 100:.0f}%",
                                           M2_COLORS.get(ci, (255, 255, 255))))
                            if cf >= args.m2_conf:
                                hits.append((M2_NAMES.get(ci, str(ci)), float(cf)))

                    # Layer delay #2: warm-up before M2 votes affect the banner
                    if warming:
                        remain = args.gate_warmup - warm
                        verdict, vcolor = (
                            f"PET locked — inspecting in {remain:.1f}s",
                            (0, 200, 255),
                        )
                        vote.clear()
                    else:
                        vote.append("REJECT" if hits else "ACCEPT")
                        rejects = vote.count("REJECT")
                        accepts = vote.count("ACCEPT")
                        if rejects >= vote_need:
                            parts = ", ".join(f"{k} {v * 100:.0f}%" for k, v in hits) or "residual"
                            verdict, vcolor = f"PET REJECT — {parts}", (0, 0, 255)
                            locked_verdict, locked_color = verdict, vcolor
                            locked_hits = list(hits)
                            locked_until = now + args.verdict_hold
                            vote.clear()
                        elif accepts >= vote_need:
                            verdict, vcolor = "PET ACCEPT (no cap/label/ring)", (0, 200, 0)
                            locked_verdict, locked_color = verdict, vcolor
                            locked_hits = []
                            locked_until = now + args.verdict_hold
                            vote.clear()
                        else:
                            verdict = (
                                f"judging... {rejects}R/{accepts}A "
                                f"need {vote_need}/{args.vote_window}"
                            )
            else:
                # Aluminum / other: clear PET gate state
                pet_since = None
                vote.clear()
                if now >= locked_until:
                    locked_verdict = ""
                    locked_hits = []
        else:
            legend.append(("no PET bottle / aluminum can in frame", (160, 160, 160)))

        if not gate_active and now >= locked_until:
            vote.clear()
            locked_verdict = ""
            locked_hits = []

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
