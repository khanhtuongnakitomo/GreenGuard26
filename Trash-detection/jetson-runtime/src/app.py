"""GreenGuard Jetson detection runtime entrypoint."""
import argparse
import os
import sys
import time

import cv2

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from config_loader import load_config, load_manifest, validate_manifest  # noqa: E402
from camera import Camera  # noqa: E402
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


def parse_args():
    ap = argparse.ArgumentParser(description="GreenGuard Jetson demo")
    ap.add_argument("--config", default="default")
    ap.add_argument("--source", default="0")
    ap.add_argument("--backend", default="auto", choices=["auto", "tensorrt", "onnx"])
    ap.add_argument("--fps", type=float, default=None)
    ap.add_argument("--m1-conf", type=float, default=None)
    ap.add_argument("--m2-conf", type=float, default=None)
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--auto-start", action="store_true")
    ap.add_argument("--save", default=None)
    ap.add_argument("--max-frames", type=int, default=0)
    return ap.parse_args()


def main():
    args = parse_args()
    cfg = load_config(args.config)
    validate_manifest(load_manifest())

    target_fps = float(args.fps if args.fps is not None else cfg["runtime"]["target_fps"])
    interval = 1.0 / max(target_fps, 0.1)
    backend_mode = args.backend or cfg["runtime"].get("backend", "auto")

    m1 = M1Pipeline(cfg, backend_mode=backend_mode)
    m2 = M2Pipeline(cfg, backend_mode=backend_mode)
    gate = PetGate(cfg)
    if args.m2_conf is not None:
        gate.m2_violation_conf = float(args.m2_conf)

    source = int(args.source) if str(args.source).isdigit() else args.source
    camera = Camera(source, gstreamer=cfg.get("camera", {}).get("gstreamer"))
    if not camera.open():
        print("ERROR: cannot open source %r" % (source,))
        return 1

    save_dir = args.save
    if save_dir:
        os.makedirs(save_dir, exist_ok=True)

    window = cfg["ui"].get("window_title", "GreenGuard Jetson Demo")
    display_scale = float(cfg["ui"].get("display_scale", 1.5))
    state = {"detecting": bool(args.auto_start or args.headless), "start_rect": (0, 0, 0, 0), "pause_rect": (0, 0, 0, 0)}

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
        reset_all()

    frame_count = 0
    window_sized = False
    try:
        while True:
            t0 = time.perf_counter()
            ok, frame = camera.read()
            if not ok or frame is None:
                time.sleep(0.01)
                continue
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
                "%d | %s | %.0f fps target | %.1f actual | %s/%s" % (
                    frame_count,
                    mode,
                    target_fps,
                    actual,
                    m1.det.backend_name,
                    m2.runner.backend_name,
                ),
                (10, frame.shape[0] - 12),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                2,
            )

            if save_dir and state["detecting"]:
                cv2.imwrite(os.path.join(save_dir, "live_%04d.jpg" % frame_count), frame)

            if args.headless:
                print("frame=%d verdict=%r" % (frame_count, verdict))
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
    finally:
        camera.release()
        m1.close()
        m2.close()
        if not args.headless:
            cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
