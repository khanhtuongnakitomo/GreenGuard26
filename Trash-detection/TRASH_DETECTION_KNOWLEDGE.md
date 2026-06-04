# GreenGuard Trash Detection Knowledge Base

This document compacts the current `trash-detection` project into one reference: file structure, purpose of each file, model pipeline, commands, dependencies, data requirements, training/export/inference behavior, deployment knowledge, and system-level concepts used by the project.

## 1. Project Scope

`trash-detection` is the machine-learning detection module for GreenGuard's smart recycling bin. Its main job is to classify beverage waste into three recyclable object classes:

- `plastic_bottle`
- `milk_carton`
- `tin_can`

The implementation is based on YOLOv8 object detection, trained with transfer learning and exported to TensorFlow Lite INT8 for edge inference on devices such as Raspberry Pi 5.

High-level flow:

```text
Camera/Webcam
  -> image capture or live frame
  -> YOLOv8 training/inference pipeline
  -> class + confidence + bounding box
  -> decision logic for recycling-bin routing
  -> optional hardware/backend integration
```

## 2. Current File Structure

```text
trash-detection/
├── Documentation/
│   ├── ML_Beverage_Classifier_Fullguide.md
│   └── walkthrough.md
├── detection/
│   ├── data.yaml
│   ├── export.py
│   ├── inference_tflite.py
│   ├── requirements.txt
│   ├── train.py
│   └── scripts/
│       ├── capture_dataset.py
│       └── check_dataset.py
└── TRASH_DETECTION_KNOWLEDGE.md
```

Generated or expected paths that are referenced by scripts but are not currently part of the tracked source structure:

```text
trash-detection/detection/
├── dataset/
│   ├── images/
│   │   ├── train/
│   │   ├── val/
│   │   └── test/
│   └── labels/
│       ├── train/
│       ├── val/
│       └── test/
└── runs/
    └── train/
        └── recycling_v1/
            ├── weights/
            │   ├── best.pt
            │   └── best_saved_model/
            │       └── best_int8.tflite
            ├── confusion_matrix.png
            ├── PR_curve.png
            └── other YOLO training outputs
```

## 3. Existing Files and Responsibilities

### `Documentation/walkthrough.md`

Short setup summary describing the created detection pipeline. It lists the initial files, their intended purpose, and the basic workflow:

1. Install dependencies.
2. Collect data.
3. Train YOLOv8.
4. Export to TFLite.
5. Test inference.

### `Documentation/ML_Beverage_Classifier_Fullguide.md`

Long project guide covering the full smart recycling-bin concept:

- End-to-end AI architecture.
- Dataset collection and labeling.
- YOLOv8 training strategy.
- Edge optimization.
- Raspberry Pi / Jetson deployment.
- Hardware integration.
- Anti-cheat logic.
- Monitoring, telemetry, and retraining.
- Suggested tech stack and implementation timeline.

Note: the file appears to contain Vietnamese text that may render incorrectly in some terminals if the wrong encoding is used. It should be read as UTF-8.

### `detection/requirements.txt`

Python dependency list:

```text
ultralytics
albumentations
roboflow
opencv-python
matplotlib
seaborn
wandb
```

Dependency purpose:

- `ultralytics`: YOLOv8 model loading, training, validation, export, and dataset checks.
- `albumentations`: image augmentation library referenced by the project guide for stronger dataset variation.
- `roboflow`: dataset management, labeling/versioning workflow, and dataset download integration.
- `opencv-python`: webcam capture, image saving, display windows, and frame processing.
- `matplotlib`: training/analysis plotting dependency.
- `seaborn`: visualization dependency, useful for metrics/confusion-matrix analysis.
- `wandb`: optional experiment tracking.

Runtime note: `inference_tflite.py` imports `tflite_runtime.interpreter.Interpreter`, but `tflite_runtime` is not listed in `requirements.txt`. On Raspberry Pi it is commonly installed separately because package availability depends on Python and platform version.

### `detection/data.yaml`

YOLOv8 dataset configuration:

