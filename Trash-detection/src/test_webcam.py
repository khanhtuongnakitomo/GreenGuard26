import argparse
import os
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
Path(os.environ.setdefault("YOLO_CONFIG_DIR", os.fspath(REPO_ROOT / ".ultralytics"))).mkdir(parents=True, exist_ok=True)
Path(os.environ.setdefault("MPLCONFIGDIR", os.fspath(REPO_ROOT / ".matplotlib"))).mkdir(parents=True, exist_ok=True)

import cv2
from ultralytics import YOLO

from telemetry import TelemetryLogger, decide, normalize_bbox, now_ms


def resolve_path(path):
    candidate = Path(path)
    if candidate.exists():
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


def draw_accepted(frame, detections, conf_threshold):
    annotated = frame.copy()
    for detection in detections:
        if detection["confidence"] < conf_threshold:
            continue

        x1, y1, x2, y2 = [int(value) for value in detection["bbox"]]
        label = f"{detection['class_name']} {detection['confidence']:.1%}"
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 180, 0), 2)
        cv2.putText(
            annotated,
            label,
            (x1, max(24, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 180, 0),
            2,
        )
    return annotated


def draw_hud_panel(frame, decision, best_detection, fps, inference_ms):
    annotated = frame.copy()
    h, w = annotated.shape[:2]

    # Panel dimensions
    panel_w, panel_h = 280, 100
    margin = 20
    x1 = w - panel_w - margin
    y1 = h - panel_h - margin
    x2 = w - margin
    y2 = h - margin

    # Draw semi-transparent background
    overlay = annotated.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), (25, 25, 25), -1)
    cv2.addWeighted(overlay, 0.85, annotated, 0.15, 0, annotated)
    
    # Border
    cv2.rectangle(annotated, (x1, y1), (x2, y2), (100, 100, 100), 1)

    # State colors and text
    if decision == "accepted":
        dot_color = (0, 220, 0)  # Green
        status_text = "DETECTED"
    elif decision == "low_conf":
        dot_color = (0, 200, 255)  # Yellow
        status_text = "LOW CONFIDENCE"
    else:
        dot_color = (150, 150, 150)  # Gray
        status_text = "SCANNING..."

    # Top row: Status indicator and FPS
    # Dot
    cv2.circle(annotated, (x1 + 25, y1 + 25), 6, dot_color, -1)
    # Status text
    cv2.putText(annotated, status_text, (x1 + 40, y1 + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1)
    # FPS
    fps_text = f"{int(fps)} FPS"
    cv2.putText(annotated, fps_text, (x2 - 60, y1 + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)

    # Middle row: Waste type
    waste_type = best_detection["class_name"].title().replace("_", " ") if best_detection else "---"
    cv2.putText(annotated, waste_type, (x1 + 25, y1 + 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    # Bottom row: Confidence bar
    bar_w = 170
    bar_h = 10
    bar_x = x1 + 25
    bar_y = y1 + 75
    
    # Background bar
    cv2.rectangle(annotated, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (50, 50, 50), -1)
    
    conf = best_detection["confidence"] if best_detection else 0.0
    if conf > 0:
        # Foreground bar
        fill_w = int(bar_w * conf)
        cv2.rectangle(annotated, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), dot_color, -1)
        
    # Confidence text
    conf_text = f"{conf:.1%}" if conf > 0 else "---"
    cv2.putText(annotated, conf_text, (bar_x + bar_w + 10, bar_y + 9), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)

    return annotated


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

    print(f"Opening webcam index {args.camera}...")
    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        message = f"Could not open webcam index {args.camera}"
        print(f"Error: {message}")
        telemetry.error(source="webcam", model_path=os.fspath(model_path), model_type="yolo_pt", message=message)
        return

    print("Starting detection. Press 'q' in the webcam window to quit.")
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

            frame_id += 1
            start_ms = now_ms()
            results = model.predict(source=frame, conf=args.min_log_conf, verbose=False)
            inference_ms = now_ms() - start_ms
            fps = 1000.0 / inference_ms if inference_ms > 0 else 0.0

            detections = detections_from_result(results[0])
            decision, best = decide(detections, args.conf)
            snapshot_path = None
            if args.save_rejects and decision != "accepted":
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

            annotated_frame = draw_accepted(frame, detections, args.conf)
            annotated_frame = draw_hud_panel(annotated_frame, decision, best, fps, inference_ms)
            cv2.imshow("Trash Detection - press q to quit", annotated_frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
