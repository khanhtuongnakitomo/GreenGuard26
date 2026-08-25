"""GreenGuard PC reference runtime (Ultralytics + ONNX)."""
from __future__ import annotations

import argparse
import sys
import threading
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

MAX_CAM_INDEX = 7  # highest camera index to try when cycling


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


def _try_open_next_camera(current_idx: int, result: dict) -> None:
    """Background thread: try camera indices after *current_idx*, wrapping around.

    Writes into *result* dict so the main loop can pick it up without blocking.
    Sets result["cap"] to the opened VideoCapture (or None on failure),
    and result["idx"] to the camera index that worked (or -1).
    """
    for offset in range(1, MAX_CAM_INDEX + 1):
        candidate = (current_idx + offset) % (MAX_CAM_INDEX + 1)
        cap = cv2.VideoCapture(candidate, cv2.CAP_DSHOW)
        if cap.isOpened():
            result["cap"] = cap
            result["idx"] = candidate
            result["done"] = True
            return
    # nothing found — signal failure
    result["cap"] = None
    result["idx"] = -1
    result["done"] = True


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
    is_camera = isinstance(src, int)
    cam_idx = src if is_camera else 0

    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"ERROR: cannot open source {src!r}")
        return 1

    save_dir = Path(args.save) if args.save else None
    if save_dir:
        save_dir.mkdir(parents=True, exist_ok=True)

    window = cfg["ui"].get("window_title", "GreenGuard PC Demo")
    display_scale = float(cfg["ui"].get("display_scale", 1.5))
    state = {
        "detecting": detecting,
        "start_rect": (0, 0, 0, 0),
        "pause_rect": (0, 0, 0, 0),
        "cam_rect": (0, 0, 0, 0),
        "switch_cam": False,
    }

    # Background camera-switch state
    cam_switch_result: dict | None = None  # set while a switch is in-flight
    switching = False  # True while the background thread is working

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
            elif hit_button(x, y, state["cam_rect"]):
                state["switch_cam"] = True

        cv2.setMouseCallback(window, on_mouse)

    if args.headless:
        state["detecting"] = True
        reset_all()

    frame_count = 0
    window_sized = False
    while True:
        t0 = time.perf_counter()

        # ── Check if a background camera switch has completed ─────────
        if switching and cam_switch_result and cam_switch_result.get("done"):
            new_cap = cam_switch_result["cap"]
            new_idx = cam_switch_result["idx"]
            if new_cap is not None and new_cap.isOpened():
                cap.release()
                cap = new_cap
                cam_idx = new_idx
                print(f"[Camera] Switched to camera {cam_idx}")
            else:
                print("[Camera] No other camera found, staying on current")
                if new_cap is not None:
                    new_cap.release()
            reset_all()
            state["detecting"] = False
            switching = False
            cam_switch_result = None

        ok, frame = cap.read()
        if not ok:
            print("source ended")
            break
        frame_count += 1
        legend = []
        verdict, vcolor = "", (160, 160, 160)

        if switching:
            # Show a non-blocking "switching" banner while thread works
            banner = "Switching camera..."
            (tw, th), _ = cv2.getTextSize(banner, cv2.FONT_HERSHEY_SIMPLEX, 0.85, 2)
            cx = frame.shape[1] // 2
            cv2.rectangle(frame, (cx - tw // 2 - 10, 8), (cx + tw // 2 + 10, 8 + th + 18), (0, 0, 0), -1)
            cv2.putText(frame, banner, (cx - tw // 2, 8 + th + 8), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (0, 200, 255), 2)
        elif not state["detecting"]:
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
        mode = "SWITCHING" if switching else ("RUNNING" if state["detecting"] else "PAUSED")
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
            cam_label = f"CAM {cam_idx}" if is_camera else "FILE"
            if switching:
                cam_label = "..."
            display = scale_for_display(frame, display_scale)
            start_r, pause_r, cam_r = draw_controls(display, state["detecting"], cam_label)
            state["start_rect"] = start_r
            state["pause_rect"] = pause_r
            state["cam_rect"] = cam_r
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
            if key in (ord("c"), ord("C")):
                state["switch_cam"] = True

            # ── Kick off background camera switch ────────────────────────
            if state["switch_cam"] and is_camera and not switching:
                state["switch_cam"] = False
                switching = True
                cam_switch_result = {"done": False, "cap": None, "idx": -1}
                t = threading.Thread(
                    target=_try_open_next_camera,
                    args=(cam_idx, cam_switch_result),
                    daemon=True,
                )
                t.start()
                print(f"[Camera] Looking for next camera after index {cam_idx}...")
            else:
                state["switch_cam"] = False

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
