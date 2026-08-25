r"""GreenGuard live demo — Model 1 + Model 2 gate (Trash-detection root).

Runs the full kiosk workflow from this folder:
  Camera → Model 1 (PET vs can) → Model 2 (cap/label/ring) → ACCEPT/REJECT

Controls:
  Click START / PAUSE buttons on screen, or:
    S / Space  — start detection
    P          — pause detection
    Q          — quit

Usage (from Trash-detection/):
  .\run_live_demo.bat
  training\model1\.venv\Scripts\python.exe run_live_demo.py
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

ROOT = Path(__file__).resolve().parent
M1_ROOT = ROOT / "training" / "model1"
M2_ROOT = ROOT / "training" / "model2"
sys.path.insert(0, str(M1_ROOT / "scripts"))
sys.path.insert(0, str(M2_ROOT / "scripts"))
from m1_two_stage import PetCanDecider  # noqa: E402
from single_instance import center_in_poly, pick_top1_per_class  # noqa: E402

M1_CANDIDATES = [
    (M1_ROOT / "export" / "onnx_416" / "model.onnx", 0, 1),
    (M1_ROOT / "runs" / "seed42_n640" / "weights" / "best.pt", 0, 1),
    (M1_ROOT / "export" / "v1_4class" / "onnx_416" / "model.onnx", 0, 3),
    (M1_ROOT / "runs" / "v1_4class" / "seed7_n640" / "weights" / "best.pt", 0, 3),
    (M1_ROOT / "runs" / "v1_4class" / "seed42_n640" / "weights" / "best.pt", 0, 3),
]
M2_CANDIDATES = [
    M2_ROOT / "export" / "candidates" / "m2v4_caplabel_seed42_n640" / "onnx_640" / "model.onnx",
    M2_ROOT / "export" / "candidates" / "m2v4_caplabel_seed42_n640" / "onnx_416" / "model.onnx",
    M2_ROOT / "runs" / "m2v4_caplabel_seed42_n640" / "weights" / "best.pt",
    M2_ROOT / "export" / "onnx_640" / "model.onnx",
    M2_ROOT / "export" / "onnx_416" / "model.onnx",
    M2_ROOT / "runs" / "m2v3_seed42_n640" / "weights" / "best.pt",
]
M2_NAMES = {0: "cap", 1: "label", 2: "ring"}
M2_REF = (
    M2_ROOT / "runs" / "m2v4_caplabel_seed42_n640" / "weights" / "best.pt"
    if (M2_ROOT / "runs" / "m2v4_caplabel_seed42_n640" / "weights" / "best.pt").is_file()
    else M2_ROOT / "runs" / "m2v3_seed42_n640" / "weights" / "best.pt"
)
M2_COLORS = {0: (0, 0, 255), 1: (0, 255, 255), 2: (255, 0, 255)}
DEVICE = "cpu"
WINDOW = "GreenGuard live — M1+M2 (START/PAUSE | Q=quit)"
DISPLAY_SCALE = 1.5

# Button layout (x1, y1, x2, y2) — bottom-right, updated each frame from size
BTN_H, BTN_W, BTN_GAP, BTN_MARGIN = 44, 130, 12, 16


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
                print(f"[live] {label}: {c[0]}")
                return c
        elif c.is_file():
            print(f"[live] {label}: {c}")
            return c
    print(f"[live] ERROR: no {label} model. Looked for:\n  "
          + "\n  ".join(str(c[0] if isinstance(c, tuple) else c) for c in candidates))
    raise SystemExit(1)


def onnx_imgsz(path: Path) -> int | None:
    try:
        import onnxruntime as ort
        session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        n = session.get_inputs()[0].shape[2]
        return int(n) if isinstance(n, int) else None
    except Exception:
        return None


def smooth_poly(prev: np.ndarray | None, new: np.ndarray, alpha: float) -> np.ndarray:
    new_f = new.astype(np.float32)
    if prev is None or prev.shape != new_f.shape:
        return new_f
    return (alpha * new_f) + ((1.0 - alpha) * prev.astype(np.float32))


def scale_for_display(frame: np.ndarray, scale: float = DISPLAY_SCALE) -> np.ndarray:
    """Upscale camera feed for the OpenCV window (inference stays native size)."""
    h, w = frame.shape[:2]
    return cv2.resize(
        frame,
        (int(w * scale), int(h * scale)),
        interpolation=cv2.INTER_LINEAR,
    )


def button_rects(frame_w: int, frame_h: int):
    y2 = frame_h - BTN_MARGIN
    y1 = y2 - BTN_H
    pause = (frame_w - BTN_MARGIN - BTN_W, y1, frame_w - BTN_MARGIN, y2)
    start = (pause[0] - BTN_GAP - BTN_W, y1, pause[0] - BTN_GAP, y2)
    return start, pause


def hit_button(x: int, y: int, rect) -> bool:
    x1, y1, x2, y2 = rect
    return x1 <= x <= x2 and y1 <= y <= y2


def draw_button(frame, rect, label: str, active: bool, enabled: bool = True):
    x1, y1, x2, y2 = rect
    if not enabled:
        fill, border, text = (50, 50, 50), (90, 90, 90), (140, 140, 140)
    elif active:
        fill, border, text = (0, 140, 0), (0, 220, 0), (255, 255, 255)
    else:
        fill, border, text = (40, 40, 40), (200, 200, 200), (230, 230, 230)
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), fill, -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
    cv2.rectangle(frame, (x1, y1), (x2, y2), border, 2)
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
    cv2.putText(
        frame,
        label,
        (x1 + (x2 - x1 - tw) // 2, y1 + (y2 - y1 + th) // 2),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        text,
        2,
    )


def draw_controls(frame, detecting: bool):
    h, w = frame.shape[:2]
    start_r, pause_r = button_rects(w, h)
    draw_button(frame, start_r, "START", active=detecting, enabled=not detecting)
    draw_button(frame, pause_r, "PAUSE", active=not detecting, enabled=detecting)
    return start_r, pause_r


def reset_gate_state(state: dict):
    state["held_box"] = None
    state["held_is_pet"] = False
    state["held_color"] = (160, 160, 160)
    state["held_legend"] = ""
    state["miss_frames"] = 0
    state["pet_since"] = None
    state["locked_verdict"] = ""
    state["locked_color"] = (160, 160, 160)
    state["locked_hits"] = []
    state["locked_until"] = 0.0
    state["vote"].clear()
    if state.get("m1_decider") is not None:
        state["m1_decider"].reset_vote()


def main() -> int:
    ap = argparse.ArgumentParser(description="GreenGuard live M1+M2 demo (Trash-detection root)")
    ap.add_argument("--source", default="0")
    ap.add_argument("--fps", type=float, default=5.0)
    ap.add_argument("--m1-conf", type=float, default=0.05)
    ap.add_argument("--no-m1-cls", action="store_true")
    ap.add_argument("--m2-conf", type=float, default=0.5)
    ap.add_argument("--m2-imgsz", type=int, default=640)
    ap.add_argument("--gate-warmup", type=float, default=0.5)
    ap.add_argument("--verdict-hold", type=float, default=1.5)
    ap.add_argument("--miss-hold", type=int, default=3)
    ap.add_argument("--vote-window", type=int, default=7)
    ap.add_argument("--vote-need", type=int, default=4)
    ap.add_argument("--box-smooth", type=float, default=0.35)
    ap.add_argument("--start-paused", action="store_true", default=True,
                    help="begin paused until START (default)")
    ap.add_argument("--auto-start", action="store_true",
                    help="begin detecting immediately")
    ap.add_argument("--save", default=None)
    ap.add_argument("--max-frames", type=int, default=0)
    args = ap.parse_args()

    vote_need = max(1, min(args.vote_need, args.vote_window))
    box_alpha = min(max(args.box_smooth, 0.05), 1.0)
    detecting = bool(args.auto_start)

    m1_c = pick(M1_CANDIDATES, "Model 1 (PET/aluminum)")
    m2_cands = [c for c in M2_CANDIDATES
                if not (c.suffix == ".onnx" and M2_REF.is_file()
                        and c.stat().st_mtime < M2_REF.stat().st_mtime)]
    for c in M2_CANDIDATES:
        if c not in m2_cands:
            print(f"STALE EXPORT - skipping {c} (older than {M2_REF})")
    m2_path = pick(m2_cands, "Model 2 (cap/label/ring)")
    if str(m2_path).endswith(".onnx"):
        print(f"[live] Model 2 onnx date: {onnx_date(Path(m2_path))}")
    m1_path, m1_bottle, m1_aluminum = m1_c
    m1_imgsz = onnx_imgsz(m1_path) or 416
    m2_imgsz = onnx_imgsz(m2_path) or args.m2_imgsz
    print(f"[live] inference sizes: M1 det={m1_imgsz}, M2={m2_imgsz}")
    print(
        f"[live] anti-flicker: warmup={args.gate_warmup:.1f}s "
        f"hold={args.verdict_hold:.1f}s miss={args.miss_hold} "
        f"vote={vote_need}/{args.vote_window}"
    )
    print("[live] controls: START/PAUSE buttons | S/Space=start | P=pause | Q=quit")

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
            print("[live] Model 1 mode: two-stage (detect + classify)")
        except FileNotFoundError as e:
            print(f"[live] classifier missing ({e}); legacy detector classes")
    if m1_decider is None:
        m1 = YOLO(str(m1_path), task="obb" if m1_path.suffix == ".onnx" else None)
        print("[live] Model 1 mode: detector-only")
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
    state = {
        "vote": deque(maxlen=max(1, args.vote_window)),
        "held_box": None,
        "held_is_pet": False,
        "held_color": (160, 160, 160),
        "held_legend": "",
        "miss_frames": 0,
        "pet_since": None,
        "locked_verdict": "",
        "locked_color": (160, 160, 160),
        "locked_hits": [],
        "locked_until": 0.0,
        "m1_decider": m1_decider,
        "start_rect": (0, 0, 0, 0),
        "pause_rect": (0, 0, 0, 0),
        "detecting": detecting,
    }

    def on_mouse(event, x, y, _flags, _userdata):
        if event != cv2.EVENT_LBUTTONDOWN:
            return
        if (not state["detecting"]) and hit_button(x, y, state["start_rect"]):
            state["detecting"] = True
            reset_gate_state(state)
            print("[live] START — detection on")
        elif state["detecting"] and hit_button(x, y, state["pause_rect"]):
            state["detecting"] = False
            reset_gate_state(state)
            print("[live] PAUSE — detection off")

    cv2.namedWindow(WINDOW, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(WINDOW, on_mouse)

    n = 0
    window_sized = False
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
        detecting = state["detecting"]

        if not detecting:
            # Live camera only — no inference while paused
            banner = "PAUSED — click START or press S / Space"
            (tw, th), _ = cv2.getTextSize(banner, cv2.FONT_HERSHEY_SIMPLEX, 0.85, 2)
            cv2.rectangle(
                frame,
                (frame.shape[1] // 2 - tw // 2 - 10, 8),
                (frame.shape[1] // 2 + tw // 2 + 10, 8 + th + 18),
                (0, 0, 0),
                -1,
            )
            cv2.putText(
                frame,
                banner,
                (frame.shape[1] // 2 - tw // 2, 8 + th + 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.85,
                (0, 180, 255),
                2,
            )
        else:
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
                r1_legacy = m1.predict(
                    frame, imgsz=m1_imgsz, conf=max(args.m1_conf, 0.25),
                    device=DEVICE, verbose=False,
                )[0]
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

            if raw_box is not None:
                state["miss_frames"] = 0
                state["held_box"] = smooth_poly(state["held_box"], raw_box, box_alpha)
                state["held_is_pet"] = raw_is_pet
                state["held_color"] = raw_color
                state["held_legend"] = raw_legend
            elif state["held_box"] is not None and state["miss_frames"] < args.miss_hold:
                state["miss_frames"] += 1
            else:
                state["held_box"] = None
                state["held_is_pet"] = False
                state["held_legend"] = ""
                state["miss_frames"] = 0
                state["pet_since"] = None
                state["vote"].clear()
                if now >= state["locked_until"]:
                    state["locked_verdict"] = ""
                    state["locked_hits"] = []

            box = state["held_box"].astype(np.int32) if state["held_box"] is not None else None
            is_pet = state["held_is_pet"]

            if box is not None:
                cv2.polylines(frame, [box], True, state["held_color"], 2)
                if state["held_legend"]:
                    legend.append((state["held_legend"], state["held_color"]))

                if is_pet:
                    if state["pet_since"] is None:
                        state["pet_since"] = now
                    gate_active = True
                    warm = now - state["pet_since"]
                    warming = warm < args.gate_warmup

                    if state["locked_verdict"] and now < state["locked_until"]:
                        verdict, vcolor = state["locked_verdict"], state["locked_color"]
                        for name, cf in state["locked_hits"]:
                            cid = next((k for k, v in M2_NAMES.items() if v == name), None)
                            color = M2_COLORS.get(cid, (255, 255, 255))
                            legend.append((f"{name} {cf * 100:.0f}%", color))
                    else:
                        r2 = m2.predict(
                            frame, imgsz=m2_imgsz, conf=0.1,
                            device=DEVICE, verbose=False,
                        )[0]
                        hits: list[tuple[str, float]] = []
                        if r2.obb is not None and len(r2.obb):
                            p2 = r2.obb.xyxyxyxy.cpu().numpy()
                            c2 = r2.obb.cls.cpu().numpy().astype(int)
                            f2 = r2.obb.conf.cpu().numpy()
                            contour = box.astype(np.float32)
                            inside = [
                                i for i in range(len(p2))
                                if center_in_poly(
                                    (float(p2[i].mean(axis=0)[0]),
                                     float(p2[i].mean(axis=0)[1])),
                                    contour,
                                )
                            ]
                            top = (
                                pick_top1_per_class(
                                    p2[inside], c2[inside], f2[inside], (0, 1, 2)
                                )
                                if inside else {}
                            )
                            for ci, ii in top.items():
                                poly, cf = p2[inside][ii], f2[inside][ii]
                                cv2.polylines(
                                    frame, [poly.astype(np.int32)], True,
                                    M2_COLORS.get(ci, (255, 255, 255)), 2,
                                )
                                legend.append((
                                    f"{M2_NAMES.get(ci, ci)} {cf * 100:.0f}%",
                                    M2_COLORS.get(ci, (255, 255, 255)),
                                ))
                                if cf >= args.m2_conf:
                                    hits.append((M2_NAMES.get(ci, str(ci)), float(cf)))

                        if warming:
                            remain = args.gate_warmup - warm
                            verdict, vcolor = (
                                f"PET locked — inspecting in {remain:.1f}s",
                                (0, 200, 255),
                            )
                            state["vote"].clear()
                        else:
                            state["vote"].append("REJECT" if hits else "ACCEPT")
                            rejects = state["vote"].count("REJECT")
                            accepts = state["vote"].count("ACCEPT")
                            if rejects >= vote_need:
                                parts = ", ".join(
                                    f"{k} {v * 100:.0f}%" for k, v in hits
                                ) or "residual"
                                verdict = f"PET REJECT — {parts}"
                                vcolor = (0, 0, 255)
                                state["locked_verdict"] = verdict
                                state["locked_color"] = vcolor
                                state["locked_hits"] = list(hits)
                                state["locked_until"] = now + args.verdict_hold
                                state["vote"].clear()
                            elif accepts >= vote_need:
                                verdict = "PET ACCEPT (no cap/label/ring)"
                                vcolor = (0, 200, 0)
                                state["locked_verdict"] = verdict
                                state["locked_color"] = vcolor
                                state["locked_hits"] = []
                                state["locked_until"] = now + args.verdict_hold
                                state["vote"].clear()
                            else:
                                verdict = (
                                    f"judging... {rejects}R/{accepts}A "
                                    f"need {vote_need}/{args.vote_window}"
                                )
                else:
                    state["pet_since"] = None
                    state["vote"].clear()
                    if now >= state["locked_until"]:
                        state["locked_verdict"] = ""
                        state["locked_hits"] = []
            else:
                legend.append(("no PET bottle / aluminum can in frame", (160, 160, 160)))

            if not gate_active and now >= state["locked_until"]:
                state["vote"].clear()
                state["locked_verdict"] = ""
                state["locked_hits"] = []

            if verdict:
                (tw, th), _ = cv2.getTextSize(verdict, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
                cv2.rectangle(
                    frame,
                    (frame.shape[1] // 2 - tw // 2 - 8, 8),
                    (frame.shape[1] // 2 + tw // 2 + 8, 8 + th + 16),
                    (0, 0, 0),
                    -1,
                )
                cv2.putText(
                    frame,
                    verdict,
                    (frame.shape[1] // 2 - tw // 2, 8 + th + 6),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.9,
                    vcolor,
                    2,
                )
            for i, (text, color) in enumerate(legend):
                cv2.putText(
                    frame, text, (12, 30 + i * 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2,
                )

        actual = 1.0 / max(time.perf_counter() - t0, 1e-6)
        mode = "RUNNING" if detecting else "PAUSED"
        cv2.putText(
            frame,
            f"{n} | {mode} | {args.fps:.0f} fps target | {actual:.1f} actual",
            (10, frame.shape[0] - 12),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2,
        )

        if save_dir and detecting:
            cv2.imwrite(str(save_dir / f"live_{n:04d}.jpg"), frame)

        display = scale_for_display(frame)
        start_r, pause_r = draw_controls(display, detecting)
        state["start_rect"] = start_r
        state["pause_rect"] = pause_r
        if not window_sized:
            cv2.resizeWindow(WINDOW, display.shape[1], display.shape[0])
            window_sized = True
        cv2.imshow(WINDOW, display)

        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), ord("Q")):
            break
        if key in (ord("s"), ord("S"), ord(" ")):
            if not state["detecting"]:
                state["detecting"] = True
                reset_gate_state(state)
                print("[live] START — detection on")
        if key in (ord("p"), ord("P")):
            if state["detecting"]:
                state["detecting"] = False
                reset_gate_state(state)
                print("[live] PAUSE — detection off")
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
