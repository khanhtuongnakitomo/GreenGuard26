import argparse
import os
from pathlib import Path

import cv2
import numpy as np

from telemetry import TelemetryLogger, normalize_bbox, now_ms
from session import RecyclingSession
from ui import draw_session_ui
from model2_bridge import default_model2_path, inspect_chosen_pet, load_component_pipeline
from point_rules import map_class_name
from rl_learner import ReinforcementLearner


REPO_ROOT = Path(__file__).resolve().parents[1]


def resolve_path(path):
    candidate = Path(path)
    if candidate.exists() or candidate.is_absolute():
        return candidate

    repo_candidate = REPO_ROOT / path
    if repo_candidate.exists():
        return repo_candidate

    return candidate


def get_interpreter_class():
    try:
        from tflite_runtime.interpreter import Interpreter

        return Interpreter
    except ModuleNotFoundError:
        try:
            from tensorflow.lite.python.interpreter import Interpreter

            return Interpreter
        except ModuleNotFoundError:
            raise ModuleNotFoundError(
                "Could not find TFLite interpreter. Install 'tflite-runtime' on Raspberry Pi "
                "or 'tensorflow' on PC."
            )


class BeverageClassifier:
    def __init__(self, model_path, min_conf_threshold=0.05):
        self.min_conf_threshold = min_conf_threshold
        self.labels = ["metal_can", "pet_bottle", "pp_cup"]

        print(f"Loading TFLite model from {model_path}...")
        Interpreter = get_interpreter_class()
        self.interpreter = Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()

        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        self.input_shape = self.input_details[0]["shape"]

    def preprocess(self, frame):
        is_nchw = self.input_shape[1] == 3
        if is_nchw:
            h, w = self.input_shape[2], self.input_shape[3]
        else:
            h, w = self.input_shape[1], self.input_shape[2]
            
        img = cv2.resize(frame, (w, h))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = img.astype(np.float32) / 255.0
        
        if is_nchw:
            img = np.transpose(img, (2, 0, 1))
            
        return np.expand_dims(img, axis=0)

    def predict(self, frame):
        """Returns detection dicts with raw TFLite bbox values."""
        img = self.preprocess(frame)

        self.interpreter.set_tensor(self.input_details[0]["index"], img)
        self.interpreter.invoke()

        # YOLOv8 TFLite standard output shape is [1, 4 + num_classes, num_anchors]
        output = self.interpreter.get_tensor(self.output_details[0]["index"])
        
        # Transpose to [num_anchors, 4 + num_classes]
        output = output[0].T
        
        boxes = output[:, :4]
        scores = output[:, 4:]
        
        class_ids = np.argmax(scores, axis=1)
        confidences = np.max(scores, axis=1)
        
        is_nchw = self.input_shape[1] == 3
        # img_h, img_w = (self.input_shape[2], self.input_shape[3]) if is_nchw else (self.input_shape[1], self.input_shape[2])

        detections = []
        for i in range(len(output)):
            confidence = float(confidences[i])
            if confidence < self.min_conf_threshold:
                continue
                
            class_id = int(class_ids[i])
            if 0 <= class_id < len(self.labels):
                # YOLOv8 TFLite outputs [cx, cy, w, h] already normalized to 0.0 - 1.0
                cx, cy, w, h = boxes[i]
                
                ymin = max(0.0, cy - h / 2)
                xmin = max(0.0, cx - w / 2)
                ymax = min(1.0, cy + h / 2)
                xmax = min(1.0, cx + w / 2)
                
                detections.append(
                    {
                        "class_name": map_class_name(self.labels[class_id]),
                        "confidence": confidence,
                        "bbox": [float(ymin), float(xmin), float(ymax), float(xmax)],
                    }
                )

        return self.nms(detections)

    def nms(self, detections, iou_threshold=0.45):
        if not detections:
            return []
        detections = sorted(detections, key=lambda x: x['confidence'], reverse=True)
        keep = []
        for det in detections:
            overlap = False
            for kept in keep:
                if self.compute_iou(det['bbox'], kept['bbox']) > iou_threshold:
                    overlap = True
                    break
            if not overlap:
                keep.append(det)
        return keep
        
    def compute_iou(self, boxA, boxB):
        yA = max(boxA[0], boxB[0])
        xA = max(boxA[1], boxB[1])
        yB = min(boxA[2], boxB[2])
        xB = min(boxA[3], boxB[3])

        interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
        if interArea == 0.0:
            return 0.0

        boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
        boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

        return interArea / float(boxAArea + boxBArea - interArea)

    def classify_single_object(self, frame, conf_threshold=0.60):
        detections = self.predict(frame)
        _, best = decide(detections, conf_threshold)
        if not best:
            return None, 0.0
        return best["class_name"], best["confidence"]


def parse_args():
    parser = argparse.ArgumentParser(description="Run TFLite trash detection with webcam telemetry.")
    parser.add_argument("--model", type=str, default="models/best_int8.tflite", help="Path to TFLite model")
    parser.add_argument("--camera", type=int, default=0, help="Webcam device index")
    parser.add_argument("--conf", type=float, default=0.60, help="Accepted detection confidence threshold")
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
    parser.add_argument(
        "--model2",
        default=str(default_model2_path()),
        help="Path to Model 2 cap/label weights (YOLO OBB .pt)",
    )
    parser.add_argument("--model2-conf", type=float, default=0.5, help="Cap/label confidence threshold")
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
        telemetry.error(source="webcam", model_path=os.fspath(model_path), model_type="tflite_int8", message=message)
        return

    classifier = BeverageClassifier(model_path=os.fspath(model_path), min_conf_threshold=args.min_log_conf)

    model2_pipeline = None
    if not args.no_model2:
        model2_path = resolve_path(args.model2)
        if not model2_path.exists():
            print(
                f"WARNING: Model 2 weights not found at {model2_path}. "
                "PET cap/label checks are disabled until you train Model2."
            )
        else:
            print(f"Loading Model 2 from {model2_path} (conf={args.model2_conf})...")
            model2_pipeline = load_component_pipeline(
                model2_path,
                conf_threshold=args.model2_conf,
                crop_margin=args.model2_margin,
            )

    cap = cv2.VideoCapture(args.camera)

    if not cap.isOpened():
        message = f"Could not open webcam index {args.camera}"
        print(f"Error: {message}")
        telemetry.error(source="webcam", model_path=os.fspath(model_path), model_type="tflite_int8", message=message)
        return

    session = RecyclingSession(countdown_time=5.0, qr_display_time=30.0)
    learner = ReinforcementLearner()

    print("Starting TFLite inference. Press 'q' in the webcam window to quit.")
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
                    model_type="tflite_int8",
                    message=message,
                    frame_id=frame_id,
                )
                break

            frame_id += 1
            start_ms = now_ms()
            detections = classifier.predict(frame)
            inference_ms = now_ms() - start_ms
            fps = 1000.0 / inference_ms if inference_ms > 0 else 0.0

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
                model_type="tflite_int8",
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
            cv2.imshow("TFLite Inference - press q to quit", annotated_frame)
            
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
