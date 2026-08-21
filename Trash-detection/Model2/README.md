# GreenGuard Model 2 — Cap / Label Detection

Model 2 inspects a PET bottle after Model 1 classifies it. If a **cap** or **label** is still visible, the kiosk **rejects** the item and does not count it.

This folder contains the dataset, training script, and inference code. Model 1's webcam loop loads `models/best.pt` after you train.

## Install PyTorch with CUDA first

`uv pip install -r requirements.txt` does **not** give you a GPU build of PyTorch. The default wheel is `torch==...+cpu`, which is why `train.ps1` reports "CUDA GPU not visible" even if you have an NVIDIA card.

In the Model2 venv:

```powershell
uv pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
python -c "import torch; print(torch.__version__, torch.cuda.is_available())"
```

You want something like `2.x.x+cu128` and `True`. Then train.

## Train on this PC (do this yourself)

Training YOLO on GPU takes a while. Run it in a normal terminal, not through the Cursor agent, so the chat stays usable.

```powershell
cd d:\Code\Project\bki\GreenGuard26\Trash-detection\Model2
.\train.ps1
```

Equivalent Python:

```powershell
cd d:\Code\Project\bki\GreenGuard26\Trash-detection\Model2
# Prefer Model1's existing venv if you already set it up
..\Model1\.venv\Scripts\python.exe src\train.py --epochs 50 --batch 16 --imgsz 640 --device 0
```

If GPU memory runs out, lower the batch size:

```powershell
.\train.ps1 -Batch 8
```

Resume an interrupted run:

```powershell
.\train.ps1 -Resume
```

When it finishes, weights are copied to:

```text
Model2/models/best.pt
```

## Run Model 2 only (no Model 1)

Live window on the webcam. Model 2 sees the **full frame** — no PET crop, no kiosk session.

```powershell
cd GreenGuard26\Trash-detection\Model2
.\run.ps1
# or: python src\run_model2.py --source 0 --conf 0.5
```

`Q` quit, `S` snapshot, `SPACE` pause. Boxes below `--conf` are drawn thin and marked `(below)` so you can see near-misses.

Image, folder, or video:

```powershell
python src\run_model2.py --source data\dataset-2\test\images
python src\run_model2.py --source path\to\bottle.jpg
```

## Check the model on dataset images

```powershell
..\Model1\.venv\Scripts\python.exe src\predict_folder.py --conf 0.5
```

Overlays land in `runs/preview/`. ACCEPT means no cap and no label were found. REJECT means at least one was found.

## Live kiosk window (after training)

```powershell
cd d:\Code\Project\bki\GreenGuard26\Trash-detection\Model1
.\.venv\Scripts\python.exe src\test_webcam.py
```

PET with cap or label → red REJECT and the detected scores. Clean PET, cans, and PP cups follow the existing accept path.

## Dataset

Training uses `data/dataset-2` (YOLO OBB, classes `cap` and `label`). `data/dataset-1` is an unfinished classifier set and is not used.

## Live learning from the kiosk

When `REINFORCEMENT_LEARNING=on` in `Model1/.env`, PET accept/reject crops are written to `data/live/`. Fine-tune from them:

```powershell
python src\finetune_live.py --epochs 3 --device 0
```

That updates `models/best.pt`. See the Trash-detection root README for env flags.
