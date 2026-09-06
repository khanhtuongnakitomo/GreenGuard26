"""Portable Windows workflow entrypoint; serial is explicit opt-in."""
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

from config_loader import load_config, load_manifest, validate_manifest  # noqa: E402
from gate import PetGate  # noqa: E402
from kiosk_ui import render  # noqa: E402
from pipeline import M1Pipeline, M2Pipeline  # noqa: E402
from serial_controller import RVMSerialController  # noqa: E402
from workflow import DemoWorkflow  # noqa: E402


def parse_args():
    parser = argparse.ArgumentParser(description="GreenGuard Windows RVM workflow")
    parser.add_argument("--source", default="0")
    parser.add_argument("--serial-port", default=None)
    parser.add_argument("--enable-serial", action="store_true")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--max-frames", type=int, default=0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    cfg = load_config("default")
    if not args.enable_serial:
        cfg["serial"]["enabled"] = False
    else:
        cfg["serial"]["enabled"] = True
        if args.serial_port: cfg["serial"]["port"] = args.serial_port
    validate_manifest(load_manifest())
    controller = RVMSerialController(cfg["serial"])
    if args.enable_serial: controller.connect()
    workflow = DemoWorkflow(cfg, M1Pipeline(cfg), M2Pipeline(cfg), PetGate(cfg), controller)
    source = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(source)
    if not cap.isOpened(): print(f"Camera source unavailable: {source}"); return 1
    title = cfg["ui"].get("window_title", "GreenGuard Recycling")
    if not args.headless: cv2.namedWindow(title, cv2.WINDOW_NORMAL)
    frames = 0
    try:
        while True:
            started = time.perf_counter(); ok, frame = cap.read()
            if not ok: break
            frames += 1; view = workflow.update(frame, now=started)
            if args.headless: print(f"frame={frames} state={view.state} title={view.title!r}")
            else:
                cv2.imshow(title, render(view, controller.connected, int(cfg["ui"].get("canvas_width", 1280)), int(cfg["ui"].get("canvas_height", 720))))
                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), ord("Q"), 27): break
                if key in (ord("s"), ord("S")): workflow.toggle_system()
                elif key in (ord("p"), ord("P")): workflow.toggle_pause()
                elif key == ord("0"): workflow.emergency_stop()
            if args.max_frames and frames >= args.max_frames: break
    finally:
        cap.release(); controller.close()
        if not args.headless: cv2.destroyAllWindows()
    return 0


if __name__ == "__main__": raise SystemExit(main())
