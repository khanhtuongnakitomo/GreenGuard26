# GreenGuard Trash Detection

Computer-vision module for the **GreenGuard26** recycling kiosk. It runs a **two-stage pipeline**:

1. **Model 1** — detect material type (`metal_can`, `pet_bottle`, `pp_cup`)
2. **Model 2** — for **PET only**, detect whether a **cap** or **label** is still visible

If Model 1 sees PET and Model 2 finds a cap or label (confidence ≥ 0.75), the kiosk **rejects** the item and does **not** count it. Cans and PP cups skip Model 2.

```text
Camera
  → Model 1 (material)
       ├─ metal_can / pp_cup  → accept & count
       └─ pet_bottle
            → crop bottle region
            → Model 2 (cap / label OBB)
                 ├─ cap or label found  → REJECT (not counted)
                 └─ neither found       → accept & count
```

---

## Repository layout

```text
Trash-detection/
├── README.md                 ← you are here
├── Model1/                   ← material detection + kiosk UI/session
│   ├── models/
│   │   ├── best.pt           ← committed (YOLO material model)
│   │   └── best_float16.tflite
│   ├── src/
│   │   ├── test_webcam.py    ← PC live demo (PyTorch)
│   │   └── inference_tflite.py
│   └── setup.ps1
└── Model2/                   ← PET cap/label inspection
    ├── models/
    │   └── best.pt           ← committed (YOLO11n-OBB)
    ├── src/
    │   ├── train.py
    │   └── predict_folder.py
    └── train.ps1
```

More detail:

- [Model1/README.md](Model1/README.md) — material classifier, TFLite export, Raspberry Pi notes
- [Model2/README.md](Model2/README.md) — cap/label training and preview

---

## What is in Git vs what is not

| In the repo (after `git clone`) | Not in the repo (prepare locally) |
|---|---|
| All Python source code | `Model1/data/` — training images for Model 1 |
| `Model1/models/best.pt` | `Model2/data/` — cap/label dataset from Roboflow |
| `Model1/models/best_float16.tflite` | `runs/` — training outputs |
| `Model2/models/best.pt` | `.venv/` — Python virtual environments |
| Config files (`configs/data.yaml`) | `.env` — backend keys and QR secret |

Datasets are **intentionally gitignored** (large, downloadable from Roboflow). Pretrained weights for **inference** are committed so you can test on another laptop without retraining.

---

## Choose your path after `git clone`

### Path A — Detection only (recommended for laptop / demo)

Use this when you only want to **run the kiosk webcam** and test accept/reject behavior. **No training, no dataset download.**

**You get:** Model 1 + Model 2 weights already in the repo.

```powershell
git clone https://github.com/khanhtuongnakitomo/GreenGuard26.git
cd GreenGuard26\Trash-detection\Model1

# One-time setup (Python 3.12 + dependencies)
.\setup.ps1

# Optional: copy env template if you need QR/backend integration
copy .env.example .env
# Edit .env — see Model1 README

# Live webcam test
.\.venv\Scripts\activate
python src\test_webcam.py
```

**Controls (demo mode, default):**

| Key | Action |
|---|---|
| `Q` | Quit |
| `F` | Toggle detection on/off |
| `G` | Generate / clear demo QR |

**What to expect:**

| Item | Result |
|---|---|
| PET, cap off + label off | ACCEPTED, counted |
| PET, cap or label visible | REJECT + scores on screen, not counted |
| Can / PP cup | ACCEPTED as before, Model 2 skipped |

**Useful flags:**

```powershell
python src\test_webcam.py --conf 0.65 --model2-conf 0.75 --camera 0
python src\test_webcam.py --no-model2    # disable cap/label check (Model 1 only)
```

**Requirements:** Windows PC with webcam, Python 3.12, `uv` (used by `setup.ps1`). GPU is **not** required for detection-only.

---

### Path B — Retrain Model 2 (cap / label)

Use this when you want to **improve** cap/label detection or train on a new dataset. You must download the dataset yourself.

```powershell
cd GreenGuard26\Trash-detection\Model2

python -m venv .venv
.\.venv\Scripts\activate

uv pip install -r requirements.txt

# IMPORTANT: default PyPI torch is CPU-only — install CUDA build for GPU training
uv pip uninstall torch torchvision
uv pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
python -c "import torch; print(torch.__version__, torch.cuda.is_available())"
# Expect: ...+cu128  True
```

**Download dataset** (not in git):

