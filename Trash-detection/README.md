# GreenGuard26 — Trash Detection Module

Đây là module Machine Learning phát hiện và phân loại rác tái chế của dự án **GreenGuard26** — hệ thống thùng rác thông minh. Module huấn luyện YOLOv8s để nhận dạng 3 loại vật phẩm tái chế từ camera/webcam, sau đó xuất sang TFLite INT8 để triển khai trực tiếp trên Raspberry Pi 5.

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Cài đặt môi trường](#3-cài-đặt-môi-trường)
4. [Dataset](#4-dataset)
5. [Quy trình sử dụng](#5-quy-trình-sử-dụng)
6. [Chi tiết từng file](#6-chi-tiết-từng-file)
7. [Thông số huấn luyện](#7-thông-số-huấn-luyện)
8. [Model đã huấn luyện](#8-model-đã-huấn-luyện)
9. [Triển khai trên Raspberry Pi](#9-triển-khai-trên-raspberry-pi)
10. [Metrics & Đánh giá](#10-metrics--đánh-giá)
11. [Kiến trúc hệ thống tổng thể](#11-kiến-trúc-hệ-thống-tổng-thể)
12. [Lưu ý & Rủi ro](#12-lưu-ý--rủi-ro)

---

## 1. Tổng quan dự án

**Ba lớp phân loại:**
| Class ID | Tên lớp | Mô tả |
|---|---|---|
| 0 | `plastic_bottle` | Chai nhựa |
| 1 | `milk_carton` | Hộp sữa giấy |
| 2 | `tin_can` | Lon kim loại |

**Pipeline tổng quát:**
```
Webcam / Camera
  → Thu thập ảnh (capture_dataset.py)
  → Gán nhãn bounding box (Roboflow)
  → Kiểm tra dataset (check_dataset.py)
  → Huấn luyện YOLOv8s (train.py)
  → Export TFLite INT8 (export.py)
  → Inference trên Pi (inference_tflite.py)
  → Quyết định phân loại → Điều khiển cơ cấu
```

**Dataset nguồn:** Roboflow — `dang-thai/trash_classifier_combined` (dataset công cộng, kết hợp nhiều nguồn: TACO, TrashNet, Roboflow Universe).

---

## 2. Cấu trúc thư mục

```text
Trash-detection/
├── .gitignore
├── README.md                        ← File này
├── requirements.txt                 ← Danh sách thư viện Python
│
├── configs/
│   └── data.yaml                    ← Cấu hình dataset cho YOLOv8
│
├── models/                          ← Model đã huấn luyện sẵn
│   ├── best.pt                      ← Weights PyTorch (dùng để tiếp tục train hoặc export)
│   └── best_int8.tflite             ← Model TFLite INT8 (deploy lên Raspberry Pi)
│
├── scripts/                         ← Script hỗ trợ thu thập & kiểm tra dữ liệu
│   ├── capture_dataset.py           ← Thu thập ảnh từ webcam
│   └── check_dataset.py             ← Kiểm tra cấu trúc dataset trước khi train
│
├── src/                             ← Mã nguồn chính ML pipeline
│   ├── train.py                     ← Huấn luyện model YOLOv8s
│   ├── export.py                    ← Xuất model sang TFLite INT8
│   ├── inference_tflite.py          ← Inference TFLite qua webcam (dùng trên Raspberry Pi)
│   └── test_webcam.py               ← Test nhanh với model .pt qua webcam (dùng trên PC)
│
└── docs/
    ├── ML_Beverage_Classifier_Fullguide.md   ← Hướng dẫn toàn bộ dự án (chi tiết)
    └── walkthrough.md                        ← Tóm tắt nhanh các bước setup
```

**Thư mục được tạo khi chạy — không được commit lên git:**
```text
Trash-detection/
├── dataset/                         ← Dataset (bị ignore, cần chuẩn bị riêng)
│   ├── images/
│   │   ├── train/
│   │   ├── val/
│   │   └── test/
│   └── labels/
│       ├── train/
│       ├── val/
│       └── test/
└── runs/                            ← Kết quả training (bị ignore)
    └── train/
        └── beverage_classifier_v2/
            └── weights/
                ├── best.pt
                └── best_saved_model/
                    └── best_int8.tflite
```

---

## 3. Cài đặt môi trường

**Yêu cầu:** Python 3.9+ và pip.

```bash
# Clone repo và vào thư mục
cd "d:\UTS Everything\BKI\GreenGuard26\Trash-detection"

# Tạo virtual environment (khuyến nghị)
python -m venv .venv

# Kích hoạt (Windows)
.venv\Scripts\activate

# Kích hoạt (Linux/macOS)
source .venv/bin/activate

# Cài đặt thư viện
pip install -r requirements.txt
```

**Danh sách thư viện:**
| Thư viện | Mục đích |
|---|---|
| `ultralytics` | YOLOv8 — train, validate, export, dataset check |
| `roboflow` | Tải dataset từ Roboflow platform |
| `albumentations` | Augmentation nâng cao |
| `opencv-python` | Xử lý ảnh, đọc webcam, hiển thị |
| `matplotlib` | Vẽ đồ thị |
| `seaborn` | Visualize metrics, confusion matrix |
| `wandb` | Experiment tracking (tuỳ chọn) |

> **Lưu ý Raspberry Pi:** `inference_tflite.py` dùng `tflite_runtime` thay vì `tensorflow` đầy đủ. Cài riêng trên Pi bằng:
> ```bash
> pip install tflite-runtime
> ```

---

## 4. Dataset

### 4.1 Cấu hình (`configs/data.yaml`)

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

> ⚠️ Đường dẫn `dataset/` là tương đối so với thư mục gốc `Trash-detection/`. Khi chạy lệnh, **phải đứng tại thư mục gốc**.

### 4.2 Nguồn dataset

**Cách 1: Tải từ Roboflow (khuyến nghị)**

Dataset đã được dùng để huấn luyện:
- Project: `dang-thai/trash_classifier_combined`
- Version: 1
- Format: `yolov8`

Phần code download này có trong notebook `bki-train-3.ipynb` với API key riêng. Liên hệ nhóm để lấy dataset gốc hoặc tự collect lại.

**Cách 2: Thu thập bằng webcam**

```bash
# Đứng tại thư mục gốc Trash-detection/
python scripts/capture_dataset.py --class_name plastic_bottle --count 200
python scripts/capture_dataset.py --class_name milk_carton --count 200
python scripts/capture_dataset.py --class_name tin_can --count 200
```

Ảnh được lưu vào `dataset/raw/{class_name}/`. Sau đó cần **gán nhãn bounding box** trên Roboflow hoặc Label Studio rồi export sang format YOLOv8.

### 4.3 Định dạng YOLO label

```text
# Mỗi dòng trong file .txt tương ứng 1 object:
class_id x_center y_center width height

# Ví dụ (chai nhựa):
0 0.512 0.489 0.234 0.567
```

Tất cả giá trị tọa độ được chuẩn hóa trong khoảng `[0, 1]`.

### 4.4 Yêu cầu dataset

| Tiêu chí | Tối thiểu | Lý tưởng |
|---|---|---|
| Ảnh mỗi class | 800 | 2000+ |
| Tổng số ảnh | 2400 | 6000+ |
| Độ phân giải | 416×416 | 640×640+ |
| Tỷ lệ train/val/test | 70/20/10 | 70/20/10 |
| Imbalance tối đa | < 60% mỗi class | Cân bằng |

---

## 5. Quy trình sử dụng

### 5.1 Test nhanh với model có sẵn (PC + webcam)

Dùng file `best.pt` đã có trong `models/` để test ngay không cần train lại:

```bash
# Đứng tại thư mục gốc Trash-detection/
python src/test_webcam.py
```

Bấm `q` để thoát. Kết quả hiện bounding box và tên lớp trực tiếp lên webcam.

### 5.2 Kiểm tra dataset trước khi train

```bash
python scripts/check_dataset.py
```

### 5.3 Huấn luyện lại model

```bash
python src/train.py
```

Model được lưu tại: `runs/train/beverage_classifier_v2/weights/best.pt`

### 5.4 Export sang TFLite INT8

```bash
# Dùng model mặc định tại models/best.pt
python src/export.py

# Hoặc chỉ định model khác
python src/export.py --weights runs/train/beverage_classifier_v2/weights/best.pt
```

### 5.5 Inference TFLite qua webcam (Raspberry Pi)

```bash
# Dùng model mặc định tại models/best_int8.tflite
python src/inference_tflite.py

# Tuỳ chỉnh model và ngưỡng confidence
python src/inference_tflite.py --model models/best_int8.tflite --conf 0.65
```

---

## 6. Chi tiết từng file

### `src/train.py`
- Load pretrained `yolov8s.pt` (transfer learning từ COCO).
- Huấn luyện với dataset tại `configs/data.yaml`.
- Lưu kết quả vào `runs/train/beverage_classifier_v2/`.
- Tự động sinh confusion matrix, PR curve, training plots.

### `src/export.py`
- Nhận `--weights` (mặc định: `models/best.pt`).
- Export sang TFLite INT8 với `imgsz=320` để tối ưu tốc độ trên Pi.
- Cần `configs/data.yaml` để calibrate quantization.

### `src/inference_tflite.py`
- Class `BeverageClassifier`: wrapper tái sử dụng cho inference TFLite.
- `predict(frame)` → list `[(class_name, confidence, bbox)]`.
- `classify_single_object(frame)` → `(class_name, confidence)` với confidence cao nhất (phù hợp bin intake 1 vật/lần).
- `main()` mở webcam, vẽ kết quả lên frame, bấm `q` để thoát.

### `src/test_webcam.py`
- Script đơn giản, dùng `ultralytics YOLO` trực tiếp (không qua TFLite).
- Dùng `models/best.pt`, chạy tốt trên PC có GPU/CPU đủ mạnh.
- Không dùng cho Raspberry Pi (dùng `inference_tflite.py` thay thế).

### `scripts/capture_dataset.py`
- Thu thập ảnh từ webcam để xây dựng dataset.
- Phím `c`: chụp 1 ảnh, `a`: bật/tắt auto-capture (1 ảnh/giây), `q`: thoát.
- ⚠️ **Không** tự tạo YOLO label — cần gán nhãn riêng sau khi chụp.

### `scripts/check_dataset.py`
- Gọi `ultralytics.data.utils.check_det_dataset` để validate cấu trúc dataset.
- Tìm `configs/data.yaml` từ thư mục gốc hoặc `../configs/data.yaml` khi chạy từ `scripts/`.

### `configs/data.yaml`
- File cấu hình dataset cho YOLOv8 — định nghĩa đường dẫn và tên lớp.
- Class ID phải nhất quán giữa dataset, training, và inference.

### `models/`
- `best.pt` — Model PyTorch đã huấn luyện xong (dùng trên PC, hoặc để export).
- `best_int8.tflite` — Model TFLite INT8 (dùng deploy trên Raspberry Pi 5).

---

## 7. Thông số huấn luyện

Các hyperparameter dùng để huấn luyện `best.pt` trong `models/`:

```python
model = YOLO('yolov8s.pt')   # YOLOv8 Small — cân bằng tốc độ & chính xác

model.train(
    data='configs/data.yaml',
    epochs=150,              # Tối đa 150 epoch
    imgsz=640,               # Kích thước ảnh training
    batch=32,                # Batch size (dùng GPU Kaggle T4 x2)
    patience=30,             # Early stopping nếu 30 epoch không cải thiện
    workers=4,

    # Augmentation
    degrees=20.0,            # Xoay ±20°
    flipud=0.2,              # Lật dọc 20%
    fliplr=0.5,              # Lật ngang 50%
    mosaic=1.0,              # Ghép 4 ảnh
    mixup=0.15,              # Trộn ảnh
    hsv_h=0.02,
    hsv_s=0.7,
    hsv_v=0.4,
    perspective=0.001,

    # Optimizer
    optimizer='AdamW',
    lr0=0.001,
    lrf=0.01,
    weight_decay=0.0005,
    warmup_epochs=3.0,

    # Class imbalance
    cls=1.5,                 # Tăng trọng số loss phân loại

    project='runs/train',
    name='beverage_classifier_v2',
    save_period=10,
    plots=True,
)
```

**Tại sao dùng `yolov8s` thay vì `yolov8n`:**
- `yolov8s` (Small) có độ chính xác cao hơn `yolov8n` (Nano) trong khi vẫn đủ nhỏ để export TFLite.
- Với input size `320` khi export, tốc độ inference trên Pi 5 vẫn đạt yêu cầu thực tế.

---

## 8. Model đã huấn luyện

| File | Kích thước | Dùng cho |
|---|---|---|
| `models/best.pt` | ~21.5 MB | Test trên PC, export lại, fine-tune |
| `models/best_int8.tflite` | ~10.9 MB | Deploy thực tế trên Raspberry Pi 5 |

**Thông tin export TFLite:**
- Format: `tflite`
- Quantization: `INT8`
- Input size: `320×320`
- Calibration data: `configs/data.yaml`

> **Muốn export lại từ `best.pt`:**
> ```bash
> python src/export.py --weights models/best.pt
> ```

---

## 9. Triển khai trên Raspberry Pi

### Yêu cầu trên Pi 5
```bash
pip install ultralytics tflite-runtime opencv-python
```

### Chạy inference
```bash
# Copy toàn bộ repo hoặc chỉ cần:
# - src/inference_tflite.py
# - models/best_int8.tflite

python src/inference_tflite.py --model models/best_int8.tflite --conf 0.65
```

### Tối ưu tốc độ trên Pi
- Dùng TFLite INT8 (không phải `.pt`).
- Input size `320` thay vì `640` (đã làm trong export).
- Bỏ qua frame: chỉ inference mỗi 2-3 frame.
- Tách luồng capture và inference.
- Tắt verbose/log không cần thiết.

### Tích hợp vào hệ thống bin
```python
from src.inference_tflite import BeverageClassifier

classifier = BeverageClassifier(
    model_path='models/best_int8.tflite',
    conf_threshold=0.65
)

class_name, confidence = classifier.classify_single_object(frame)
if class_name:
    # Gửi lệnh đến ESP32/servo theo class_name
    send_to_actuator(class_name)
```

---

## 10. Metrics & Đánh giá

Ngưỡng chất lượng mục tiêu của dự án:

| Metric | Tối thiểu | Tốt | Xuất sắc |
|---|---|---|---|
| mAP50 | 0.80 | 0.88 | 0.93+ |
| Precision | 0.82 | 0.90 | 0.95+ |
| Recall | 0.78 | 0.86 | 0.92+ |
| Inference time (Pi 5) | < 200ms | < 100ms | < 60ms |

**Các artifact sinh ra sau training:**
- `confusion_matrix.png` — Ma trận nhầm lẫn.
- `PR_curve.png` — Precision-Recall curve.
- `results.png` — Loss và metric theo epoch.
- `weights/best.pt` — Model tốt nhất.
- `weights/last.pt` — Model epoch cuối.

---

## 11. Kiến trúc hệ thống tổng thể

```text
                   [Webcam / Camera]
                          │
                   [Raspberry Pi 5]
                    ┌─────┴──────┐
          [TFLite Inference]  [Validation logic]
          (inference_tflite)  (weight check, multi-frame voting)
                    └─────┬──────┘
                     [Quyết định]
                          │
              ┌───────────┼───────────┐
         [ESP32 Actuator]  [Backend API]  [LED/Buzzer]
         (servo sorting)   (log, reward)  (user feedback)
```

**Phân loại → Sorting:**
| Lớp | Ngăn |
|---|---|
| `plastic_bottle` | Ngăn A (nhựa) |
| `milk_carton` | Ngăn B (giấy) |
| `tin_can` | Ngăn C (kim loại) |

---

## 12. Lưu ý & Rủi ro

### ✅ Đã hoàn thành
- [x] Cấu trúc thư mục chuẩn.
- [x] Model đã train xong: `models/best.pt` và `models/best_int8.tflite`.
- [x] Test webcam hoạt động: `python src/test_webcam.py`.
- [x] Full ML pipeline: train → export → inference.

### ⚠️ Cần lưu ý
- **Dataset không commit lên git** (bị ignore) — cần chuẩn bị riêng.
- **`capture_dataset.py` không gán nhãn** — chỉ chụp ảnh thô, cần dùng Roboflow/Label Studio để annotate.
- **`inference_tflite.py` trên Pi** cần cài `tflite-runtime` riêng, không có trong `requirements.txt`.
- **YOLOv8 TFLite output shape** có thể thay đổi tùy phiên bản Ultralytics — nếu inference trả về kết quả lạ, kiểm tra `output.shape` và điều chỉnh post-processing.
- **Confidence threshold** nên được calibrate với dữ liệu thực tế tại hiện trường, không chỉ dùng giá trị mặc định.
- **Multi-frame voting** được khuyến nghị trước khi chấp nhận/từ chối vật phẩm (1 frame không đủ ổn định).
- **INT8 quantization** yêu cầu calibration data (đã truyền vào `data=configs/data.yaml` khi export).

### 🔮 Chưa triển khai (xem `docs/ML_Beverage_Classifier_Fullguide.md`)
- Backend API và database.
- Anti-cheat logic (load cell, IR sensor, rate limiting).
- Reward system.
- Telemetry và monitoring (Grafana/Prometheus).
- OTA model update.
- Hardware integration (ESP32, servo, LED, buzzer).
