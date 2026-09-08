"""Fixed-camera RVM machine entrypoint for Windows."""
from __future__ import annotations

import argparse
from contextlib import redirect_stdout
import sys
import time
from pathlib import Path

import cv2

SRC = Path(__file__).resolve().parent
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from config_loader import load_config, load_manifest, validate_manifest  # noqa: E402
from machine_ui import hit_button, button_rects, render  # noqa: E402
from machine_workflow import MachineWorkflow  # noqa: E402
from serial_transport import SerialTransport  # noqa: E402


CAMERA_INDEX = 1


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="GreenGuard fixed-camera machine workflow")
    parser.add_argument("--config", default="default")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--auto-start", action="store_true", help="start immediately for headless validation")
    parser.add_argument("--max-frames", type=int, default=0)
    return parser.parse_args(argv)


def open_machine_camera(camera_factory=None, index: int = CAMERA_INDEX):
    """Open only camera *index*, with a backend fallback using that same index."""
    factory = cv2.VideoCapture if camera_factory is None else camera_factory
    try:
        cap = factory(index, cv2.CAP_DSHOW)
    except TypeError:
        cap = factory(index)
    if cap.isOpened():
        return cap
    cap.release()
    try:
        fallback = factory(index)
    except TypeError:
        fallback = factory(index)
    if fallback.isOpened():
        return fallback
    fallback.release()
    return None


def run(argv=None, *, camera_factory=None, pipeline_factory=None, transport_factory=None) -> int:
    args = parse_args(argv)
    cfg = load_config(args.config)
    validate_manifest(load_manifest())
    camera_index = int(cfg.get("machine", {}).get("camera_index", CAMERA_INDEX))
    if camera_index != CAMERA_INDEX:
        raise RuntimeError("machine workflow requires camera index 1")
    cap = open_machine_camera(camera_factory, camera_index)
    if cap is None:
        print("CAMERA 1 REQUIRED", file=sys.stderr)
        return 2

    if pipeline_factory is None:
        from pipeline import M1Pipeline, M2Pipeline

        pipeline_factory = lambda config: (M1Pipeline(config), M2Pipeline(config))
    with redirect_stdout(sys.stderr):
        m1, m2 = pipeline_factory(cfg)
    workflow = MachineWorkflow(cfg, m1, m2)
    transport = (transport_factory or (lambda config, stdout, stderr: SerialTransport(
        config.get("machine", {}), stdout=stdout, stderr=stderr
    )))(cfg, sys.stdout, sys.stderr)

    title = cfg.get("ui", {}).get("window_title", "GreenGuard Machine")
    if args.auto_start:
        workflow.start()
    if not args.headless:
        cv2.namedWindow(title, cv2.WINDOW_NORMAL)
        controls = {"run": (0, 0, 0, 0), "pause": (0, 0, 0, 0)}

        def on_mouse(event, x, y, _flags, _userdata):
            if event != cv2.EVENT_LBUTTONDOWN:
                return
            if hit_button(x, y, controls["run"]):
                workflow.start()
            elif hit_button(x, y, controls["pause"]):
                workflow.pause()

        cv2.setMouseCallback(title, on_mouse)

    frame_count = 0
    try:
        while True:
            if not args.headless and cv2.getWindowProperty(title, cv2.WND_PROP_VISIBLE) < 1:
                break
            ok, frame = cap.read()
            if not ok:
                workflow.camera_failed()
                print("CAMERA 1 REQUIRED", file=sys.stderr)
                break
            frame_count += 1
            if workflow.running and not workflow.paused:
                transport.refresh_idle()
            with redirect_stdout(sys.stderr):
                view = workflow.update(frame, now=time.perf_counter())
            if view.command is not None:
                transport.send(view.command)

            if args.headless:
                print(f"frame={frame_count} state={view.state!r} result={view.result!r}", file=sys.stderr)
            else:
                display = render(frame, view.state, view.result, workflow.running)
                controls["run"], controls["pause"] = button_rects(display.shape[1], display.shape[0])
                cv2.imshow(title, display)
                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), ord("Q"), 27):
                    break
                if key in (ord("s"), ord("S"), ord(" ")):
                    workflow.start()
                elif key in (ord("p"), ord("P")):
                    workflow.pause()

            if args.max_frames and frame_count >= args.max_frames:
                break
    finally:
        cap.release()
        transport.close()
        if not args.headless:
            cv2.destroyAllWindows()
    return 0 if not workflow.camera_required else 2

def main(argv=None) -> int:
    return run(argv)


if __name__ == "__main__":
    raise SystemExit(main())
