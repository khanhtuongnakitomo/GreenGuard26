"""GreenGuard PC reference runtime (Ultralytics + ONNX)."""
from __future__ import annotations

import argparse
import os
import sys
import threading
import time
from pathlib import Path

import cv2
import numpy as np

SRC = Path(__file__).resolve().parent
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from config_loader import app_root, load_config, load_manifest, validate_manifest  # noqa: E402
from gate import PetGate  # noqa: E402
from decision_core import CanonicalWorkflow  # noqa: E402
from dashboard_transport import DashboardTransport  # noqa: E402
from pipeline import M1Pipeline, M2Pipeline  # noqa: E402
from parallel_preview import ParallelInferenceRunner, ParallelPreviewWorkflow, PreviewEvidence  # noqa: E402
from serial_transport import SerialTransport  # noqa: E402
from ui import (  # noqa: E402
    draw_controls,
    draw_legend,
    draw_m1_poly,
    draw_m2_hits,
    draw_preview_confidence_panel,
    draw_preview_result,
    draw_paused_banner,
    draw_qr_screen,
    draw_session_panel,
    draw_verdict,
    hit_button,
    scale_for_display,
)

MAX_CAM_INDEX = 7  # highest camera index to try when cycling
RESULT_NOTIFICATION_SECONDS = 2.0


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="GreenGuard PC demo")
    ap.add_argument("--config", default="default")
    ap.add_argument("--manifest", default=None, help="optional model manifest override")
    ap.add_argument("--mode", choices=["full", "model1", "model2", "parallel-preview"], default="full")
    ap.add_argument("--m1-config", default=None, help="replace only Model 1 settings in parallel-preview mode")
    ap.add_argument("--source", default="0")
    ap.add_argument("--fps", type=float, default=None)
    ap.add_argument("--m1-conf", type=float, default=None)
    ap.add_argument("--m2-conf", type=float, default=None, help="M2 violation threshold override")
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--auto-start", action="store_true")
    ap.add_argument(
        "--start-paused",
        action="store_true",
        help="open the preview paused, even when a launcher supplies --auto-start",
    )
    ap.add_argument("--save", default=None)
    ap.add_argument("--max-frames", type=int, default=0)
    ap.add_argument(
        "--dashboard-api-url",
        default=os.environ.get("DASHBOARD_API_URL", ""),
        help="local Dashboard API base URL; enables detection telemetry",
    )
    ap.add_argument(
        "--machine-code",
        default=os.environ.get("DASHBOARD_MACHINE_CODE", "0001"),
        help="machine code attached to dashboard detection events",
    )
    ap.add_argument(
        "--require-dashboard",
        action="store_true",
        help="fail before opening the camera when the telemetry API is unavailable",
    )
    ap.add_argument(
        "--publish-dashboard",
        action="store_true",
        help="allow parallel-preview results to update the local Dashboard",
    )
    ap.add_argument(
        "--controller-output",
        choices=["terminal", "serial"],
        default=None,
        help="send finalized preview signals to terminal or a strict USB serial controller",
    )
    ap.add_argument(
        "--controller-port",
        default=None,
        help="explicit USB serial port for --controller-output serial, for example COM7",
    )
    ap.add_argument(
        "--pause-after-result",
        action="store_true",
        help="pause preview detection after each finalized result until the operator presses Run",
    )
    ap.add_argument(
        "--session-mode",
        choices=["inactivity", "manual"],
        default="inactivity",
        help="Dashboard session policy; manual sessions are finalized with F",
    )
    ap.add_argument(
        "--result-hold-seconds",
        type=float,
        default=None,
        help="override how long a parallel-preview result remains visible before clear-frame re-arm",
    )
    return ap.parse_args()