```yaml
path: dataset/
train: images/train
val: images/val
test: images/test

nc: 3
names:
  0: plastic_bottle
  1: milk_carton
  2: tin_can
```

Meaning:

- Dataset root is `trash-detection/detection/dataset/` when commands are run from `detection/`.
- Training images are expected at `dataset/images/train`.
- Validation images are expected at `dataset/images/val`.
- Test images are expected at `dataset/images/test`.
- Labels must follow YOLO text format under matching `dataset/labels/...` paths.
- There are exactly 3 configured classes.
- Class IDs must stay consistent across labels, training, and inference:
  - `0 = plastic_bottle`
  - `1 = milk_carton`
  - `2 = tin_can`

### `detection/train.py`

Training entry point using Ultralytics YOLOv8.

Core behavior:

- Imports `YOLO` from `ultralytics`.
- Loads pretrained `yolov8n.pt`.
- Trains with `data.yaml`.
- Saves training output under `runs/train/recycling_v1`.
- Prints the expected best-weights path when complete.

Important training settings:

```python
model = YOLO('yolov8n.pt')

model.train(
    data='data.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    patience=20,
    degrees=15.0,
    flipud=0.1,
    fliplr=0.5,
    mosaic=1.0,
    mixup=0.1,
    optimizer='AdamW',
    lr0=0.001,
    lrf=0.01,
    weight_decay=0.0005,
    project='runs/train',
    name='recycling_v1',
    save=True,
    save_period=10,
    plots=True,
)
```

Training knowledge used:

- `yolov8n.pt` is chosen because YOLOv8 nano is small and suitable for edge devices.
- Transfer learning is used instead of training from scratch.
- `imgsz=640` gives better detection detail during training.
- `batch=16` is a reasonable default for GPU training; reduce to `8` or `4` if memory is limited.
- `patience=20` enables early stopping if validation metrics stop improving.
- `mosaic=1.0` and `mixup=0.1` improve robustness by combining images and mixing samples.
- Rotation and flipping augment the dataset for camera-angle variation.
- `AdamW` with weight decay is used for stable optimization.
- `plots=True` generates model evaluation plots automatically.

Expected command:

```bash
cd trash-detection/detection
python train.py
```

Expected output:

```text
runs/train/recycling_v1/weights/best.pt
```

### `detection/export.py`

Model export entry point for deployment.

Core behavior:

- Reads a trained `.pt` model path from `--weights`.
- Defaults to `runs/train/recycling_v1/weights/best.pt`.
- Verifies the weights file exists.
- Loads the trained YOLO model.
- Exports to TensorFlow Lite using INT8 quantization and `imgsz=320`.

Key code behavior:

```python
model = YOLO(args.weights)
model.export(format='tflite', int8=True, imgsz=320)
```

Why this matters:

- `.pt` is good for training and desktop/GPU inference.
- TFLite is better for Raspberry Pi style edge deployment.
- INT8 quantization reduces model size and improves speed.
- `imgsz=320` trades some accuracy for faster inference.

Expected commands:

```bash
cd trash-detection/detection
python export.py
```

Or with a custom weights path:

```bash
python export.py --weights runs/train/recycling_v1/weights/best.pt
```

Expected model path, based on the inference script default:

```text
runs/train/recycling_v1/weights/best_saved_model/best_int8.tflite
```

### `detection/inference_tflite.py`

TFLite webcam inference script and reusable classifier wrapper.

Main class:

```python
class BeverageClassifier:
```

Constructor behavior:

- Accepts `model_path`.
- Accepts `conf_threshold`, default `0.5`.
- Defines labels matching `data.yaml`.
- Loads TFLite model with `tflite_runtime.Interpreter`.
- Allocates tensors.
- Reads input/output tensor details.
- Stores the model input shape.

Configured label order:

```python
self.labels = ['plastic_bottle', 'milk_carton', 'tin_can']
```

Preprocessing:

- Resizes the camera frame to the model input width and height.
- Converts OpenCV BGR frame to RGB.
- Adds batch dimension.
- Casts image to `uint8`, matching INT8/quantized TFLite expectations.

