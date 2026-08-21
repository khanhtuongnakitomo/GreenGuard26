import argparse
import os
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
Path(os.environ.setdefault("YOLO_CONFIG_DIR", os.fspath(REPO_ROOT / ".ultralytics"))).mkdir(parents=True, exist_ok=True)
Path(os.environ.setdefault("MPLCONFIGDIR", os.fspath(REPO_ROOT / ".matplotlib"))).mkdir(parents=True, exist_ok=True)

import cv2
from ultralytics import YOLO

from telemetry import TelemetryLogger, normalize_bbox, now_ms
from session import RecyclingSession
from ui import draw_session_ui
from model2_bridge import default_model2_path, inspect_chosen_pet, load_component_pipeline
from point_rules import remap_detections
from rl_learner import ReinforcementLearner


def resolve_path(path):
    candidate = Path(path)
    if candidate.exists() or candidate.is_absolute():
        return candidate

    repo_candidate = REPO_ROOT / path
    if repo_candidate.exists():
        return repo_candidate

    return candidate


def class_name(names, class_id):
    if isinstance(names, dict):
        return names.get(class_id, str(class_id))
    if 0 <= class_id < len(names):
        return names[class_id]
    return str(class_id)


def detections_from_result(result):
    boxes = result.boxes
    if boxes is None or len(boxes) == 0:
        return []

    names = result.names
    xyxy = boxes.xyxy.cpu().tolist()
    confidences = boxes.conf.cpu().tolist()
    classes = boxes.cls.cpu().tolist()

    detections = []
    for bbox, confidence, class_id in zip(xyxy, confidences, classes):
        class_id = int(class_id)
        detections.append(
            {
                "class_name": class_name(names, class_id),
                "confidence": float(confidence),
                "bbox": normalize_bbox(bbox),
            }
        )
    return detections