def _event_confidence(step, cfg: dict) -> float:
    """Return the average confidence of the winning Model 1 three-frame vote."""
    if step.m1_window is not None and step.m1_window.average_confidence is not None:
        return float(step.m1_window.average_confidence)
    if step.m1_raw is not None and float(getattr(step.m1_raw, "confidence", 0.0)) > 0:
        return float(step.m1_raw.confidence)
    detector = cfg.get("m1", {}).get("detector", {})
    thresholds = detector.get("decision_conf_by_class", {})
    class_name = "metal_can" if step.result == "ALUMINUM_CAN" else "pet_bottle"
    return float(thresholds.get(class_name, detector.get("decision_conf", 0.5)))


def _preview_dashboard_result(result: str) -> str:
    return {
        "ALUMINUM": "ALUMINUM_CAN",
        "GOOD PET": "PET_CLEAN",
        "BAD PET": "PET_REJECT",
    }[result]


def _preview_event_confidence(step) -> float:
    if step.result == "BAD PET" and step.m2_hits:
        return max(float(hit.confidence) for hit in step.m2_hits)
    if step.m1_average is not None:
        return float(step.m1_average)
    return float(getattr(step.m1, "confidence", 0.0))


def _preview_controller_signal(result: str) -> int:
    return {
        "ALUMINUM": 1,
        "GOOD PET": 2,
        "BAD PET": 3,
    }[result]


def _result_notification_visible(expires_at: float, now: float) -> bool:
    """Keep the result overlay visible briefly without blocking the paused UI."""
    return now < expires_at


