import argparse
import os
from pathlib import Path

import cv2
import numpy as np

from telemetry import TelemetryLogger, decide, normalize_bbox, now_ms


REPO_ROOT = Path(__file__).resolve().parents[1]


def resolve_path(path):
    candidate = Path(path)
    if candidate.exists():
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
        self.labels = ["plastic_bottle", "milk_carton", "tin_can"]

        print(f"Loading TFLite model from {model_path}...")
        Interpreter = get_interpreter_class()
        self.interpreter = Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()

        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        self.input_shape = self.input_details[0]["shape"]

    def preprocess(self, frame):
        h, w = self.input_shape[1], self.input_shape[2]
        img = cv2.resize(frame, (w, h))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return np.expand_dims(img, axis=0).astype(np.uint8)

    def predict(self, frame):
        """Returns detection dicts with raw TFLite bbox values."""
        img = self.preprocess(frame)

        self.interpreter.set_tensor(self.input_details[0]["index"], img)
        self.interpreter.invoke()

        # YOLOv8 TFLite output shape can vary by export version. This parser
        # supports the common [1, num_detections, 6] layout documented here.
        output = self.interpreter.get_tensor(self.output_details[0]["index"])

        detections = []
        for det in output[0]:
            if len(det) < 6:
                continue

            confidence = float(det[4])
            if confidence < self.min_conf_threshold:
                continue

            class_id = int(det[5])
            if 0 <= class_id < len(self.labels):
                detections.append(
                    {
                        "class_name": self.labels[class_id],
                        "confidence": confidence,
                        "bbox": normalize_bbox(det[:4]),
                    }
                )

        return detections

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
    cap = cv2.VideoCapture(args.camera)

    if not cap.isOpened():
        message = f"Could not open webcam index {args.camera}"
        print(f"Error: {message}")
        telemetry.error(source="webcam", model_path=os.fspath(model_path), model_type="tflite_int8", message=message)
        return

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
            decision, best = decide(detections, args.conf)

            snapshot_path = None
            if args.save_rejects and decision != "accepted":
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

            if best and best["confidence"] >= args.conf:
                cv2.putText(
                    frame,
                    f"[{best['class_name']}] {best['confidence']:.1%}",
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1,
                    (0, 255, 0),
                    2,
                )

            cv2.imshow("TFLite Inference - press q to quit", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
