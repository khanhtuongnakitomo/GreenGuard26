# Trash Detection Compact Overview

## Purpose

This directory contains the GreenGuard26 trash detection module. It is a Python machine learning pipeline for detecting and classifying recyclable beverage items from a camera feed, then deploying the trained model to edge hardware such as Raspberry Pi 5.

The model targets 3 classes:

| ID | Class |
|---:|---|
| 0 | `plastic_bottle` |
| 1 | `milk_carton` |
| 2 | `tin_can` |

## High-Level Pipeline

```text
Camera / Webcam
  -> collect raw images
  -> label bounding boxes in YOLO format
  -> validate dataset
  -> train YOLOv8
  -> export INT8 TFLite
  -> run inference on Raspberry Pi / webcam
  -> send classification decision to bin logic
```

## Directory Map

```text
Trash-detection/
├── configs/
│   └── data.yaml
├── docs/
│   ├── ML_Beverage_Classifier_Fullguide.md
│   ├── walkthrough.md
│   └── compact_overview.md
├── models/
│   ├── best.pt
│   └── best_int8.tflite
├── scripts/
│   ├── capture_dataset.py
│   └── check_dataset.py
├── src/
│   ├── train.py
│   ├── export.py
│   ├── inference_tflite.py
│   └── test_webcam.py
├── README.md
└── requirements.txt
```

## Important Files

| File | Role |
|---|---|
| `configs/data.yaml` | YOLO dataset config. Expects `dataset/images/train`, `dataset/images/val`, and `dataset/images/test`. |
| `src/train.py` | Trains a YOLOv8s model with augmentation, AdamW, early stopping, and outputs to `runs/train/beverage_classifier_v2`. |
| `src/export.py` | Exports `models/best.pt` to INT8 TFLite using image size 320. |
| `src/test_webcam.py` | Runs webcam testing on PC using the PyTorch `.pt` model. |
| `src/inference_tflite.py` | Runs TFLite inference, intended for Raspberry Pi deployment. |
| `scripts/capture_dataset.py` | Captures raw webcam images for a selected class. It does not create YOLO labels. |
| `scripts/check_dataset.py` | Validates dataset configuration and structure using Ultralytics helpers. |
| `models/best.pt` | Included trained PyTorch model artifact. |
| `models/best_int8.tflite` | Included INT8 TFLite model artifact for edge deployment. |

## Dataset Expectation

The dataset is not committed. It should be prepared separately in YOLO detection format:

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

Each label file uses normalized YOLO rows:

```text
class_id x_center y_center width height
```

The documented target split is roughly 70% train, 20% validation, and 10% test.

## Common Commands

Install dependencies:

```bash
pip install -r requirements.txt
```

Capture raw images:

```bash
python scripts/capture_dataset.py --class_name plastic_bottle --count 200
python scripts/capture_dataset.py --class_name milk_carton --count 200
python scripts/capture_dataset.py --class_name tin_can --count 200
```

Check dataset:

```bash
python scripts/check_dataset.py
```

Train model:

```bash
python src/train.py
```

Test `.pt` model with webcam:

```bash
python src/test_webcam.py
```

Export to TFLite INT8:

```bash
python src/export.py
```

Run TFLite inference:

```bash
python src/inference_tflite.py --model models/best_int8.tflite --conf 0.60
```

## Dependencies

`requirements.txt` lists:

```text
ultralytics
albumentations
roboflow
opencv-python
matplotlib
seaborn
wandb
```

On Raspberry Pi, `tflite-runtime` may need to be installed separately for `src/inference_tflite.py`.

## Notes And Caveats

- The repo includes trained model artifacts, but generated datasets and training runs are ignored by git.
- `capture_dataset.py` only captures raw images. Labeling still needs Roboflow, Label Studio, or another annotation tool.
- The README describes the current model as YOLOv8s, while the longer guide also recommends YOLOv8n as a faster starting point for edge devices.
- TFLite output shape can vary depending on Ultralytics export version, so `src/inference_tflite.py` post-processing may need verification against the exact exported model.
- Some scripts use path fallbacks, but running commands from the repository root is the clearest workflow.