def _send_emergency_stop(controller) -> None:
    """Emit the ESP-only stop byte without publishing a dashboard event."""
    controller.send("EMERGENCY_STOP")


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
    manifest_reference = args.manifest or cfg.get("manifest")
    validate_manifest(load_manifest(manifest_reference))

    preview_model_label = "MODEL 1 ACTIVE"
    if args.mode == "parallel-preview":
        if args.require_dashboard and not args.publish_dashboard:
            print("ERROR: --require-dashboard needs --publish-dashboard in parallel-preview mode", file=sys.stderr)
            return 2
        if args.m1_config:
            m1_cfg = load_config(args.m1_config)
            candidate_reference = m1_cfg.get("manifest", "models/m1_candidate_manifest.json")
            validate_manifest(load_manifest(candidate_reference))
            cfg["m1"] = m1_cfg["m1"]
            preview_model_label = "MODEL 1-B CANDIDATE — FAILED PARITY / NOT ACTIVE"
    elif args.publish_dashboard:
        print("ERROR: --publish-dashboard is only supported in parallel-preview mode", file=sys.stderr)
        return 2
    if args.controller_output and args.mode != "parallel-preview":
        print("ERROR: --controller-output is only supported in parallel-preview mode", file=sys.stderr)
        return 2
    if args.pause_after_result and args.mode != "parallel-preview":
        print("ERROR: --pause-after-result is only supported in parallel-preview mode", file=sys.stderr)
        return 2
    if args.session_mode == "manual" and args.mode != "parallel-preview":
        print("ERROR: --session-mode manual is only supported in parallel-preview mode", file=sys.stderr)
        return 2
    if args.session_mode == "manual" and not args.publish_dashboard:
        print("ERROR: manual sessions require --publish-dashboard", file=sys.stderr)
        return 2
    if args.result_hold_seconds is not None and args.result_hold_seconds < 0:
        print("ERROR: --result-hold-seconds must be non-negative", file=sys.stderr)
        return 2
    if args.controller_port and args.controller_output != "serial":
        print("ERROR: --controller-port requires --controller-output serial", file=sys.stderr)
        return 2

    dashboard = None
    dashboard_allowed = args.mode != "parallel-preview" or args.publish_dashboard
    if dashboard_allowed and args.dashboard_api_url:
        try:
            dashboard = DashboardTransport(
                args.dashboard_api_url,
                args.machine_code,
            )
            if args.require_dashboard:
                dashboard.check_health()
            print(f"[Dashboard] telemetry enabled for machine {args.machine_code}")
        except Exception as exc:
            print(f"ERROR: dashboard telemetry unavailable: {exc}", file=sys.stderr)
            if dashboard is not None:
                dashboard.close()
            return 2
    elif dashboard_allowed and args.require_dashboard:
        print("ERROR: --require-dashboard needs DASHBOARD_API_URL or --dashboard-api-url", file=sys.stderr)
        return 2

    controller = None
    if args.controller_output:
        serial_cfg = dict(cfg.get("machine", {}).get("serial", {}))
        if args.controller_port:
            serial_cfg["port"] = args.controller_port
        try:
            controller = SerialTransport(
                {"serial": serial_cfg},
                output_mode=args.controller_output,
            )
            if args.controller_output == "serial":
                selected_port = controller.check_ready()
                print(f"[Controller] ESP serial ready on {selected_port}")
            else:
                print("[Controller] terminal output enabled")
        except Exception as exc:
            print(f"ERROR: controller unavailable: {exc}", file=sys.stderr)
            if controller is not None:
                controller.close()
            if dashboard is not None:
                dashboard.close()
            return 2

    target_fps = float(args.fps if args.fps is not None else cfg["runtime"]["target_fps"])
    interval = 1.0 / max(target_fps, 0.1)
    detecting = bool(args.auto_start) or (args.headless and not args.start_paused)
    # Demo Day explicitly requests this flag. It must take priority over the
    # diagnostic launcher's default --auto-start so the operator controls the
    # first detection.
    if args.start_paused:
        detecting = False

    m1 = M1Pipeline(cfg) if args.mode in {"full", "model1", "parallel-preview"} else None
    m2 = M2Pipeline(cfg) if args.mode in {"full", "model2", "parallel-preview"} else None
    if args.m1_conf is not None and m1 is not None:
        m1.infer_conf = float(args.m1_conf)
    gate = PetGate(cfg) if args.mode == "full" else None
    canonical = CanonicalWorkflow(cfg, m1, m2) if args.mode == "full" else None
    preview = None
    preview_runner = None
    preview_result_published = False
    if args.mode == "parallel-preview":
        runtime = cfg.get("runtime", {})
        gate_cfg = cfg.get("gate", {})
        preview = ParallelPreviewWorkflow(
            window_size=int(runtime.get("decision_window", 3)),
            quorum=int(runtime.get("decision_quorum", 3)),
            hold_s=float(
                args.result_hold_seconds
                if args.result_hold_seconds is not None
                else runtime.get("result_hold_s", gate_cfg.get("verdict_hold_s", 1.5))
            ),
            clear_frames=int(runtime.get("clear_frames", cfg.get("decision_contract", {}).get("clear_frames_to_rearm", 8))),
            m2_threshold=float(args.m2_conf if args.m2_conf is not None else cfg.get("m2", {}).get("violation_conf", 0.50)),
            m2_thresholds=(
                {}
                if args.m2_conf is not None
                else cfg.get("m2", {}).get("violation_conf_by_class", {})
            ),
        )
    if args.m2_conf is not None and gate is not None:
        gate.m2_violation_conf = float(args.m2_conf)
        gate.m2_violation_conf_by_class = {name: float(args.m2_conf) for name in ("cap", "label", "ring")}
    if args.m2_conf is not None and canonical is not None:
        canonical.m2_violation_conf = float(args.m2_conf)
        canonical.m2_violation_conf_by_class = {name: float(args.m2_conf) for name in ("cap", "label", "ring")}

    src = int(args.source) if args.source.isdigit() else args.source
    is_camera = isinstance(src, int)
    cam_idx = src if is_camera else 0

    # On Windows, MSMF can report a camera as opened but then block or return
    # no frames for secondary camera indices. DirectShow is the backend used by
    # the camera-switch path and is more reliable for the initial camera too.
    if is_camera:
        cap = cv2.VideoCapture(src, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap.release()
            cap = cv2.VideoCapture(src)
    else:
        cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"ERROR: cannot open source {src!r}")
        if controller is not None:
            controller.close()
        if dashboard is not None:
            dashboard.close()
        return 1

    def ensure_preview_workers():
        nonlocal preview_runner
        if args.mode == "parallel-preview" and preview_runner is None:
            preview_runner = ParallelInferenceRunner(m1, m2)

    def close_preview_workers():
        nonlocal preview_runner
        if preview_runner is not None:
            preview_runner.close()
            preview_runner = None

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
    manual_session = args.session_mode == "manual"
    session_snapshot: dict = {"items": [], "totalItems": 0, "totalPoints": 0, "status": "collecting"}
    qr_session_snapshot: dict = {"items": [], "totalItems": 0, "totalPoints": 0, "status": "unclaimed"}
    latest_qr: str | None = None
    qr_visible = False
    paused_result = None
    paused_result_expires_at = 0.0
    session_message = ""

    if manual_session and dashboard is not None:
        try:
            latest = dashboard.get_latest_session()
            if latest:
                latest_snapshot = latest.get("session") or latest
                latest_qr = latest_snapshot.get("qrPayload")
                if latest_qr:
                    qr_session_snapshot = latest_snapshot
                session_snapshot = (
                    latest_snapshot
                    if latest_snapshot.get("status") == "collecting"
                    else {"items": [], "totalItems": 0, "totalPoints": 0, "status": "collecting"}
                )
                print(
                    f"[Demo Day] Restored active session: {session_snapshot.get('totalItems', 0)} items / "
                    f"{session_snapshot.get('totalPoints', 0)} points"
                )
        except Exception as exc:
            print(f"ERROR: cannot restore latest Dashboard session: {exc}", file=sys.stderr)
            dashboard.close()
            return 2

    # Background camera-switch state
    cam_switch_result: dict | None = None  # set while a switch is in-flight
    switching = False  # True while the background thread is working

    def reset_all():
        nonlocal preview_result_published
        if preview is not None:
            preview.reset()
            preview_result_published = False
            ensure_preview_workers()
        if canonical is not None:
            canonical.reset()
        elif gate is not None:
            gate.reset()
        if m1 is not None:
            m1.reset_vote()

    def pause_for_clear():
        nonlocal preview_result_published
        if preview is not None:
            preview.pause()
            preview_result_published = False
            close_preview_workers()
        if canonical is not None:
            canonical.pause_for_clear()
        elif gate is not None:
            gate.reset()
        if m1 is not None:
            m1.reset_vote()

    def resume_detection():
        nonlocal preview_result_published
        if preview is not None:
            preview.reset()
            preview_result_published = False
            ensure_preview_workers()
            return
        if canonical is None or canonical.phase not in {"WAIT_CLEAR", "RESULT"}:
            reset_all()

    def finalize_session_for_qr(*, show_qr: bool) -> bool:
        """Finalize the paused manual session and retain its QR display data."""
        nonlocal latest_qr, qr_session_snapshot, session_snapshot
        nonlocal paused_result, paused_result_expires_at, session_message, qr_visible
        try:
            finalized = dashboard.finalize_session() if dashboard is not None else None
            if not finalized:
                raise RuntimeError("Dashboard returned an empty finalization response")
            finalized_session = finalized.get("session") or finalized
            qr_payload = finalized_session.get("qrPayload")
            if not qr_payload:
                raise RuntimeError("Dashboard finalized the session without a claim QR")
            latest_qr = str(qr_payload)
            qr_session_snapshot = finalized_session
            session_snapshot = {"items": [], "totalItems": 0, "totalPoints": 0, "status": "collecting"}
            paused_result = None
            paused_result_expires_at = 0.0
            qr_visible = show_qr
            session_message = "SESSION FINALIZED — Q toggles the claim QR; S / SPACE starts a new session"
            print("[Demo Day] Session finalized. Claim QR is ready.")
            return True
        except Exception as exc:
            session_message = f"FINALIZE FAILED: {exc}"
            print(f"ERROR: session finalization failed: {exc}", file=sys.stderr)
            return False

    if not args.headless:
        cv2.namedWindow(window, cv2.WINDOW_NORMAL)

        def on_mouse(event, x, y, _flags, _userdata):
            if event != cv2.EVENT_LBUTTONDOWN:
                return
            if (not qr_visible) and (not state["detecting"]) and hit_button(x, y, state["start_rect"]):
                state["detecting"] = True
                resume_detection()
            elif state["detecting"] and hit_button(x, y, state["pause_rect"]):
                state["detecting"] = False
                pause_for_clear()
            elif hit_button(x, y, state["cam_rect"]):
                state["switch_cam"] = True

        cv2.setMouseCallback(window, on_mouse)

    if args.headless:
        state["detecting"] = True
        reset_all()

    frame_count = 0
    window_sized = False
    runtime_error = None
    try:
        while True:
            t0 = time.perf_counter()
            emitted_step = None

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
                pause_for_clear()
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

            if manual_session and qr_visible:
                draw_qr_screen(frame, latest_qr, qr_session_snapshot)
            elif switching:
                # Show a non-blocking "switching" banner while thread works
                banner = "Switching camera..."
                (tw, th), _ = cv2.getTextSize(banner, cv2.FONT_HERSHEY_SIMPLEX, 0.85, 2)
                cx = frame.shape[1] // 2
                cv2.rectangle(frame, (cx - tw // 2 - 10, 8), (cx + tw // 2 + 10, 8 + th + 18), (0, 0, 0), -1)
                cv2.putText(frame, banner, (cx - tw // 2, 8 + th + 8), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (0, 200, 255), 2)
            elif not state["detecting"]:
                draw_paused_banner(frame)
                if paused_result is not None and _result_notification_visible(paused_result_expires_at, t0):
                    draw_preview_result(
                        frame,
                        paused_result.result,
                        _preview_controller_signal(paused_result.result),
                        status=(f"{args.controller_output.upper()} + DASHBOARD" if controller is not None else "PAUSED"),
                    )
                if manual_session:
                    cv2.putText(frame, session_message or "S / SPACE — NEXT   F — FINALIZE   Q — QR", (12, frame.shape[0] - 42), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 255), 2)
            else:
                if args.mode == "model1":
                    raw = m1.run(frame, det_conf=args.m1_conf)
                    if raw.poly is None:
                        legend.append(("no PET bottle / aluminum can in frame", (160, 160, 160)))
                    else:
                        draw_m1_poly(frame, raw.poly, raw.color)
                        legend.append((raw.legend, raw.color))
                elif args.mode == "model2":
                    full_poly = np.asarray(
                        [[0, 0], [frame.shape[1] - 1, 0], [frame.shape[1] - 1, frame.shape[0] - 1], [0, frame.shape[0] - 1]],
                        dtype=np.float32,
                    )
                    m2_hits = m2.run(frame, full_poly, infer_conf=args.m2_conf)
                    draw_m2_hits(frame, m2_hits)
                    legend.extend((f"{hit.name} {hit.confidence * 100:.0f}%", (255, 255, 255)) for hit in m2_hits)
                elif args.mode == "parallel-preview":
                    try:
                        ensure_preview_workers()
                        if preview.phase == "RESULT":
                            step = preview.hold_step(t0)
                        elif preview.phase == "WAIT_CLEAR":
                            clear_m1 = preview_runner.infer_m1(frame, m1_conf=args.m1_conf)
                            step = preview.update_clear(clear_m1, t0)
                        else:
                            evidence = preview_runner.infer(frame, m1_conf=args.m1_conf, m2_conf=args.m2_conf)
                            step = preview.update(evidence, t0)
                    except Exception as exc:
                        runtime_error = exc
                        print(f"ERROR: preview inference failed: {exc}", file=sys.stderr)
                        break
                    if step.phase == "READY":
                        preview_result_published = False
                    elif step.new_result and not preview_result_published:
                        emitted_step = step
                        preview_result_published = True
                    raw = step.m1
                    if raw is not None and getattr(raw, "poly", None) is not None:
                        draw_m1_poly(frame, raw.poly, raw.color)
                    if step.m2_hits:
                        draw_m2_hits(frame, step.m2_hits)
                    m1_label = str(getattr(raw, "label", "NONE")) if raw is not None else "NONE"
                    m1_confidence = float(getattr(raw, "confidence", 0.0)) if raw is not None else 0.0
                    m1_accepted = bool(getattr(raw, "accepted", False)) if raw is not None else False
                    if step.result and step.m1_average is not None:
                        m1_label = "ALUMINUM" if step.result == "ALUMINUM" else "PET"
                        m1_confidence = float(step.m1_average)
                        m1_accepted = True
                    draw_preview_confidence_panel(
                        frame,
                        preview_model_label,
                        m1_label,
                        m1_confidence,
                        m1_accepted,
                        step.m2_averages,
                        step.progress,
                        preview.window_size,
                        thresholds=preview.m2_thresholds,
                        status_text=(
                            f"REMOVE OBJECT — CLEAR {step.progress}/{preview.clear_frames}"
                            if step.phase == "WAIT_CLEAR"
                            else None
                        ),
                    )
                    if step.result:
                        display_signal = (
                            _preview_controller_signal(step.result)
                            if controller is not None
                            else step.preview_signal
                        )
                        if controller is not None and args.publish_dashboard:
                            result_status = f"{args.controller_output.upper()} + DASHBOARD"
                        elif controller is not None:
                            result_status = args.controller_output.upper()
                        elif args.publish_dashboard:
                            result_status = "DASHBOARD ONLY"
                        else:
                            result_status = "NOT SENT"
                        draw_preview_result(
                            frame,
                            step.result,
                            display_signal,
                            status=result_status,
                        )
                else:
                    step = canonical.update(frame, now=t0)
                    if step.signal is not None:
                        emitted_step = step
                    raw = step.m1_raw
                    if raw is not None and raw.poly is not None:
                        draw_m1_poly(frame, raw.poly, raw.color)
                        legend.append((raw.legend, raw.color))
                    else:
                        legend.append((step.detail or "no PET bottle / aluminum can in frame", (160, 160, 160)))
                    if step.m2_hits:
                        draw_m2_hits(frame, step.m2_hits)
                    if step.result:
                        verdict = step.result
                        vcolor = {
                            "ALUMINUM_CAN": (0, 220, 0),
                            "PET_CLEAN": (0, 200, 0),
                            "PET_REJECT": (0, 0, 255),
                        }.get(step.result, (160, 160, 160))
                    elif step.phase == "M2_WARMUP":
                        verdict, vcolor = "INSPECTING PET BOTTLE", (0, 200, 255)
                    elif step.phase in {"M1_VOTING", "M2_VOTING"}:
                        verdict, vcolor = step.detail, (0, 200, 255)

                if args.mode != "parallel-preview":
                    draw_verdict(frame, verdict, vcolor)
                    draw_legend(frame, legend)

            if manual_session and not qr_visible:
                draw_session_panel(frame, session_snapshot)

            elapsed = time.perf_counter() - t0
            actual = 1.0 / max(elapsed, 1e-6)
            if emitted_step is not None:
                dashboard_error = None
                try:
                    if controller is not None:
                        controller.send(emitted_step.result)
                except Exception as exc:
                    # A controller command is the machine boundary. It must
                    # remain fail-closed, especially in ESP mode.
                    runtime_error = exc
                    print(f"ERROR: controller output failed: {exc}", file=sys.stderr)
                    break

                try:
                    if dashboard is not None:
                        if args.mode == "parallel-preview":
                            if manual_session:
                                response = dashboard.send_and_wait(
                                    _preview_dashboard_result(emitted_step.result),
                                    confidence=_preview_event_confidence(emitted_step),
                                    fps=actual,
                                    latency_ms=elapsed * 1000.0,
                                    session_mode="manual",
                                )
                                session_snapshot = (response or {}).get("session") or session_snapshot
                            else:
                                dashboard.send(
                                    _preview_dashboard_result(emitted_step.result),
                                    confidence=_preview_event_confidence(emitted_step),
                                    fps=actual,
                                    latency_ms=elapsed * 1000.0,
                                )
                        else:
                            dashboard.send(
                                emitted_step.result,
                                confidence=_event_confidence(emitted_step, cfg),
                                fps=actual,
                                latency_ms=elapsed * 1000.0,
                            )
                except Exception as exc:
                    # Dashboard telemetry is useful, but it cannot cancel a
                    # terminal/ESP command that already reached the machine.
                    # Do not retry here: the server may have stored the event
                    # before its response timed out, so a retry could count
                    # the same item twice.
                    dashboard_error = exc
                    print(f"WARNING: Dashboard update timed out/failed after the result was sent: {exc}", file=sys.stderr)
                if args.pause_after_result:
                    paused_result = emitted_step
                    paused_result_expires_at = time.perf_counter() + RESULT_NOTIFICATION_SECONDS
                    state["detecting"] = False
                    pause_for_clear()
                    if dashboard_error is None:
                        session_message = "S / SPACE — NEXT   F — FINALIZE   Q — QR"
                        print("[Demo Day] Result delivered. Detection paused — press S / Space for the next object, or F to finalize.")
                    else:
                        session_message = "RESULT SENT — DASHBOARD STATUS UNKNOWN. S / SPACE — NEXT"
                        print("[Demo Day] Result sent. Dashboard status is unknown; detection paused — press S / Space for the next object.")
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
                if manual_session and key in (ord("q"), ord("Q")):
                    if latest_qr:
                        qr_visible = not qr_visible
                    elif state["detecting"]:
                        session_message = "PAUSE DETECTION BEFORE GENERATING THE CLAIM QR"
                    else:
                        # Q is the operator's QR action: it now finalizes a
                        # non-empty paused session and opens its claim QR in
                        # one step instead of silently doing nothing.
                        finalize_session_for_qr(show_qr=True)
                elif (manual_session and key in (ord("x"), ord("X"), 27)) or (not manual_session and key in (ord("q"), ord("Q"))):
                    break
                if key in (ord("m"), ord("M")) and args.controller_output == "serial":
                    # Emergency stop is deliberately limited to the strict ESP
                    # transport. It emits byte 0 and never creates telemetry.
                    try:
                        if controller is None:
                            raise RuntimeError("ESP controller is unavailable")
                        _send_emergency_stop(controller)
                        session_message = "EMERGENCY STOP SENT — signal 0"
                        print("[Demo Day] EMERGENCY STOP sent to ESP (signal 0).")
                    except Exception as exc:
                        session_message = f"EMERGENCY STOP FAILED: {exc}"
                        print(f"ERROR: emergency stop failed: {exc}", file=sys.stderr)
                    finally:
                        paused_result = None
                        paused_result_expires_at = 0.0
                        state["detecting"] = False
                        pause_for_clear()
                if key in (ord("s"), ord("S"), ord(" ")) and not qr_visible:
                    if not state["detecting"]:
                        paused_result = None
                        paused_result_expires_at = 0.0
                        latest_qr = None
                        qr_session_snapshot = {"items": [], "totalItems": 0, "totalPoints": 0, "status": "unclaimed"}
                        session_message = ""
                        state["detecting"] = True
                        resume_detection()
                if key in (ord("p"), ord("P")) and not qr_visible:
                    if state["detecting"]:
                        state["detecting"] = False
                        pause_for_clear()
                if manual_session and key in (ord("f"), ord("F")) and not state["detecting"] and not qr_visible:
                    finalize_session_for_qr(show_qr=False)
                if key in (ord("c"), ord("C")) and not qr_visible:
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
    finally:
        cap.release()
        close_preview_workers()
        if controller is not None:
            controller.close()
        if dashboard is not None:
            dashboard.close()
        if not args.headless:
            cv2.destroyAllWindows()
    return 2 if runtime_error is not None else 0


if __name__ == "__main__":
    raise SystemExit(main())