Prediction:

- Sends the preprocessed image into the interpreter.
- Invokes the TFLite model.
- Reads the first output tensor.
- Assumes YOLOv8 TFLite output entries shaped like:

```text
[x, y, w, h, confidence, class_id]
```

- Filters detections below the confidence threshold.
- Converts `class_id` to class name.
- Returns:

```python
[(class_name, confidence, bbox), ...]
```

Single-object classification:

- Calls `predict(frame)`.
- Returns `(None, 0.0)` if no object passes the threshold.
- Otherwise returns the detection with the highest confidence.

Webcam test behavior in `main()`:

- Default model:

```text
runs/train/recycling_v1/weights/best_saved_model/best_int8.tflite
```

- Default confidence threshold:

```text
0.60
```

- Opens webcam index `0`.
- Runs live inference.
- Draws the best class and confidence on the frame.
- Shows an OpenCV window titled `TFLite Inference`.
- Press `q` to quit.

Expected command:

```bash
cd trash-detection/detection
python inference_tflite.py --model runs/train/recycling_v1/weights/best_saved_model/best_int8.tflite --conf 0.60
```

Important implementation caveat:

YOLOv8 TFLite output format can vary depending on export settings and Ultralytics version. The script assumes `[1, num_detections, 6]` with `[x,y,w,h,conf,class]`. If inference returns strange values, inspect `output.shape` and adapt the post-processing.

### `detection/scripts/capture_dataset.py`

Webcam image collection utility.

Arguments:

```text
--class_name   required; one of plastic_bottle, milk_carton, tin_can
--count        optional; default 200
--output       optional; default dataset/raw
```

Behavior:

- Creates an output directory:

```text
{output}/{class_name}/
```

- Opens webcam index `0`.
- Displays the live camera feed.
- Overlays selected class, captured count, and auto-mode state.
- Supports keyboard controls:
  - `c`: capture one image.
  - `a`: toggle auto-capture.
  - `q`: quit.
- Auto-capture saves one image per second.
- File names use class name and millisecond timestamp:

```text
plastic_bottle_1710000000000.jpg
```

Expected examples:

```bash
cd trash-detection/detection
python scripts/capture_dataset.py --class_name plastic_bottle --count 200
python scripts/capture_dataset.py --class_name milk_carton --count 200
python scripts/capture_dataset.py --class_name tin_can --count 200
```

Important limitation:

This script captures raw images only. It does not create YOLO bounding-box labels. Images still need to be labeled in Roboflow, Label Studio, CVAT, or another annotation tool before training.

### `detection/scripts/check_dataset.py`

Dataset validation helper.

Behavior:

- Uses `ultralytics.data.utils.check_det_dataset`.
- Looks for `../data.yaml` first.
- If not found, falls back to `data.yaml`.
- Prints dataset-check results or an error.
- Reminds the user to manually verify:
  - Train/validation/test ratio.
  - Class balance.
  - Image-label pairing.
  - Minimum image resolution.

Expected commands:

From `trash-detection/detection/scripts`:

```bash
python check_dataset.py
```

From `trash-detection/detection`:

```bash
python scripts/check_dataset.py
```

## 4. Dataset Format and Requirements

Expected YOLO dataset layout:

```text
dataset/
├── images/
│   ├── train/
│   ├── val/
│   └── test/
└── labels/
    ├── train/
    ├── val/
    └── test/
```

For every image:

```text
dataset/images/train/example.jpg
```

there should be a matching label file:

```text
dataset/labels/train/example.txt
```

YOLO label format:

```text
class_id x_center y_center width height
```

All coordinate values must be normalized between `0` and `1`.

Example:

```text
0 0.512 0.489 0.234 0.567
```

Meaning:

- Class `0`: `plastic_bottle`.
- Bounding-box center x is 51.2% across the image.
- Bounding-box center y is 48.9% down the image.
- Box width is 23.4% of image width.
- Box height is 56.7% of image height.

