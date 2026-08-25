"""GreenGuard PC reference runtime (Ultralytics + ONNX)."""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2

SRC = Path(__file__).resolve().parent
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from config_loader import app_root, load_config, load_manifest, validate_manifest  # noqa: E402
from gate import PetGate  # noqa: E402
from pipeline import M1Pipeline, M2Pipeline  # noqa: E402
from ui import (  # noqa: E402
    draw_controls,
    draw_legend,
    draw_m1_poly,
    draw_m2_hits,
    draw_paused_banner,
    draw_verdict,
    hit_button,
    scale_for_display,
)


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="GreenGuard PC demo")
    ap.add_argument("--config", default="default")
    ap.add_argument("--source", default="0")
    ap.add_argument("--fps", type=float, default=None)
    ap.add_argument("--m1-conf", type=float, default=None)
    ap.add_argument("--m2-conf", type=float, default=None, help="M2 violation threshold override")
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--auto-start", action="store_true")
    ap.add_argument("--start-paused", action="store_true", default=True)
    ap.add_argument("--save", default=None)
    ap.add_argument("--max-frames", type=int, default=0)
    return ap.parse_args()


def main() -> int:
    args = parse_args()
    cfg = load_config(args.config)
    validate_manifest(load_manifest())

    target_fps = float(args.fps if args.fps is not None else cfg["runtime"]["target_fps"])
    interval = 1.0 / max(target_fps, 0.1)
    detecting = bool(args.auto_start) or (args.headless and not args.start_paused)
    if args.auto_start:
        detecting = True

    m1 = M1Pipeline(cfg)
    m2 = M2Pipeline(cfg)
    gate = PetGate(cfg)
    if args.m2_conf is not None:
        gate.m2_violation_conf = float(args.m2_conf)

    src = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"ERROR: cannot open source {src!r}")
        return 1

    save_dir = Path(args.save) if args.save else None
    if save_dir:
        save_dir.mkdir(parents=True, exist_ok=True)

    window = cfg["ui"].get("window_title", "GreenGuard PC Demo")
    display_scale = float(cfg["ui"].get("display_scale", 1.5))
    state = {"detecting": detecting, "start_rect": (0, 0, 0, 0), "pause_rect": (0, 0, 0, 0)}

    def reset_all():
        gate.reset()
        m1.reset_vote()

    if not args.headless:
        cv2.namedWindow(window, cv2.WINDOW_NORMAL)

        def on_mouse(event, x, y, _flags, _userdata):
            if event != cv2.EVENT_LBUTTONDOWN:
                return
            if (not state["detecting"]) and hit_button(x, y, state["start_rect"]):
                state["detecting"] = True
                reset_all()
            elif state["detecting"] and hit_button(x, y, state["pause_rect"]):
                state["detecting"] = False
                reset_all()

        cv2.setMouseCallback(window, on_mouse)

    if args.headless:
        state["detecting"] = True
        reset_all()

    frame_count = 0
    window_sized = False
    while True:
        t0 = time.perf_counter()
        ok, frame = cap.read()
        if not ok:
            print("source ended")
            break
        frame_count += 1
        legend = []
        verdict, vcolor = "", (160, 160, 160)

        if not state["detecting"]:
            draw_paused_banner(frame)
        else:
            raw = m1.run(frame, det_conf=args.m1_conf)
            held = gate.update_m1_hold(raw, now=t0)
            if held is None:
                legend.append(("no PET bottle / aluminum can in frame", (160, 160, 160)))
            else:
                draw_m1_poly(frame, held.poly, held.color)
                if held.is_pet:
                    m2_hits = m2.run(frame, held.poly)
                    result = gate.evaluate_pet(held, m2_hits, now=t0)
                    draw_m2_hits(frame, result["m2_hits"])
                    legend.extend(result["legend"])
                    verdict, vcolor = result["verdict"], result["color"]
                else:
                    legend.append((held.legend, held.color))
                    gate.state.pet_since = None
                    gate.state.vote.clear()

            draw_verdict(frame, verdict, vcolor)
            draw_legend(frame, legend)

        actual = 1.0 / max(time.perf_counter() - t0, 1e-6)
        mode = "RUNNING" if state["detecting"] else "PAUSED"
        cv2.putText(
            frame,
            f"{frame_count} | {mode} | {target_fps:.0f} fps target | {actual:.1f} actual",
            (10, frame.shape[0] - 12),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2,
        )

        if save_dir and state["detecting"]:
            cv2.imwrite(str(save_dir / f"live_{frame_count:04d}.jpg"), frame)

        if args.headless:
            print(
                f"frame={frame_count} detecting={state['detecting']} verdict={verdict!r} "
                f"legend={len(legend)}"
            )
        else:
            display = scale_for_display(frame, display_scale)
            start_r, pause_r = draw_controls(display, state["detecting"])
            state["start_rect"] = start_r
            state["pause_rect"] = pause_r
            if not window_sized:
                cv2.resizeWindow(window, display.shape[1], display.shape[0])
                window_sized = True
            cv2.imshow(window, display)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), ord("Q")):
                break
            if key in (ord("s"), ord("S"), ord(" ")):
                if not state["detecting"]:
                    state["detecting"] = True
                    reset_all()
            if key in (ord("p"), ord("P")):
                if state["detecting"]:
                    state["detecting"] = False
                    reset_all()

        if args.max_frames and frame_count >= args.max_frames:
            break
        remaining = interval - (time.perf_counter() - t0)
        if remaining > 0:
            time.sleep(remaining)

    cap.release()
    if not args.headless:
        cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
