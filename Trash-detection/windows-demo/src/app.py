"""Portable Windows detection-only demo entrypoint."""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "runtime"
sys.path.insert(0, str(RUNTIME / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
if not (RUNTIME / "src" / "pipeline.py").is_file():
    sys.path.insert(0, str(ROOT.parent / "pc-demo" / "src"))

from config_loader import load_config, load_manifest, validate_manifest  # noqa: E402
from signal_sink import SignalSink  # noqa: E402
from workflow import DemoWorkflow  # noqa: E402
from kiosk_ui import render  # noqa: E402


def parse_args():
    parser = argparse.ArgumentParser(description="GreenGuard Windows detection workflow")
    parser.add_argument("--source", default="0")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--max-frames", type=int, default=0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    signal_stream = sys.stdout
    # From this point onward stdout is reserved for exact result lines.  Keep
    # model/runtime/camera diagnostics on stderr for pipe-safe integration.
    sys.stdout = sys.stderr
    sink = SignalSink(signal_stream)
    # Import the inference adapter only after redirecting stdout; the
    # third-party model loader may print startup diagnostics.
    from pipeline import M1Pipeline, M2Pipeline

    cfg = load_config("default")
    validate_manifest(load_manifest())
    workflow = DemoWorkflow(cfg, M1Pipeline(cfg), M2Pipeline(cfg))
    source = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"Camera source unavailable: {source}", file=sys.stderr)
        return 1
    title = cfg["ui"].get("window_title", "GreenGuard Detection Demo")
    if not args.headless:
        cv2.namedWindow(title, cv2.WINDOW_NORMAL)
    frames = 0
    try:
        while True:
            started = time.perf_counter()
            ok, frame = cap.read()
            if not ok:
                print("source ended", file=sys.stderr)
                break
            frames += 1
            view = workflow.update(frame, now=started)
            if view.signal is not None:
                try:
                    sink.emit(view.signal)
                except (BrokenPipeError, OSError, ValueError) as exc:
                    print(f"signal output failed: {exc}", file=sys.stderr)
                    return 1
            if args.headless:
                print(f"frame={frames} state={view.state} title={view.title!r}", file=sys.stderr)
            else:
                cv2.imshow(
                    title,
                    render(view, int(cfg["ui"].get("canvas_width", 1280)), int(cfg["ui"].get("canvas_height", 720))),
                )
                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), ord("Q"), 27):
                    break
                if key in (ord("s"), ord("S")):
                    workflow.toggle_system()
                elif key in (ord("p"), ord("P")):
                    workflow.toggle_pause()
            if args.max_frames and frames >= args.max_frames:
                break
    finally:
        cap.release()
        if not args.headless:
            cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