def parse_args():
    parser = argparse.ArgumentParser(description="Run YOLO trash detection with webcam telemetry.")
    parser.add_argument("--model", default="models/best.pt", help="Path to YOLO .pt model")
    parser.add_argument("--camera", type=int, default=0, help="Webcam device index")
    parser.add_argument("--conf", type=float, default=0.65, help="Accepted detection confidence threshold")
    parser.add_argument(
        "--min-log-conf",
        type=float,
        default=0.05,
        help="Minimum confidence to keep in telemetry before applying the accepted threshold",
    )
    parser.add_argument("--telemetry", default="logs/telemetry.jsonl", help="Telemetry JSONL output path")
    parser.add_argument("--errors", default="logs/errors.jsonl", help="Error JSONL output path")
    parser.add_argument("--snapshot-dir", default="logs/snapshots", help="Snapshot output directory")
    parser.add_argument("--device-id", default="local-dev", help="Device identifier included in telemetry")
    parser.add_argument("--save-rejects", action="store_true", help="Save rejected frames to snapshot directory")
    parser.add_argument("--no-telemetry", action="store_true", help="Disable telemetry writes")
    parser.add_argument("--demo", action="store_true", default=True, help="Enable keyboard-driven demo mode")
    parser.add_argument(
        "--model2",
        default=str(default_model2_path()),
        help="Path to Model 2 cap/label/liquid weights (YOLO OBB .pt)",
    )
    parser.add_argument("--model2-conf", type=float, default=0.5, help="Cap/label/liquid confidence threshold")
    parser.add_argument("--model2-margin", type=float, default=0.15, help="Extra crop margin around the PET box")
    parser.add_argument("--no-model2", action="store_true", help="Disable PET cap/label inspection")
    parser.add_argument(
        "--debug-boxes",
        action="store_true",
        help="Draw Model 1/Model 2 boxes for debugging. Hidden in kiosk mode.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    model_path = resolve_path(args.model)

    telemetry = TelemetryLogger(
        telemetry_path=args.telemetry,
        error_path=args.errors,
        snapshot_dir=args.snapshot_dir,
        device_id=args.device_id,
        enabled=not args.no_telemetry,
    )

    if not model_path.exists():
        message = f"Model not found at {model_path}"
        print(f"Error: {message}")
        telemetry.error(source="webcam", model_path=os.fspath(model_path), model_type="yolo_pt", message=message)
        return

    print(f"Loading model from {model_path}...")
    model = YOLO(os.fspath(model_path))

    model2_pipeline = None
    if not args.no_model2:
        model2_path = resolve_path(args.model2)
        if not model2_path.exists():
            print(
                f"WARNING: Model 2 weights not found at {model2_path}. "
                "PET cap/label checks are disabled until you train Model2 "
                "(run Trash-detection/Model2/train.ps1)."
            )
        else:
            print(f"Loading Model 2 from {model2_path} (conf={args.model2_conf})...")
            model2_pipeline = load_component_pipeline(
                model2_path,
                conf_threshold=args.model2_conf,
                crop_margin=args.model2_margin,
            )

    print(f"Opening webcam index {args.camera}...")
    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        message = f"Could not open webcam index {args.camera}"
        print(f"Error: {message}")
        telemetry.error(source="webcam", model_path=os.fspath(model_path), model_type="yolo_pt", message=message)
        return

    session = RecyclingSession(countdown_time=5.0, qr_display_time=30.0, demo_mode=args.demo)
    learner = ReinforcementLearner()

    # Set up near-fullscreen window for 14" laptop (1920x1080)
    DISPLAY_W, DISPLAY_H = 1280, 720
    cv2.namedWindow("Trash Detection", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Trash Detection", DISPLAY_W, DISPLAY_H)

    print("Starting detection...")
    if args.demo:
        print("--- DEMO MODE ENABLED ---")
        print("Press 'Q' to quit")
        print("Press 'F' to toggle detection on/off")
        print("Press 'G' to generate QR / clear current QR")
    else:
        print("Press 'q' in the webcam window to quit.")
        
    frame_id = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                message = "Failed to read frame from webcam"
                print(message)
                telemetry.error(
                    source="webcam",
                    model_path=os.fspath(model_path),
                    model_type="yolo_pt",
                    message=message,
                    frame_id=frame_id,
                )
                break

            # Resize frame to fill the display window
            frame = cv2.resize(frame, (DISPLAY_W, DISPLAY_H))

            frame_id += 1
            start_ms = now_ms()
            results = model.predict(source=frame, conf=args.min_log_conf, verbose=False)
            inference_ms = now_ms() - start_ms
            fps = 1000.0 / inference_ms if inference_ms > 0 else 0.0

            detections = remap_detections(detections_from_result(results[0]))

            component_inspection = inspect_chosen_pet(
                model2_pipeline, frame, detections, args.conf
            )
            
            # Process frame through session state machine
            state = session.process_frame(detections, args.conf, component_inspection=component_inspection)
            learning_event = session.consume_learning_event()
            if learning_event:
                learner.maybe_record(learning_event, frame, component_inspection or session.last_component_inspection)
            learner.poll_reload(model2_pipeline)
            decision = "accepted" if state == "accepted" else "low_conf" # map for telemetry
            
            snapshot_path = None
            if args.save_rejects and state not in ("accepted", "qr_display", "loading"):
                snapshot_path = telemetry.save_snapshot(frame, frame_id, decision)

            telemetry.event(
                source="webcam",
                model_path=os.fspath(model_path),
                model_type="yolo_pt",
                frame_id=frame_id,
                detections=detections,
                conf_threshold=args.conf,
                inference_ms=inference_ms,
                fps=fps,
                snapshot_path=snapshot_path,
            )

            annotated_frame = draw_session_ui(
                frame, session, fps, debug_boxes=args.debug_boxes, rl_status=learner.status()
            )
            cv2.imshow("Trash Detection", annotated_frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q") or key == ord("Q"):
                break
            elif args.demo:
                if key == ord("f") or key == ord("F"):
                    session.toggle_detection()
                elif key == ord("g") or key == ord("G"):
                    if session.state == "qr_display":
                        session.reset()
                    else:
                        session.generate_qr()
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
