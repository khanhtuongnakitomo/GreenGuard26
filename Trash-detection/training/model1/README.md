# Model 1 rebuild — PET bottle vs aluminum can

YOLOv8n-OBB detector + **yolov8n-cls** crop classifier (Fix B).

| Stage | Model | Job |
|---|---|---|
| 1 | `export/onnx_416/model.onnx` | Find object in frame (OBB) |
| 2 | `export/cls_onnx_224/model.onnx` | Classify crop: **pet** vs **can** |

One object in frame at a time. Demos run on **CPU** (~5 FPS target).

---

## Install (from scratch)

```powershell
cd GreenGuard26\Trash-detection\training/model1

py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

python scripts\env_check.py
```

GPU torch is only needed for **training** (see below).

---

## Demo

```powershell
.\run_m1_demo.bat
```

Direct Python (more flags):

```powershell
.\.venv\Scripts\python.exe scripts\demo_live.py
.\.venv\Scripts\python.exe scripts\demo_live.py --det-conf 0.05 --fps 5
.\.venv\Scripts\python.exe scripts\demo_live.py --source 0
.\.venv\Scripts\python.exe scripts\demo_live.py --save logs\m1_diag
```

| Key | Action |
|---|---|
| `Q` | Quit |
| `S` | Snapshot → `logs\demo_snap.jpg` |

**Flags:**

| Flag | Default | Description |
|---|---|---|
| `--det-conf` | `0.05` | Detector conf (localization only) |
| `--vote` | `5` | Frame majority vote |
| `--min-area` | `0.02` | Min box area (fraction of frame) |
| `--no-cls` | off | Skip classifier; use detector class id |
| `--cls-model` | `auto` | Path to classifier `.pt` or `.onnx` |
| `--fps` | `5` | Target FPS cap |

Console should show:

```text
[demo] mode: two-stage (detect + classify)
[m1 two-stage] classifier=.../export/cls_onnx_224/model.onnx
```

---

## Committed artifacts

| File | Role |
|---|---|
| `export/onnx_416/model.onnx` | Detector (Jetson + PC @416) |
| `export/cls_onnx_224/model.onnx` | PET/can classifier @224 |
| `runs/seed42_n640/weights/best.pt` | Detector PyTorch weights |
| `runs/cls_pet_can_seed42_n224/weights/best.pt` | Classifier PyTorch weights |

---

## Retrain detector (bottle / aluminum OBB)

Requires dataset under `../dataset/model1/` (not in Git). On a machine that
has the Detection-rebuild dataset pipeline, or after you regenerate splits:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_training.ps1
```

Output: `runs/seed42_n640/weights/best.pt` (~80 epochs, ~1 h on RTX 3060).

Export ONNX @416 for deploy:

```powershell
python scripts\export_onnx.py
```

*(Add export script if missing; weights can be exported via Ultralytics:*
*`YOLO('runs/.../best.pt').export(format='onnx', imgsz=416)`)*

---

## Retrain PET/can classifier (Fix B)

Builds crops from OBB labels, trains `yolov8n-cls`, exports ONNX:

```powershell
.\run_m1_cls_train.bat
```

Smoke test (~2 min):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_classifier_training.ps1 -Smoke
```

Pipeline steps:

1. `scripts/make_crops.py` → `../dataset/model1/crops/{train,val}/{pet,can}/`
2. `scripts/train_cls.py` → `runs/cls_pet_can_seed42_n224/`
3. `scripts/export_classifier_onnx.py` → `export/cls_onnx_224/`
4. `scripts/eval_cls_crops.py` — informational val accuracy only

**Judge live webcam frames**, not crop val accuracy, for pass/fail.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Falls back to `detector-only` | Run `git pull`; check `export/cls_onnx_224/model.onnx` exists |
| Classifier ONNX error | Classifier must load with `task=classify` (handled in `m1_two_stage.py`) |
| No detection on can | Lower `--det-conf 0.05`; if still nothing, localization needs more data |
| Wrong class but box is correct | Classifier issue — retrain with `run_m1_cls_train.bat` or collect live frames |

---

## Scripts

| Script | Purpose |
|---|---|
| `demo_live.py` | Live M1 demo (two-stage) |
| `m1_two_stage.py` | Shared detect → crop → classify logic |
| `make_crops.py` | Build cls dataset from OBB splits |
| `train_cls.py` | Train yolov8n-cls |
| `export_classifier_onnx.py` | Export cls ONNX @224 |
| `train.py` | Train OBB detector |
| `run_training.ps1` | One-command detector training |
| `run_classifier_training.ps1` | One-command cls pipeline |