1. Open [bottle-cap-label-detection on Roboflow Universe](https://universe.roboflow.com/mohammed-essam-iz1ve/bottle-cap-label-detection)
2. Export as **YOLOv8 Oriented Object Detection**
3. Unzip into:

```text
Model2/data/dataset-2/
  train/images  train/labels
  valid/images  valid/labels
  test/images   test/labels
```

**Train:**

```powershell
.\train.ps1
# or: python src\train.py --epochs 50 --batch 16 --device 0
```

Weights are copied to `Model2/models/best.pt`. Then run live test from Model1:

```powershell
cd ..\Model1
python src\test_webcam.py
```

**Preview on test images (no webcam):**

```powershell
cd ..\Model2
python src\predict_folder.py --conf 0.75
# outputs → runs/preview/
```

**If GPU is not available:** `.\train.ps1 -Device cpu` works but is very slow.

**If VRAM is low:** `.\train.ps1 -Batch 8`

**Resume interrupted training:** `.\train.ps1 -Resume`

See [Model2/README.md](Model2/README.md) for full training notes.

---

### Path C — Retrain Model 1 (material types)

Only needed if you are changing material classes or retraining the **can / PET / PP** detector. Most kiosk testing does **not** need this.

1. Prepare a YOLO dataset under `Model1/data/` (not committed)
2. Train from `Model1/`:

```powershell
cd Model1
.\.venv\Scripts\activate
python src\train.py
```

3. Export TFLite if deploying to Pi:

```powershell
python src\export.py
```

See [Model1/README.md](Model1/README.md) and [Model1/docs/](Model1/docs/) for the full Model 1 workflow.

---

## Decision rules (current prototype)

| Model 1 class | Model 2 result | Kiosk action |
|---|---|---|
| `metal_can` | skipped | Accept & count |
| `pp_cup` | skipped | Accept & count |
| `pet_bottle` | no cap, no label (≥ 0.75) | Accept & count · screen: ACCEPT / NO VIOLATION |
| `pet_bottle` | cap and/or label found | Reject, not counted · screen: REJECT / VIOLATION |

**Preparation rule:** users should **remove cap and label** before inserting PET. Model 2 inspects a **crop of the PET box only**. The kiosk UI shows the verdict, not cap/label boxes.

Default thresholds:

- Model 1 material: `--conf 0.65`
- Model 2 cap/label: `--model2-conf 0.75`

---

## Reinforcement learning (live Model 2 improvement)

This is **outcome learning from kiosk use**, not a game-style RL agent. When a user inserts a PET bottle, the kiosk already decided accept or reject. If learning is on, that crop is saved at that moment and can fine-tune Model 2.

1. Copy `Model1/.env.example` to `Model1/.env` if you do not have one.
2. Set:

```text
REINFORCEMENT_LEARNING=on
RL_AUTO_TRAIN=off
RL_SAVE_ACCEPTS=on
RL_MIN_SAMPLES=5
RL_EPOCHS=3
RL_DEVICE=0
```

| Env value | Meaning |
|---|---|
| `REINFORCEMENT_LEARNING=on` | Save PET crops when the kiosk accepts or rejects |
| `REINFORCEMENT_LEARNING=off` | Normal kiosk, no learning |
| `RL_AUTO_TRAIN=on` | After `RL_MIN_SAMPLES` new items, fine-tune Model 2 in a **background process** and reload weights |
| `RL_SAVE_ACCEPTS=on` | Also save prepared bottles (empty labels) so the model sees clean PET |

Rejects store the Model 2 cap/label boxes as YOLO OBB labels on the crop. Accepts store the crop with no objects.

Samples land in `Model2/data/live/` (gitignored). The HUD shows `RL ON`.

**Collect only (safe while demoing):** `REINFORCEMENT_LEARNING=on` and `RL_AUTO_TRAIN=off`.

**Train later yourself:**

```powershell
cd GreenGuard26\Trash-detection\Model2
python src\finetune_live.py --epochs 3 --device 0
```

Then restart `test_webcam.py` (or leave it running with auto-train so it reloads `models/best.pt`).

Training inside the camera loop would freeze the kiosk. Auto-train uses a separate Python process on purpose.

---

## Troubleshooting

### `CUDA GPU not visible` when training Model 2

PyTorch was installed as CPU-only (`torch 2.x+cpu`). Reinstall with the CUDA wheel (see Path B above).

### `Model 2 weights not found` warning on webcam

`Model2/models/best.pt` is missing. Either:

- `git pull` to get the committed weights, or
- Train Model 2 (Path B) and ensure `models/best.pt` exists

Detection still runs with Model 1 only if you pass `--no-model2`.

### OpenCV window does not open

Run `Model1/setup.ps1` — it reinstalls GUI-enabled `opencv-python` and removes the headless conflict.

### Backend / QR errors

Copy `Model1/.env.example` → `Model1/.env` and set `BACKEND_URL`, `MACHINE_API_KEY`, `QR_SECRET` to match your GreenPoint backend. Detection works without the backend; QR generation does not.

### Dataset folder empty after clone

Expected. Datasets are gitignored. Download from Roboflow only if you are **training**, not for detection-only testing.

---

## Quick reference

| Goal | Where to go | Command |
|---|---|---|
| Live laptop demo | `Model1/` | `python src\test_webcam.py` |
| Preview Model 2 on images | `Model2/` | `python src\predict_folder.py` |
| Train Model 2 | `Model2/` | `.\train.ps1` |
| Train Model 1 | `Model1/` | `python src\train.py` |
| Pi / TFLite inference | `Model1/` | `python src\inference_tflite.py` |

---

## License notes

- Model 2 dataset source: [bottle-cap-label-detection](https://universe.roboflow.com/mohammed-essam-iz1ve/bottle-cap-label-detection) (CC BY 4.0)
- Ultralytics YOLO: check [Ultralytics license](https://docs.ultralytics.com/) before commercial deployment
