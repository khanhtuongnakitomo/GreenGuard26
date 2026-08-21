# GreenGuard Model 2 — PET inspection (cap / label / liquid)

Model 2 inspects a PET bottle after Model 1 classifies it. If a **cap**, **label**, or **liquid/water** is still visible, the kiosk **rejects** the item and does not count it. A PET bottle is accepted only when none of those three are found. The `bottle` class is detected for context and does **not** cause a reject.

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

Default dataset is `data/dataset-3`. Point `-Dataset` at any later folder:

```powershell
cd GreenGuard26\Trash-detection\Model2
.\train.ps1
.\train.ps1 -Dataset dataset-3
.\train.ps1 -Dataset data\dataset-3
.\train.ps1 -Dataset D:\datasets\pet-v4
```

Equivalent Python:

```powershell
python src\train.py --dataset data/dataset-3 --epochs 50 --batch 16 --imgsz 640 --device 0
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

`train.py` rewrites `configs/data.yaml` from the chosen folder's `data.yaml` (class names + train/valid/test paths).

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
python src\run_model2.py --source data\dataset-3\test\images
python src\run_model2.py --source path\to\bottle.jpg
```

## Check the model on dataset images

```powershell
python src\predict_folder.py --conf 0.5
```

Overlays land in `runs/preview/`. ACCEPT means no cap, no label, and no liquid were found. REJECT means at least one of those three was found.

## Live kiosk window (after training)

```powershell
cd GreenGuard26\Trash-detection\Model1
.\.venv\Scripts\python.exe src\test_webcam.py
```

PET with cap, label, or liquid → red REJECT. Clean empty PET, cans, and PP cups follow the existing accept path.

## Dataset

Put YOLO OBB exports under `data/`. Current default:

```text
data/dataset-3/   ← bottle, cap, label, liquid (YOLOv8 OBB)
data/dataset-2/   ← older cap + label set; still usable via -Dataset dataset-2
```

Each dataset folder needs `data.yaml` plus `train/images`, `valid/images` (or `val/images`), and matching label files.

## Live learning from the kiosk

When `REINFORCEMENT_LEARNING=on` in `Model1/.env`, PET accept/reject crops are written to `data/live/`. Fine-tune from them:

```powershell
python src\finetune_live.py --epochs 3 --device 0
```

That updates `models/best.pt`. See the Trash-detection root README for env flags.
