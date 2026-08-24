# GreenGuard Trash Detection (rebuild)

Computer-vision stack for the **GreenGuard26** recycling kiosk. The **current**
production path uses the rebuilt YOLOv8-OBB models under `model1-rebuild/` and
`model2-rebuild/` (not the older `Model1/` / `Model2/` folders).

```text
Camera (one object in frame)
  → Model 1 — PET bottle vs aluminum can
       ├─ aluminum can  → show result, stop (no Model 2)
       └─ PET bottle
            → Model 2 — cap / label / sealant-ring (OBB)
                 ├─ any part ≥ threshold  → PET REJECT (red banner)
                 └─ none                  → PET ACCEPT (green banner)
```

**Branch with latest weights and demos:** `refactor/new-model-migrate`

---

## What you need

| Item | Demo (inference) | Training |
|---|---|---|
| OS | Windows 10/11 (laptop or workstation) | Same |
| Python | **3.11** recommended | 3.11 |
| Webcam | USB or built-in (`--source 0`) | — |
| GPU | Not required for demo (CPU @ ~5 FPS) | NVIDIA GPU recommended (e.g. RTX 3060) |
| Disk | ~2 GB for venv + committed weights | +dataset size if retraining |

Demos run on **CPU only** by design. GPU is for training.

---

## 1. Clone the repo

```powershell
git clone https://github.com/khanhtuongnakitomo/GreenGuard26.git
cd GreenGuard26
git checkout refactor/new-model-migrate
git pull
```

All commands below assume you are in:

```text
GreenGuard26\Trash-detection\
```

---

## 2. One-time install (shared environment)

Both Model 1 and Model 2 demos use **one** virtual environment in
`model1-rebuild/.venv`.

```powershell
cd Trash-detection\model1-rebuild

# Create venv (Python 3.11)
py -3.11 -m venv .venv

# Activate
.\.venv\Scripts\Activate.ps1

# Install dependencies (CPU torch is fine for demo)
pip install -r requirements.txt
```

**Optional — GPU for training only** (RTX 30/40 series example):

```powershell
pip uninstall -y torch torchvision
pip install torch==2.13.0+cu126 torchvision==0.28.0+cu126 `
  --index-url https://download.pytorch.org/whl/cu126
python -c "import torch; print(torch.__version__, torch.cuda.is_available())"
```

Verify imports:

```powershell
python scripts\env_check.py
```

### What is already in Git (no download needed for demo)

| Artifact | Path |
|---|---|
| Model 1 detector ONNX @416 | `model1-rebuild/export/onnx_416/model.onnx` |
| Model 1 PET/can classifier ONNX @224 | `model1-rebuild/export/cls_onnx_224/model.onnx` |
| Model 1 detector weights | `model1-rebuild/runs/seed42_n640/weights/best.pt` |
| Model 1 classifier weights | `model1-rebuild/runs/cls_pet_can_seed42_n224/weights/best.pt` |
| Model 2 ONNX @640 (PC) | `model2-rebuild/export/onnx_640/model.onnx` |
| Model 2 ONNX @416 (Jetson) | `model2-rebuild/export/onnx_416/model.onnx` |
| Model 2 weights | `model2-rebuild/runs/m2v3_seed42_n640/weights/best.pt` |

Training datasets are **not** in Git. You only need them if you retrain.

---

## 3. Demo — Model 1 only (PET vs aluminum)

Detects whether the object in frame is a **PET bottle** or an **aluminum can**.

Uses **two-stage** inference when the classifier is present (default after pull):

1. OBB detector finds the object (low confidence, localization only).
2. Crop classifier (`yolov8n-cls @224`) decides PET vs can.

```powershell
cd Trash-detection\model1-rebuild
.\run_m1_demo.bat
```

| Key | Action |
|---|---|
| `Q` | Quit |
| `S` | Save snapshot to `logs\demo_snap.jpg` |

**Useful options** (append to the batch file or call Python directly):

```powershell
.\.venv\Scripts\python.exe scripts\demo_live.py --fps 5 --det-conf 0.05
.\.venv\Scripts\python.exe scripts\demo_live.py --source path\to\image.jpg
.\.venv\Scripts\python.exe scripts\demo_live.py --save logs\m1_diag --max-frames 20
.\.venv\Scripts\python.exe scripts\demo_live.py --no-cls
```

| Flag | Default | Meaning |
|---|---|---|
| `--det-conf` | `0.05` | Detector threshold (localization) |
| `--vote` | `5` | Majority vote over last N frames |
| `--no-cls` | off | Legacy detector-only (no crop classifier) |
| `--fps` | `5` | Target frame rate |

**Expected:** one object in frame; legend shows `PET bottle` (orange) or
`Aluminum can` (green) with classifier confidence.

More detail: [model1-rebuild/README.md](model1-rebuild/README.md)

---

## 4. Demo — Model 2 only (cap / label / ring)

Runs **only** the part detector on the full frame (no Model 1 gate).

```powershell
cd Trash-detection\model2-rebuild
.\run_m2_demo.bat
```

Uses `model1-rebuild\.venv` automatically.

```powershell
.\run_m2_demo.bat --fps 10 --conf 0.4
.\run_m2_demo.bat --source video.mp4 --save logs\m2_demo
```

| Key | Action |
|---|---|
| `Q` | Quit |
| `S` | Snapshot to `logs\m2_demo_snap.jpg` |

Classes: `cap` (red), `label` (yellow), `ring` (magenta).

More detail: [model2-rebuild/README.md](model2-rebuild/README.md)

---

## 5. Demo — Full gate (Model 1 + Model 2)

This is the **kiosk logic**: Model 1 must see a PET bottle before Model 2 runs.
Aluminum cans are detected but **do not** trigger the accept/reject banner.

```powershell
cd Trash-detection\model2-rebuild
.\run_gate_demo.bat
```

```powershell
.\run_gate_demo.bat --m1-conf 0.05 --m2-conf 0.5 --fps 5
.\run_gate_demo.bat --save logs\gate_out --max-frames 30
```

| Flag | Default | Meaning |
|---|---|---|
| `--m1-conf` | `0.05` | Model 1 detector localization threshold |
| `--m2-conf` | `0.5` | Min confidence for cap/label/ring to count as reject |
| `--no-m1-cls` | off | Use legacy M1 class ids instead of crop classifier |
| `--fps` | `5` | Target frame rate |

**Verdict banner (top center):**

| Situation | Banner |
|---|---|
| PET, no cap/label/ring ≥ `--m2-conf` | Green — `PET ACCEPT` |
| PET, any part ≥ `--m2-conf` | Red — `PET REJECT — cap/label/ring …` |
| Aluminum can | Box drawn, **no** gate banner |
| Nothing detected | Gray legend only |

Verdict uses a **3-of-5 frame vote** so borderline detections do not flicker.

---

## 6. Retrain (optional)

You do **not** need this for laptop demo if committed weights are present.

| Goal | Where | Command |
|---|---|---|
| Retrain M1 detector (bottle/can OBB) | `model1-rebuild/` | `powershell -ExecutionPolicy Bypass -File scripts\run_training.ps1` |
| Retrain M1 PET/can classifier | `model1-rebuild/` | `.\run_m1_cls_train.bat` |
| Retrain M2 (cap/label/ring) | `model2-rebuild/` | `powershell -ExecutionPolicy Bypass -File scripts\run_model2_training.ps1 -AllowNoRing` |
| Export M2 for Jetson Nano | `model2-rebuild/` | `..\model1-rebuild\.venv\Scripts\python.exe scripts\export_onnx.py` |

See per-model READMEs for dataset layout and smoke tests.

---

## 7. Jetson Nano B01 (deploy)

- Model 2: copy `model2-rebuild/export/onnx_416/` and follow
  [model2-rebuild/jetson/README.md](model2-rebuild/jetson/README.md)
- Model 1: ONNX @416 + classifier ONNX @224 under `model1-rebuild/export/`
- Do **not** install Ultralytics on the Nano; use `onnxruntime` inference scripts.

---

## 8. Troubleshooting

### `No module named ultralytics`

Activate venv and reinstall:

```powershell
cd Trash-detection\model1-rebuild
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### OpenCV window does not open