Recommended split:

```text
70% train
20% validation
10% test
```

Recommended minimum image count from the guide:

```text
plastic_bottle: at least 800, ideal 2000+
milk_carton:    at least 800, ideal 2000+
tin_can:        at least 800, ideal 2000+
total:          at least 2400, ideal 6000+
```

Recommended image quality:

- Minimum resolution around `416x416`.
- Include realistic camera angles.
- Include good and bad lighting.
- Include clean, dirty, crushed, label-damaged, and partially deformed objects.
- Include backgrounds similar to the actual bin intake area.
- Avoid overfitting on clean lab images only.

Class-balance rule from the helper script:

- No class should dominate more than about `60%` of total data.

## 5. Data Collection Knowledge

The project supports local webcam capture through `capture_dataset.py`, but proper ML data preparation requires more than saving images.

Recommended collection variations:

- Physical condition:
  - intact bottles/cans/cartons
  - lightly crushed items
  - heavily crushed items
  - with labels
  - without labels or damaged labels
  - empty and partially filled containers
- Camera angle:
  - top-down
  - 45-degree angle
  - left/right tilted
  - side view
- Lighting:
  - daylight
  - weak light
  - fluorescent indoor light
  - shadows
- Background:
  - plain background
  - actual machine intake background
  - cluttered background

Public dataset sources mentioned in the guide:

- TACO Dataset
- TrashNet
- OpenImages V7
- Roboflow Universe

Labeling tools mentioned:

- Roboflow: hosted annotation, auto-labeling, YOLOv8 export, dataset versioning.
- Label Studio: self-hosted alternative.

Important workflow:

```text
Capture raw images
  -> annotate bounding boxes
  -> export YOLOv8 dataset
  -> place under detection/dataset/
  -> validate with check_dataset.py
  -> train with train.py
```

## 6. Data Augmentation Knowledge

Augmentations implemented directly in `train.py`:

- `degrees=15.0`: random rotation.
- `flipud=0.1`: occasional vertical flip.
- `fliplr=0.5`: common horizontal flip.
- `mosaic=1.0`: combines four images into one training sample.
- `mixup=0.1`: mixes images for regularization.

Augmentations recommended by the guide through Albumentations:

- Horizontal and vertical flip.
- Random brightness/contrast.
- Gaussian noise.
- Motion blur.
- Hue/saturation/value shifts.
- Random shadows.
- Rotation.
- Perspective transform.
- CLAHE contrast enhancement.

Purpose:

- Simulate real lighting changes.
- Simulate camera shake.
- Handle deformed and differently oriented waste.
- Improve robustness in non-lab deployment conditions.

## 7. Training Pipeline

Training model:

```text
YOLOv8n
```

Reason:

- Smallest YOLOv8 family member.
- Faster inference.
- Suitable starting point for Raspberry Pi 5.
- Easier to export and deploy than larger models.

Alternative models discussed in the guide:

```text
YOLOv8s
MobileNetV3 + SSD
EfficientDet-Lite
```

Project recommendation:

```text
Start with YOLOv8n.
Move to larger models only if YOLOv8n accuracy is insufficient and hardware budget allows it.
```

Core command:

```bash
cd trash-detection/detection
pip install -r requirements.txt
python scripts/check_dataset.py
python train.py
```

Training output:

```text
runs/train/recycling_v1/
```

Most important artifact:

```text
runs/train/recycling_v1/weights/best.pt
```

Useful generated artifacts:

- Confusion matrix.
- Precision-recall curve.
- Training/validation losses.
- Metrics plots.
- Periodic checkpoints every 10 epochs.

Metrics knowledge:

- Precision: Of predictions made for a class, how many were correct.
- Recall: Of real objects in a class, how many the model found.
- mAP50: mean average precision at IoU 0.5.
- mAP50-95: stricter average over multiple IoU thresholds.

Guide thresholds:

