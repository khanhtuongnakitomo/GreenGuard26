# ML Model: Phân Loại Vỏ Đồ Uống Thông Minh
### Smart Recycling Bin — Hướng dẫn xây dựng mô hình từ A đến Z
> **Mục tiêu:** Phân biệt 3 loại: Chai nhựa PET · Hộp sữa giấy (Milk Carton) · Lon thiếc (Tin Can)  
> **Môi trường triển khai:** Edge AI trên Raspberry Pi 5 / Jetson Nano Orin  
> **Ngôn ngữ chính:** Python

---

## MỤC LỤC

1. [Tổng quan kiến trúc hệ thống](#1-tổng-quan-kiến-trúc)
2. [Phase 1 — Thu thập & chuẩn bị dữ liệu](#2-phase-1--thu-thập--chuẩn-bị-dữ-liệu)
3. [Phase 2 — Huấn luyện mô hình](#3-phase-2--huấn-luyện-mô-hình)
4. [Phase 3 — Tối ưu cho Edge AI](#4-phase-3--tối-ưu-cho-edge-ai)
5. [Phase 4 — Tích hợp phần cứng](#5-phase-4--tích-hợp-phần-cứng)
6. [Phase 5 — Chống gian lận](#6-phase-5--chống-gian-lận)
7. [Phase 6 — Monitoring & cải thiện liên tục](#7-phase-6--monitoring--cải-thiện-liên-tục)
8. [Toàn bộ tech stack](#8-toàn-bộ-tech-stack)
9. [Timeline & milestone](#9-timeline--milestone)
10. [Lưu ý thực tế quan trọng](#10-lưu-ý-thực-tế-quan-trọng)

---

## 1. Tổng Quan Kiến Trúc

```
[Camera] → [Pre-processing] → [AI Model] → [Decision Logic] → [Cơ cấu cơ khí]
                                                ↓
                                        [Backend Server]
                                                ↓
                                      [ESG Dashboard]
```

### Ba lớp xử lý chính

| Lớp | Nhiệm vụ | Chạy ở đâu |
|-----|----------|------------|
| **Perception** | Camera nhìn thấy vật thể | Edge device |
| **Inference** | AI phân loại vật thể | Edge device |
| **Decision** | Logic nghiệp vụ + gửi dữ liệu | Edge + Cloud |

### Lựa chọn mô hình

| Mô hình | Độ chính xác | Tốc độ (Pi 5) | Độ phức tạp |
|---------|-------------|----------------|-------------|
| **YOLOv8n** ✅ Khuyên dùng | ~85-90% | ~15-25 FPS | Thấp |
| YOLOv8s | ~90-93% | ~8-12 FPS | Trung bình |
| MobileNetV3 + SSD | ~82-87% | ~20-30 FPS | Thấp |
| EfficientDet-Lite | ~88-92% | ~10-18 FPS | Trung bình |

> **Khuyến nghị:** Bắt đầu với **YOLOv8n** (nano) — đủ nhanh, đủ chính xác, dễ train, dễ export sang TFLite/ONNX.

---

## 2. Phase 1 — Thu Thập & Chuẩn Bị Dữ Liệu

Đây là phase **quan trọng nhất**. Model tốt đến đâu cũng vô dụng nếu data kém.

### 2.1 Mục tiêu dataset

| Lớp | Số lượng ảnh tối thiểu | Mục tiêu lý tưởng |
|-----|----------------------|-------------------|
| Chai nhựa PET | 800 | 2.000+ |
| Hộp sữa giấy | 800 | 2.000+ |
| Lon thiếc | 800 | 2.000+ |
| **Tổng** | **2.400** | **6.000+** |

### 2.2 Đa dạng hóa data — CỰC KỲ QUAN TRỌNG

Mỗi lớp cần bao gồm:

```
✅ Trạng thái vật lý:
   - Còn nguyên vẹn
   - Bị bóp/móp nhẹ
   - Bị bóp móp nặng (thực tế sinh viên hay làm)
   - Còn nhãn / tróc nhãn / mờ nhãn
   - Còn nước / rỗng / còn bã

✅ Góc độ camera:
   - Nhìn thẳng từ trên xuống
   - Góc 45 độ
   - Nghiêng trái / nghiêng phải
   - Nhìn ngang

✅ Điều kiện ánh sáng:
   - Ánh sáng tốt (ban ngày)
   - Ánh sáng yếu (hầm, buổi tối)
   - Ánh sáng đèn huỳnh quang (điển hình trong trường)
   - Có bóng đổ

✅ Nền (background):
   - Nền trắng (khi thu thập lab)
   - Nền thực tế (khe bỏ của máy)
   - Nhiều vật thể xung quanh
```

### 2.3 Nguồn thu thập data

**Nguồn 1 — Tự chụp (quan trọng nhất)**
```bash
# Script chụp ảnh tự động từ camera
python scripts/capture_dataset.py \
  --class plastic_bottle \
  --count 200 \
  --output data/raw/plastic_bottle/
```

Cách làm: Dựng setup đơn giản — hộp các tông làm buồng chụp, đèn LED, xoay vật thể mỗi 15 độ.

**Nguồn 2 — Dataset công khai (để bổ sung)**
- [TACO Dataset](http://tacodataset.org/) — rác thải thực tế, có nhãn
- [TrashNet](https://github.com/garythung/trashnet) — 6 loại rác, ~2.500 ảnh
- [OpenImages V7](https://storage.googleapis.com/openimages/web/index.html) — tìm theo label "bottle", "tin can"
- [Roboflow Universe](https://universe.roboflow.com/) — tìm "plastic bottle detection", "recycling"

**Nguồn 3 — Data augmentation (nhân data)**

```python
# albumentations — thư viện augmentation mạnh nhất
import albumentations as A

transform = A.Compose([
    A.HorizontalFlip(p=0.5),
    A.VerticalFlip(p=0.2),
    A.RandomBrightnessContrast(brightness_limit=0.3, contrast_limit=0.3, p=0.7),
    A.GaussNoise(var_limit=(10, 50), p=0.4),
    A.MotionBlur(blur_limit=7, p=0.3),          # giả lập rung camera
    A.HueSaturationValue(p=0.4),                 # thay đổi màu nhãn chai
    A.RandomShadow(p=0.3),                       # giả lập bóng đổ
    A.Rotate(limit=30, p=0.5),
    A.Perspective(scale=(0.05, 0.15), p=0.4),    # giả lập góc nhìn khác
    A.CLAHE(p=0.3),                              # tăng độ tương phản vùng tối
], bbox_params=A.BboxParams(format='yolo'))      # giữ nguyên bounding box
```

> **Mục tiêu:** Từ 2.400 ảnh gốc → augment lên ~8.000–12.000 ảnh training.

### 2.4 Labeling (Gán nhãn)

**Tool khuyên dùng: Roboflow** (miễn phí cho project nhỏ)

```
Workflow:
1. Upload ảnh lên Roboflow
2. Dùng Auto-label (AI tự label trước) → sửa tay
3. Export theo format YOLO v8
4. Version control dataset (quan trọng!)
```

**Hoặc dùng Label Studio (self-hosted, miễn phí hoàn toàn):**
```bash
pip install label-studio
label-studio start
# Truy cập http://localhost:8080
```

**Cấu trúc thư mục YOLO format:**
```
dataset/
├── images/
│   ├── train/       # 70% data
│   ├── val/         # 20% data
│   └── test/        # 10% data
├── labels/
│   ├── train/       # file .txt tương ứng
│   ├── val/
│   └── test/
└── data.yaml        # config file
```

**data.yaml:**
```yaml
path: /home/user/dataset
train: images/train
val: images/val
test: images/test

nc: 3  # số lớp
names:
  0: plastic_bottle
  1: milk_carton
  2: tin_can
```

**Format label YOLO (mỗi dòng = 1 object):**
```
# class_id  x_center  y_center  width  height  (tất cả normalize 0-1)
0 0.512 0.489 0.234 0.567
```

### 2.5 Kiểm tra chất lượng data

```python
# Script kiểm tra dataset trước khi train
from ultralytics.data.utils import check_det_dataset

results = check_det_dataset('data.yaml')
# Kiểm tra: thiếu label, label lỗi, ảnh corrupt, class imbalance
```

**Checklist trước khi train:**
- [ ] Tỷ lệ train/val/test = 70/20/10
- [ ] Không có class nào chiếm > 60% tổng data (class imbalance)
- [ ] Tất cả ảnh đều có label tương ứng
- [ ] Không có ảnh trùng lặp
- [ ] Ảnh resolution tối thiểu 416x416

---

## 3. Phase 2 — Huấn Luyện Mô Hình

### 3.1 Cài đặt môi trường

```bash
# Tạo virtual environment
python -m venv recycling_env
source recycling_env/bin/activate  # Linux/Mac
# recycling_env\Scripts\activate   # Windows

# Cài dependencies
pip install ultralytics          # YOLOv8 - bao gồm PyTorch
pip install albumentations       # data augmentation
pip install roboflow             # download dataset từ Roboflow
pip install opencv-python        # xử lý ảnh
pip install matplotlib seaborn   # visualization
pip install wandb                # experiment tracking (khuyên dùng)
```

### 3.2 Training với YOLOv8

```python
from ultralytics import YOLO

# Load pretrained model (transfer learning — QUAN TRỌNG)
# Đừng train từ đầu, dùng weights đã train trên COCO dataset
model = YOLO('yolov8n.pt')  # nano — nhỏ nhất, nhanh nhất

results = model.train(
    data='data.yaml',
    epochs=100,              # bắt đầu với 100, tăng nếu chưa hội tụ
    imgsz=640,               # kích thước ảnh input
    batch=16,                # giảm xuống 8 nếu RAM không đủ
    patience=20,             # early stopping nếu val loss không giảm sau 20 epoch
    
    # Augmentation trong lúc train
    degrees=15.0,            # xoay ngẫu nhiên
    flipud=0.1,
    fliplr=0.5,
    mosaic=1.0,              # ghép 4 ảnh thành 1 — rất hiệu quả
    mixup=0.1,
    
    # Optimizer
    optimizer='AdamW',
    lr0=0.001,               # learning rate ban đầu
    lrf=0.01,                # learning rate cuối (lr0 * lrf)
    weight_decay=0.0005,
    
    # Output
    project='runs/train',
    name='recycling_v1',
    save=True,
    save_period=10,          # lưu checkpoint mỗi 10 epoch
    
    # Logging
    plots=True,              # tự tạo confusion matrix, PR curve
)
```

**Nếu có GPU (Google Colab / máy cá nhân):**
```python
model.train(..., device=0)        # GPU đầu tiên
model.train(..., device='0,1')    # Multi-GPU
```

**Nếu chỉ có CPU:**
```python
model.train(..., device='cpu', batch=4, imgsz=416)
# Sẽ rất chậm — khuyên dùng Google Colab (T4 GPU miễn phí)
```

### 3.3 Google Colab workflow (khuyên dùng cho team sinh viên)

```python
# Cell 1 — Setup
!pip install ultralytics roboflow -q

from roboflow import Roboflow
rf = Roboflow(api_key="YOUR_KEY")
project = rf.workspace("your-workspace").project("recycling-detector")
dataset = project.version(1).download("yolov8")

# Cell 2 — Train
from ultralytics import YOLO
model = YOLO('yolov8n.pt')
model.train(data=f'{dataset.location}/data.yaml', epochs=100, imgsz=640)

# Cell 3 — Evaluate
metrics = model.val()
print(f"mAP50: {metrics.box.map50:.3f}")
print(f"mAP50-95: {metrics.box.map:.3f}")

# Cell 4 — Download weights
from google.colab import files
files.download('runs/train/recycling_v1/weights/best.pt')
```

### 3.4 Đánh giá mô hình — hiểu các chỉ số

```python
metrics = model.val(data='data.yaml')

# Các chỉ số quan trọng:
# Precision: trong những gì model nói là "chai nhựa", bao nhiêu % đúng thật
# Recall: trong tất cả chai nhựa thật, model phát hiện được bao nhiêu %
# mAP50: mean Average Precision tại IoU=0.5 (chỉ số tổng hợp quan trọng nhất)
# mAP50-95: khắt khe hơn, đo trên nhiều ngưỡng IoU
```

**Ngưỡng chấp nhận được cho dự án này:**

| Chỉ số | Tối thiểu | Tốt | Xuất sắc |
|--------|-----------|-----|----------|
| mAP50 | 0.80 | 0.88 | 0.93+ |
| Precision | 0.82 | 0.90 | 0.95+ |
| Recall | 0.78 | 0.86 | 0.92+ |
| Inference time (Pi 5) | <200ms | <100ms | <60ms |

### 3.5 Xem confusion matrix

```python
# Tự động tạo khi train xong
# Xem tại: runs/train/recycling_v1/confusion_matrix.png

# Nếu confusion matrix cho thấy:
# - plastic_bottle bị nhầm thành milk_carton nhiều:
#   → Cần thêm data đa dạng hơn cho 2 lớp này
#   → Hoặc tăng contrast training, thêm ảnh từ góc khó
```

### 3.6 Thử nghiệm inference

```python
from ultralytics import YOLO
import cv2

model = YOLO('runs/train/recycling_v1/weights/best.pt')

# Test trên ảnh tĩnh
results = model.predict('test_bottle.jpg', conf=0.5)
results[0].show()  # hiện ảnh với bounding box

# Test realtime từ camera
results = model.predict(source=0, show=True, conf=0.5)
# source=0 = webcam đầu tiên

# Lấy thông tin chi tiết
for r in results:
    for box in r.boxes:
        class_id = int(box.cls)
        confidence = float(box.conf)
        class_name = model.names[class_id]
        print(f"Phát hiện: {class_name} | Độ tin cậy: {confidence:.2%}")
```

---

## 4. Phase 3 — Tối Ưu Cho Edge AI

Model `.pt` của PyTorch quá nặng cho Pi/ESP32. Cần convert và tối ưu.

### 4.1 Export model

```python
from ultralytics import YOLO

model = YOLO('best.pt')

# Option 1: TFLite (tốt nhất cho Raspberry Pi)
model.export(format='tflite', int8=True, imgsz=320)
# int8=True: quantization — giảm size 4x, tăng tốc ~2x, mất ~1-2% accuracy

# Option 2: ONNX (linh hoạt, chạy được nhiều nơi)
model.export(format='onnx', imgsz=320, simplify=True)

# Option 3: TensorRT (tốt nhất cho Jetson Nano)
model.export(format='engine', imgsz=320, half=True)
# half=True: FP16 quantization cho Jetson
```

### 4.2 So sánh sau khi optimize

| Format | File size | Inference (Pi 5) | Accuracy loss |
|--------|-----------|------------------|---------------|
| `.pt` (PyTorch) | ~6 MB | ~300ms | Baseline |
| `.onnx` | ~6 MB | ~150ms | ~0% |
| `.tflite` (FP32) | ~6 MB | ~120ms | ~0% |
| `.tflite` (INT8) ✅ | ~1.5 MB | ~50ms | ~1-2% |
| TensorRT (Jetson) | ~4 MB | ~15ms | ~1% |

### 4.3 Chạy TFLite trên Raspberry Pi

```python
import numpy as np
import cv2
from tflite_runtime.interpreter import Interpreter

class BeverageClassifier:
    def __init__(self, model_path, labels_path, conf_threshold=0.5):
        self.conf_threshold = conf_threshold
        self.labels = ['plastic_bottle', 'milk_carton', 'tin_can']
        
        # Load TFLite model
        self.interpreter = Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()
        
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        self.input_shape = self.input_details[0]['shape']  # [1, H, W, 3]
    
    def preprocess(self, frame):
        """Resize và normalize frame từ camera."""
        h, w = self.input_shape[1], self.input_shape[2]
        img = cv2.resize(frame, (w, h))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = np.expand_dims(img, axis=0).astype(np.uint8)
        return img
    
    def predict(self, frame):
        """Trả về list detections: [(class_name, confidence, bbox), ...]"""
        img = self.preprocess(frame)
        
        self.interpreter.set_tensor(self.input_details[0]['index'], img)
        self.interpreter.invoke()
        
        # YOLOv8 TFLite output: [1, num_detections, 6] (x,y,w,h,conf,class)
        output = self.interpreter.get_tensor(self.output_details[0]['index'])
        
        detections = []
        for det in output[0]:
            conf = float(det[4])
            if conf >= self.conf_threshold:
                class_id = int(det[5])
                class_name = self.labels[class_id]
                detections.append((class_name, conf, det[:4]))
        
        return detections
    
    def classify_single_object(self, frame):
        """Phân loại 1 vật thể duy nhất — dùng cho máy thu gom."""
        detections = self.predict(frame)
        if not detections:
            return None, 0.0
        # Lấy detection có confidence cao nhất
        best = max(detections, key=lambda x: x[1])
        return best[0], best[1]


# Sử dụng:
classifier = BeverageClassifier(
    model_path='recycling_int8.tflite',
    conf_threshold=0.60  # ngưỡng 60% — điều chỉnh tùy môi trường thực tế
)

cap = cv2.VideoCapture(0)
while True:
    ret, frame = cap.read()
    class_name, confidence = classifier.classify_single_object(frame)
    
    if class_name:
        print(f"[{class_name}] {confidence:.1%}")
```

### 4.4 Tối ưu thêm cho Pi 5

```python
# 1. Giảm resolution input (đánh đổi accuracy lấy tốc độ)
#    640x640 → 320x320: tăng tốc ~3x

# 2. Skip frames (không cần classify mỗi frame)
frame_count = 0
PROCESS_EVERY_N = 3  # chỉ classify mỗi 3 frame

while True:
    ret, frame = cap.read()
    frame_count += 1
    
    if frame_count % PROCESS_EVERY_N == 0:
        class_name, conf = classifier.classify_single_object(frame)

# 3. Threading — chạy camera và inference song song
import threading
from queue import Queue

frame_queue = Queue(maxsize=2)
result_queue = Queue(maxsize=2)

def camera_thread():
    cap = cv2.VideoCapture(0)
    while True:
        ret, frame = cap.read()
        if not frame_queue.full():
            frame_queue.put(frame)

def inference_thread():
    while True:
        if not frame_queue.empty():
            frame = frame_queue.get()
            result = classifier.classify_single_object(frame)
            result_queue.put(result)
```

---

## 5. Phase 4 — Tích Hợp Phần Cứng

### 5.1 Sơ đồ phần cứng

```
[Camera Module]
      ↓
[Raspberry Pi 5] ←→ [ESP32 (slave, điều khiển motor)]
      ↓                        ↓
[Load Cell + HX711]    [Servo Motor (cửa phân loại)]
      ↓                        ↓
[IR Sensor]            [LED + Buzzer (feedback user)]
      ↓
[Thermal Printer / QR Display]
      ↓
[Internet → Backend Server]
```

### 5.2 Danh sách linh kiện

| Linh kiện | Mục đích | Giá tham khảo |
|-----------|----------|---------------|
| Raspberry Pi 5 (4GB) | Main compute | ~1.800.000đ |
| Camera Module V3 | Thu hình chai | ~400.000đ |
| HX711 + Load Cell (5kg) | Cân trọng lượng | ~80.000đ |
| IR Sensor (HC-SR501) | Phát hiện có vật thể | ~20.000đ |
| ESP32 DevKit | Điều khiển motor | ~120.000đ |
| Servo Motor (MG996R) | Mở/đóng cửa | ~80.000đ × 2 |
| Stepper Motor + Driver | Băng chuyền | ~200.000đ |
| Thermal Printer | In vé | ~400.000đ |
| LED RGB + Buzzer | Feedback user | ~30.000đ |
| **Tổng phần cứng core** | | **~3.200.000đ** |

### 5.3 Logic điều khiển chính

```python
import time
import serial
import RPi.GPIO as GPIO
from hx711 import HX711

class RecyclingMachineController:
    
    # Ngưỡng trọng lượng (gram)
    WEIGHT_MIN = {
        'plastic_bottle': 8,    # chai PET rỗng ~10-25g
        'milk_carton': 12,      # hộp sữa rỗng ~15-30g
        'tin_can': 10           # lon rỗng ~12-20g
    }
    WEIGHT_MAX = {
        'plastic_bottle': 60,   # chai lớn ~50g, có nước thừa thêm chút
        'milk_carton': 80,
        'tin_can': 50
    }
    
    CONF_THRESHOLD = 0.65       # Confidence tối thiểu để accept
    
    def __init__(self):
        self.classifier = BeverageClassifier('recycling_int8.tflite')
        self.scale = HX711(dout_pin=5, pd_sck_pin=6)
        self.arduino = serial.Serial('/dev/ttyUSB0', 9600)
        self.bottle_count = 0
        self.session_log = []
    
    def run(self):
        """Main loop của máy."""
        while True:
            print("[STANDBY] Chờ vật thể...")
            self._wait_for_object()
            
            print("[DETECT] Đang phân tích...")
            result = self._analyze_object()
            
            if result['valid']:
                self._accept_object(result)
            else:
                self._reject_object(result['reason'])
    
    def _wait_for_object(self):
        """Chờ IR sensor phát hiện vật thể."""
        IR_PIN = 17
        while GPIO.input(IR_PIN) == GPIO.HIGH:
            time.sleep(0.05)
        time.sleep(0.3)  # debounce
    
    def _analyze_object(self):
        """Phân tích vật thể bằng AI + cân."""
        
        # Step 1: Chụp ảnh và classify
        frames = []
        for _ in range(5):  # chụp 5 frame, lấy majority vote
            ret, frame = self.camera.read()
            class_name, conf = self.classifier.classify_single_object(frame)
            if class_name:
                frames.append((class_name, conf))
            time.sleep(0.1)
        
        if not frames:
            return {'valid': False, 'reason': 'NO_OBJECT_DETECTED'}
        
        # Majority vote
        from collections import Counter
        class_votes = Counter([f[0] for f in frames])
        predicted_class = class_votes.most_common(1)[0][0]
        avg_conf = np.mean([f[1] for f in frames if f[0] == predicted_class])
        
        # Step 2: Kiểm tra confidence
        if avg_conf < self.CONF_THRESHOLD:
            return {'valid': False, 'reason': 'LOW_CONFIDENCE', 'class': predicted_class, 'conf': avg_conf}
        
        # Step 3: Cân trọng lượng
        weight = self.scale.get_weight_mean(5)
        
        # Step 4: Kiểm tra trọng lượng hợp lệ (chống gian lận)
        min_w = self.WEIGHT_MIN[predicted_class]
        max_w = self.WEIGHT_MAX[predicted_class]
        
        if weight < min_w:
            return {'valid': False, 'reason': 'TOO_LIGHT', 'weight': weight}
        if weight > max_w:
            return {'valid': False, 'reason': 'TOO_HEAVY', 'weight': weight}
        
        return {
            'valid': True,
            'class': predicted_class,
            'confidence': avg_conf,
            'weight': weight,
            'timestamp': time.time()
        }
    
    def _accept_object(self, result):
        """Chấp nhận vật thể hợp lệ."""
        # Ra lệnh cho ESP32 mở cửa đúng khoang
        compartment_map = {
            'plastic_bottle': 'A',
            'milk_carton': 'B', 
            'tin_can': 'C'
        }
        cmd = f"OPEN:{compartment_map[result['class']]}\n"
        self.arduino.write(cmd.encode())
        
        # Đèn xanh + beep
        self.arduino.write(b"LED:GREEN\n")
        self.arduino.write(b"BEEP:1\n")
        
        # Cập nhật đếm
        self.bottle_count += 1
        self.session_log.append(result)
        
        # Kiểm tra đủ 5 chai chưa
        if self.bottle_count >= 5:
            self._issue_reward()
            self.bottle_count = 0
        
        # Gửi dữ liệu về server
        self._log_to_server(result)
        
        print(f"[ACCEPTED] {result['class']} | conf={result['confidence']:.1%} | {result['weight']:.1f}g")
        print(f"[COUNT] {self.bottle_count}/5 chai")
    
    def _reject_object(self, reason):
        """Từ chối vật thể không hợp lệ."""
        reason_messages = {
            'NO_OBJECT_DETECTED': 'Không phát hiện vật thể',
            'LOW_CONFIDENCE': 'Không nhận dạng được vật thể',
            'TOO_LIGHT': 'Vật thể quá nhẹ (có thể gian lận)',
            'TOO_HEAVY': 'Vật thể quá nặng (có thể gian lận)'
        }
        
        self.arduino.write(b"LED:RED\n")
        self.arduino.write(b"BEEP:3\n")  # 3 tiếng beep = từ chối
        print(f"[REJECTED] {reason_messages.get(reason, reason)}")
    
    def _issue_reward(self):
        """In vé gửi xe khi đủ 5 chai."""
        # Gửi lệnh in vé thermal printer
        self.printer.print_ticket()
        self.arduino.write(b"LED:BLINK_GREEN\n")
        print("[REWARD] Đã in vé gửi xe miễn phí!")
    
    def _log_to_server(self, result):
        """Gửi dữ liệu lên backend (async)."""
        import threading
        def send():
            import requests
            try:
                requests.post('https://api.yourserver.com/log', json={
                    'machine_id': 'BK_GATE_01',
                    'class': result['class'],
                    'confidence': result['confidence'],
                    'weight': result['weight'],
                    'timestamp': result['timestamp']
                }, timeout=3)
            except:
                pass  # Không để lỗi mạng ảnh hưởng hoạt động máy
        
        threading.Thread(target=send, daemon=True).start()
```

---

## 6. Phase 5 — Chống Gian Lận

Đây là challenge thực tế lớn nhất. Sinh viên sẽ thử mọi cách.

### 6.1 Các hình thức gian lận phổ biến

| Gian lận | Cách phòng | Implement |
|----------|------------|-----------|
| Bỏ lại cùng 1 chai nhiều lần | Đọc serial number QR/barcode | Scan barcode mỗi chai, lưu DB |
| Bỏ đá/nước vào chai | Cân trọng lượng max | `weight > MAX → reject` |
| Bỏ vật thể giống chai | AI multi-frame voting | 5 frame → majority vote |
| Bỏ chai từ ngoài trường | Giới hạn địa lý | GPS check (nếu app) |
| Farm reward hàng loạt | Rate limiting | Max 3 lần/ngày/user |
| Nhét tay vào máy | IR sensor liên tục | Abort nếu IR triggered khi đang xử lý |

### 6.2 Barcode/QR tracking system

```python
import cv2
from pyzbar import pyzbar

def scan_barcode(frame):
    """Đọc barcode/QR từ chai."""
    barcodes = pyzbar.decode(frame)
    if barcodes:
        return barcodes[0].data.decode('utf-8')
    return None

class AntiCheatSystem:
    def __init__(self, db_connection):
        self.db = db_connection
        self.COOLDOWN_HOURS = 0  # không cooldown per barcode
        
    def is_barcode_used_today(self, barcode):
        """Kiểm tra chai này đã bỏ vào hôm nay chưa."""
        result = self.db.execute(
            "SELECT COUNT(*) FROM submissions WHERE barcode=? AND DATE(timestamp)=DATE('now')",
            (barcode,)
        ).fetchone()
        return result[0] > 0
    
    def register_submission(self, barcode, machine_id, class_name):
        self.db.execute(
            "INSERT INTO submissions (barcode, machine_id, class, timestamp) VALUES (?,?,?,datetime('now'))",
            (barcode, machine_id, class_name)
        )
        self.db.commit()
```

### 6.3 Anomaly detection đơn giản

```python
def is_suspicious_session(session_log):
    """Phát hiện pattern gian lận bất thường."""
    
    # Tất cả chai trong session đều cùng 1 loại chính xác — có thể gian lận
    classes = [item['class'] for item in session_log]
    if len(set(classes)) == 1 and len(classes) >= 5:
        # Bình thường sinh viên mix các loại
        # Nếu 5/5 đều là cùng loại → không nhất thiết gian lận nhưng đáng log
        pass
    
    # Thời gian bỏ chai quá nhanh (< 5 giây/chai) — bất thường
    timestamps = [item['timestamp'] for item in session_log]
    if len(timestamps) >= 2:
        intervals = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
        if any(iv < 5 for iv in intervals):
            return True, "TOO_FAST"
    
    return False, None
```

---

## 7. Phase 6 — Monitoring & Cải Thiện Liên Tục

### 7.1 Telemetry system

```python
import psutil
import json
import paho.mqtt.client as mqtt

def send_telemetry(machine_id, broker_url):
    """Gửi health data của máy về server mỗi phút."""
    client = mqtt.Client()
    client.connect(broker_url)
    
    telemetry = {
        'machine_id': machine_id,
        'timestamp': time.time(),
        'cpu_temp': get_cpu_temp(),
        'cpu_percent': psutil.cpu_percent(),
        'ram_percent': psutil.virtual_memory().percent,
        'storage_fill_level': get_storage_fill_level(),  # từ ultrasonic sensor
        'camera_status': check_camera_health(),
        'internet_status': check_internet(),
        'model_version': '1.2.0',
        'bottles_today': get_bottles_today()
    }
    
    client.publish(f"machines/{machine_id}/telemetry", json.dumps(telemetry))

def get_cpu_temp():
    with open('/sys/class/thermal/thermal_zone0/temp') as f:
        return int(f.read()) / 1000  # Celsius
```

### 7.2 Thu thập data thực tế để retrain

```python
# Lưu lại mọi ảnh bị reject để phân tích sau
def log_failed_detection(frame, reason, confidence):
    timestamp = int(time.time())
    filename = f"failed/{reason}_{confidence:.2f}_{timestamp}.jpg"
    cv2.imwrite(filename, frame)
    
    # Upload lên server để team xem xét
    upload_to_server(filename)
```

**Lịch retrain đề xuất:**

| Giai đoạn | Tần suất retrain | Trigger |
|-----------|-----------------|---------|
| Tháng 1 | Mỗi 2 tuần | Có >200 failed detections |
| Tháng 2-3 | Mỗi tháng | Accuracy < 85% |
| Sau tháng 3 | Mỗi quý | Thêm loại vật liệu mới |

### 7.3 OTA update model

```python
import hashlib
import requests

def check_and_update_model(current_version, server_url):
    """Tự động download model mới nếu có."""
    
    # Check version từ server
    response = requests.get(f"{server_url}/model/latest")
    latest = response.json()
    
    if latest['version'] != current_version:
        print(f"[OTA] Model mới: v{latest['version']}")
        
        # Download
        model_data = requests.get(latest['download_url']).content
        
        # Verify checksum
        if hashlib.sha256(model_data).hexdigest() == latest['sha256']:
            with open('recycling_int8.tflite', 'wb') as f:
                f.write(model_data)
            print("[OTA] Update thành công. Restart inference...")
            return True
    
    return False
```

---

## 8. Toàn Bộ Tech Stack

### 8.1 Machine Learning & AI

```
Core Framework:
├── PyTorch 2.x                    # Training framework
├── Ultralytics YOLOv8             # Model architecture + training pipeline
├── OpenCV 4.x                     # Computer vision, camera capture
└── TensorFlow Lite Runtime        # Edge inference

Data & Preprocessing:
├── Albumentations                 # Data augmentation
├── Roboflow                       # Dataset management, labeling, versioning
├── Label Studio                   # Self-hosted labeling alternative
└── NumPy / Pandas                 # Data manipulation

Experiment Tracking:
├── Weights & Biases (wandb)       # Training metrics, model comparison
└── TensorBoard                    # Alternative, built into TF

Model Optimization:
├── ONNX Runtime                   # Format conversion, optimization
├── TFLite Converter               # INT8 quantization
└── TensorRT (Jetson only)         # Hardware-accelerated inference
```

### 8.2 Edge Hardware & Firmware

```
Main Compute:
├── Raspberry Pi 5 (4GB RAM)       # Primary recommendation
├── Jetson Orin Nano               # If higher AI performance needed
└── ESP32-S3                       # Co-processor for motor control

Sensors & Actuators:
├── Raspberry Pi Camera Module V3  # 12MP, autofocus
├── HX711 + Load Cell              # Weight measurement
├── HC-SR501 IR Sensor             # Object presence detection
├── HC-SR04 Ultrasonic             # Storage fill level
├── MG996R Servo Motors            # Door/flap control
└── Stepper + A4988 Driver         # Conveyor belt

Feedback:
├── WS2812B LED Strip              # Status lighting
├── Piezo Buzzer                   # Audio feedback
└── Thermal Printer (CSN-A2)       # Reward ticket printing

Connectivity:
├── Built-in WiFi (Pi 5)
└── SIM800L GSM Module             # Backup 4G nếu WiFi yếu
```

### 8.3 Backend & Cloud

```
API Server:
├── Node.js + Express / NestJS     # REST API
├── Python FastAPI                 # ML endpoints (nếu cần server-side inference)
└── MQTT Broker (Mosquitto)        # IoT real-time messaging

Database:
├── PostgreSQL                     # Transactional data (submissions, rewards)
├── TimescaleDB (PostgreSQL ext)   # Time-series telemetry data
└── Redis                         # Cache, session, rate limiting

Infrastructure:
├── Docker + Docker Compose        # Containerization
├── Nginx                          # Reverse proxy
└── GitHub Actions                 # CI/CD

Hosting options:
├── VPS (DigitalOcean/Vultr ~$6/tháng)   # Development
└── AWS EC2 / GCP Compute Engine          # Production
```

### 8.4 Frontend & Dashboard

```
ESG Dashboard (Web):
├── React + Vite                   # UI framework
├── Recharts / Chart.js            # Data visualization
├── TanStack Query                 # Data fetching
└── Tailwind CSS                   # Styling

Mobile App (tương lai):
├── React Native                   # Cross-platform
└── Expo                           # Rapid development

Real-time:
└── WebSocket / Socket.io          # Live dashboard updates
```

### 8.5 Development Tools

```
Version Control:
├── Git + GitHub                   # Source control
└── Git LFS                        # Large file storage (model weights, datasets)

Development:
├── VS Code + Remote SSH           # Code trực tiếp trên Pi
├── Jupyter Lab                    # Prototyping, data analysis
└── Google Colab                   # Training (GPU miễn phí)

Testing:
├── pytest                         # Unit tests
├── Postman                        # API testing
└── pytest-benchmark               # Inference speed benchmarking

Monitoring:
├── Grafana + Prometheus           # Dashboard monitoring
└── Paho MQTT                      # IoT messaging client
```

---

## 9. Timeline & Milestone

### Giai đoạn 1 — Data & Model (Tuần 1–4)

```
Tuần 1: Thu thập data
  ✓ Dựng setup chụp ảnh (hộp carton + đèn LED)
  ✓ Chụp 300 ảnh/loại (900 ảnh tổng)
  ✓ Download TrashNet + OpenImages bổ sung

Tuần 2: Labeling & Augmentation
  ✓ Label toàn bộ data tự chụp trên Roboflow
  ✓ Augment lên ~4.000 ảnh
  ✓ Tạo train/val/test split

Tuần 3: Training lần 1
  ✓ Train YOLOv8n trên Google Colab
  ✓ Đánh giá mAP50 — target: >0.80
  ✓ Phân tích confusion matrix

Tuần 4: Iteration & Optimize
  ✓ Thêm data cho class yếu nhất
  ✓ Retrain — target mAP50 >0.85
  ✓ Export TFLite INT8
  ✓ Benchmark tốc độ trên Pi 5
```

### Giai đoạn 2 — Hardware Integration (Tuần 5–8)

```
Tuần 5-6: Prototype phần cứng
  ✓ Lắp ráp Pi 5 + camera + IR sensor
  ✓ Test inference TFLite realtime
  ✓ Tích hợp load cell (cân trọng lượng)

Tuần 7-8: Full system integration
  ✓ Tích hợp ESP32 + servo motor
  ✓ Logic điều khiển hoàn chỉnh
  ✓ Anti-cheat cơ bản (weight check)
  ✓ Backend server + database cơ bản
```

### Giai đoạn 3 — MVP Deployment (Tuần 9–12)

```
Tuần 9-10: Hoàn thiện
  ✓ Thermal printer tích hợp (in vé)
  ✓ Dashboard cơ bản
  ✓ OTA update system
  ✓ Telemetry gửi về server

Tuần 11: Thử nghiệm nội bộ
  ✓ Test 200+ lần với 3 loại vật thể
  ✓ Test các edge case (chai móp, ánh sáng kém)
  ✓ Fix bugs

Tuần 12: Pilot thực tế
  ✓ Đặt máy tại 1 điểm trong Bách Khoa
  ✓ Thu thập feedback sinh viên
  ✓ Monitor qua dashboard
```

---

## 10. Lưu Ý Thực Tế Quan Trọng

### Những lỗi phổ biến cần tránh

**1. Chỉ test trong điều kiện tốt**
> Model đạt 95% trong lab nhưng xuống 60% khi ra thực tế (ánh sáng xấu, chai bẩn, góc lệch). Luôn test trong điều kiện thực tế của máy.

**2. Bỏ qua trọng lượng**
> Camera AI alone không đủ. Load cell là lớp xác thực thứ 2 quan trọng, vừa chống gian lận vừa bổ trợ khi AI không chắc chắn.

**3. Không có fallback khi mất mạng**
> Máy phải hoạt động offline được. Lưu data local (SQLite) và sync khi có mạng.

**4. Quên cơ chế chống kẹt cơ khí**
> Chai bị móp méo rất dễ kẹt. Cần: timeout tự mở lại, nút reset vật lý, cảnh báo kẹt qua dashboard.

**5. Train data quá "sạch"**
> Nếu chỉ train với ảnh chai còn nguyên đẹp, model sẽ fail với chai bị bóp. Luôn include negative examples.

### Ngưỡng confidence phù hợp

```python
# ĐỪNG để threshold quá cao hoặc quá thấp
CONF_THRESHOLD = 0.65  # Điểm cân bằng tốt cho môi trường thực

# Nếu threshold quá thấp (0.3): nhận nhầm quá nhiều
# Nếu threshold quá cao (0.9): từ chối oan nhiều chai hợp lệ
# → Điều chỉnh dựa trên dữ liệu thực tế sau khi pilot
```

### Checklist trước khi deploy thực tế

- [ ] mAP50 > 0.85 trên test set **thực tế** (không chỉ val set)
- [ ] Inference time < 200ms trên Pi 5 ở điều kiện ánh sáng kém
- [ ] Test đủ 100 lần với mỗi loại vật thể
- [ ] Test các edge case: chai bẹp 80%, chai không nhãn, lon bẹp, hộp sữa dập
- [ ] Anti-cheat hoạt động: từ chối chai quá nhẹ, quá nặng
- [ ] Máy tự phục hồi sau mất điện/mất mạng
- [ ] Dashboard nhận data realtime
- [ ] OTA update hoạt động end-to-end
- [ ] Nút reset vật lý và cảnh báo kẹt cơ khí

---

*Tài liệu này được xây dựng dựa trên định hướng dự án Smart Recycling Bin — Thu gom chai nhựa thông minh tại ĐH Bách Khoa TPHCM.*