Ensure `opencv-python` is installed (not headless-only):

```powershell
pip uninstall -y opencv-python-headless
pip install opencv-python
```

### Model 1 always says PET / never sees cans

Confirm two-stage mode is on (console should print `mode: two-stage`).
Try lower localization threshold:

```powershell
.\run_m1_demo.bat --det-conf 0.05
```

### `STALE EXPORT - skipping` in gate demo

An ONNX file is older than `best.pt`. Re-export:

```powershell
cd model2-rebuild
..\model1-rebuild\.venv\Scripts\python.exe scripts\export_onnx.py
```

### Webcam wrong index

```powershell
.\run_m1_demo.bat --source 1
```

### Slow FPS on CPU

Normal at ~0.5–5 FPS depending on CPU. `--fps` only caps the target; actual
speed is shown in the status line.

---

## 9. Repository layout

```text
Trash-detection/
├── README.md                    ← this file
├── model1-rebuild/              ← PET vs aluminum (YOLOv8n-OBB + cls)
│   ├── run_m1_demo.bat
│   ├── run_m1_cls_train.bat
│   ├── export/onnx_416/         ← detector deploy
│   ├── export/cls_onnx_224/     ← PET/can classifier deploy
│   └── scripts/demo_live.py
├── model2-rebuild/              ← cap / label / ring (YOLOv8n-OBB)
│   ├── run_m2_demo.bat
│   ├── run_gate_demo.bat        ← M1 + M2 kiosk logic
│   ├── export/onnx_640/         ← PC demo
│   ├── export/onnx_416/         ← Jetson
│   └── jetson/
├── Model1/                      ← legacy kiosk (older 3-class material model)
└── Model2/                      ← legacy cap/label/liquid model
```

Use **`model1-rebuild` + `model2-rebuild`** for all new work. Legacy folders remain
for reference and older Pi/TFLite paths.

---

## 10. Quick reference

| Goal | Command |
|---|---|
| Install once | `cd model1-rebuild` → `py -3.11 -m venv .venv` → `pip install -r requirements.txt` |
| Model 1 demo | `model1-rebuild\run_m1_demo.bat` |
| Model 2 demo | `model2-rebuild\run_m2_demo.bat` |
| Full gate demo | `model2-rebuild\run_gate_demo.bat` |
| Train M1 classifier | `model1-rebuild\run_m1_cls_train.bat` |
| Train M2 | `model2-rebuild\scripts\run_model2_training.ps1 -AllowNoRing` |