```text
mAP50:
  minimum: 0.80
  good:    0.88
  strong:  0.93+

Precision:
  minimum: 0.82
  good:    0.90
  strong:  0.95+

Recall:
  minimum: 0.78
  good:    0.86
  strong:  0.92+

Edge inference target:
  minimum: <200 ms
  good:    <100 ms
  strong:  <60 ms
```

## 8. Export and Optimization Pipeline

Current export target:

```text
TensorFlow Lite INT8
```

Current export command:

```bash
cd trash-detection/detection
python export.py
```

Export settings:

```text
format = tflite
int8 = True
imgsz = 320
```

Why `imgsz=320` during export:

- Smaller input resolution improves speed on edge devices.
- Some accuracy may be lost compared with `640`.
- This is a practical tradeoff for Raspberry Pi inference.

Why INT8:

- Smaller model file.
- Lower memory use.
- Faster inference.
- Usually small accuracy drop if quantization works well.

Other formats mentioned in the guide:

- ONNX: flexible runtime format.
- TensorRT engine: best for Jetson devices.
- TFLite FP32: easier conversion, less speedup than INT8.

## 9. Inference Pipeline

Current inference target:

```text
TFLite Runtime + OpenCV webcam
```

Main class:

```text
BeverageClassifier
```

Input:

- OpenCV frame from webcam.

Preprocessing:

```text
BGR frame
  -> resize to model input shape
  -> convert BGR to RGB
  -> add batch dimension
  -> cast to uint8
```

Output:

```text
class_name, confidence, bounding_box
```

Decision helper:

```python
classify_single_object(frame)
```

This returns only the highest-confidence detection, which matches a recycling-bin intake scenario where one item is expected at a time.

Default confidence threshold:

```text
0.60 in CLI main
0.50 in class constructor default
```

Guide recommendation:

```text
0.65 is a practical starting point for real deployment.
```

Threshold tradeoff:

- Too low: more false accepts.
- Too high: more valid items rejected.
- Final value should be tuned with real pilot data.

## 10. Edge Deployment Knowledge

Main deployment target:

```text
Raspberry Pi 5
```

Alternative:

```text
Jetson Orin Nano / Jetson-class device
```

Expected edge optimizations:

- Use TFLite INT8.
- Reduce input size from `640` to `320`.
- Process every Nth frame instead of every frame.
- Run camera capture and inference in separate threads.
- Keep local fallback behavior if the network is unavailable.

Guide's rough model-format comparison:

```text
.pt PyTorch:      easiest after training, slowest on Pi
.onnx:           portable and faster than PyTorch
.tflite FP32:    good Pi compatibility
.tflite INT8:    preferred Pi deployment format
TensorRT engine: preferred Jetson deployment format
```

## 11. Hardware/System Concepts Used by the Guide

The current repository only implements the ML/data scripts. The full guide also describes a smart-bin system around it.

Suggested hardware:

- Raspberry Pi 5: main edge computer.
- Camera module or webcam: image input.
- ESP32 or microcontroller: actuator control.
- Load cell + HX711: weight verification.
- IR sensor: object presence and safety detection.
- Ultrasonic sensor: storage fill-level detection.
- Servo motor: sorting door/flap.
- Stepper motor + driver: possible conveyor.
- LED strip: user feedback.
- Buzzer: user feedback.
- Thermal printer: reward ticket printing.
- Wi-Fi or GSM: network connectivity.

System architecture:

```text
Camera Module
  -> Raspberry Pi 5
      -> TFLite object classifier
      -> local decision logic
      -> ESP32 motor command
      -> backend telemetry/logging
```

Suggested sorting map:

```text
plastic_bottle -> compartment A
milk_carton    -> compartment B
tin_can        -> compartment C
```

## 12. Anti-Cheat and Validation Concepts

The guide emphasizes that camera classification alone is not enough for real-world deployment.

Validation layers:

- AI class confidence.
- Multi-frame voting.
- Weight range validation.
- IR/object-presence validation.
- Barcode or QR scan, if available.
- Rate limiting for rewards.
- Local session anomaly detection.

Examples:

- Reject if no object is detected.
- Reject if average confidence is too low.
- Reject if object is too light for the predicted class.
- Reject if object is too heavy for the predicted class.
- Log suspicious sessions for review.
- Save failed/rejected frames for future retraining.

Example class weight ranges from the guide concept:

```text
plastic_bottle: approximate min/max grams
milk_carton:    approximate min/max grams
tin_can:        approximate min/max grams
```

The actual numeric limits should be calibrated with real local items.

## 13. Backend, Monitoring, and Operations Concepts

The repository does not currently include backend code, but the guide proposes:

- API server:
  - Node.js + Express/NestJS
  - or Python FastAPI
- MQTT broker:
  - Mosquitto for IoT messaging
- Database:
  - PostgreSQL for submissions/rewards
  - TimescaleDB for telemetry
  - Redis for cache/rate limiting
- Dashboard:
  - React + Vite
  - charting with Recharts or Chart.js
  - real-time updates through WebSocket/Socket.io
- Monitoring:
  - Grafana + Prometheus
  - machine telemetry
  - health status
  - model version
  - fill level
  - camera status
  - CPU/RAM/storage status

Operational behaviors described:

- Store submissions locally if network is down.
- Sync later when network returns.
- Save failed detections for dataset improvement.
- Retrain periodically based on real-world failures.
- Support OTA model updates with version and checksum validation.

## 14. Practical End-to-End Workflow

### First setup

```bash
cd trash-detection/detection
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

On Linux/macOS:

```bash
source .venv/bin/activate
```

### Capture raw images

```bash
python scripts/capture_dataset.py --class_name plastic_bottle --count 200
python scripts/capture_dataset.py --class_name milk_carton --count 200
python scripts/capture_dataset.py --class_name tin_can --count 200
```

### Label and export

```text
Upload/copy raw images to a labeling tool
  -> draw bounding boxes
  -> export as YOLOv8 dataset
  -> place images and labels under detection/dataset/
```

### Validate dataset

```bash
python scripts/check_dataset.py
```

### Train

```bash
python train.py
```

### Export

```bash
python export.py
```

### Run webcam inference

```bash
python inference_tflite.py --model runs/train/recycling_v1/weights/best_saved_model/best_int8.tflite --conf 0.60
```

## 15. Current Gaps and Risks

Important gaps in the current `trash-detection` folder:

- No dataset is included.
- No trained `.pt` weights are included.
- No exported `.tflite` model is included.
- `tflite_runtime` is imported but not listed in `requirements.txt`.
- `capture_dataset.py` captures images but does not label them.
- `inference_tflite.py` assumes a specific YOLOv8 TFLite output shape that may need adjustment after real export.
- Hardware integration, backend logging, telemetry, rewards, and anti-cheat are described in documentation but not implemented in this folder.

Risks to watch:

- Training on clean images only will fail in real-world conditions.
- Class imbalance will bias predictions.
- High validation accuracy may not transfer to the actual bin camera angle.
- INT8 export may require representative calibration data depending on Ultralytics behavior and version.
- Raspberry Pi package installation for TFLite can vary by Python version and OS.
- One-frame inference can be unstable; multi-frame voting is recommended before accepting/rejecting objects.

## 16. Key Knowledge Summary

The folder uses:

- Computer vision with OpenCV.
- Object detection with YOLOv8.
- Transfer learning from pretrained COCO weights.
- YOLO-format datasets.
- Bounding-box annotation.
- Data augmentation.
- Training metrics such as precision, recall, mAP50, and mAP50-95.
- Model export and quantization.
- TensorFlow Lite edge inference.
- Webcam-based live testing.
- Edge AI deployment ideas for Raspberry Pi.
- Hardware validation concepts using load cells, IR sensors, motors, LEDs, buzzers, and printers.
- Operational concepts such as telemetry, backend logging, model retraining, and OTA updates.

The implemented source code currently covers the ML pipeline from dataset capture support through training, export, and local TFLite webcam inference. The surrounding smart-bin hardware/backend system remains documented as design knowledge rather than completed code in this folder.
