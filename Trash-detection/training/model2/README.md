# Model 2 rebuild — cap / label / sealant-ring (YOLOv8n-OBB)

> **Current line: V6 in-machine domain.** The older v3/v4 rebuild material in
> this file is retained only as historical reference. For the current training
> workflow, use `scripts/run_m2_v6_training.ps1`; do not use
> `run_model2_training.ps1` or `run_model2_rebuild_training.ps1` for V6 work.

## Current V6 Workflow

From `Trash-detection/training/model2/` on the GPU training machine:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_m2_v6_training.ps1 -Smoke
powershell -ExecutionPolicy Bypass -File scripts\run_m2_v6_training.ps1
```

V6 fine-tunes from the local V5 checkpoint when available, trains YOLO11s-OBB
at 640 with a 2.1-hour cap, and exports candidates only. It preserves the
locked 222-image test set, uses grouped splits, keeps `workers=0` for Windows
dataloader reliability, and watches for stalls. Review the candidate against
the locked test before any manual promotion. See `../../../DOCUMENTATION.md`
for the project-wide documentation map.

Part detector for **PET bottles only**. Classes:

| ID | Name | Color in demo |
|---|---|---|
| 0 | cap | red |
| 1 | label | yellow |
| 2 | ring | magenta |

Trains on PC (GPU); deploys as **ONNX FP32** (`@640` PC, `@416` Jetson Nano B01).

---

## Install (from scratch)

Model 2 demos share the **Model 1** virtual environment:

```powershell
cd GreenGuard26\Trash-detection\training/model1
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

No separate venv needed in `training/model2/`.

---

## Demo — Model 2 only

```powershell
cd GreenGuard26\Trash-detection\training/model2
.\run_m2_demo.bat
```

```powershell
.\run_m2_demo.bat --fps 10 --conf 0.4
.\run_m2_demo.bat --source video.mp4 --save logs\m2_demo
.\run_m2_demo.bat --source path\to\image.jpg
```

| Key | Action |
|---|---|
| `Q` | Quit |
| `S` | Snapshot |

Auto-picks model (first found):

1. `export/onnx_640/model.onnx` (PC)
2. `export/onnx_416/model.onnx` (Jetson size)
3. `runs/m2v3_seed42_n640/weights/best.pt`

---

## Demo — Full gate (Model 1 + Model 2)

```powershell
cd GreenGuard26\Trash-detection\training/model2
.\run_gate_demo.bat
```

```powershell
.\run_gate_demo.bat --m1-conf 0.05 --m2-conf 0.5
.\run_gate_demo.bat --save logs\gate_out --max-frames 30
```

**Logic:**

- Model 1 (two-stage): PET vs aluminum on one object in frame.
- If **PET** → Model 2 runs on the **full frame**; only detections whose center
  lies inside the bottle polygon count.
- Any cap/label/ring ≥ `--m2-conf` → **PET REJECT** (4-of-7 frame vote).
- **Aluminum** → box drawn, gate off.

| Flag | Default | Meaning |
|---|---|---|
| `--m1-conf` | `0.05` | M1 detector localization |
| `--m2-conf` | `0.5` | Part confidence for reject |
| `--no-m1-cls` | off | Legacy M1 detector classes |
| `--fps` | `5` | Target FPS |

---

## Committed artifacts

| File | Use |
|---|---|
| `export/onnx_640/model.onnx` | PC demo / gate |
| `export/onnx_416/model.onnx` | Jetson Nano deploy |
| `runs/m2v6_inmachine_seed42_n640/weights/best.pt` | Local V6 training checkpoint |

Labels: `export/onnx_*/labels.txt` → `cap`, `label`, `ring`.

---

## Historical V4 Retrain Procedure (Do Not Use For V6)

Dataset lives under `Detection-rebuild/dataset/` on the training workstation
(not fully in Git). On a machine with sources prepared:

**Cap/label-first** (ring class in schema, not learned until you add ring data):

```powershell
cd GreenGuard26\Trash-detection\training/model2
powershell -ExecutionPolicy Bypass -File scripts\run_model2_training.ps1 -AllowNoRing
```

**Full 3-class** (after true-ring data in `owner-live/`):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_model2_training.ps1
```

**Smoke** (1 epoch, ~5 min):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_model2_training.ps1 -Smoke -AllowNoRing
```

Training: 200 epochs, patience 50, imgsz 640, batch 24, seed 42 (~3–4 h on RTX 3060).

Weights: `runs/m2v3_seed42_n640/weights/best.pt`

### Export after training

```powershell
..\training/model1\.venv\Scripts\python.exe scripts\export_onnx.py
..\training/model1\.venv\Scripts\python.exe scripts\export_onnx.py --imgsz 640
..\training/model1\.venv\Scripts\python.exe scripts\export_onnx.py --imgsz 416
```

Copy `export/onnx_416/` to the Nano. See [jetson/README.md](jetson/README.md).

### Eval

```powershell
..\training/model1\.venv\Scripts\python.exe scripts\eval_deploy_size.py
```

`PASS_WITH_GAP` for missing ring class is expected during cap/label-first training.

---

## Live check (5 cases)

| # | Item | Expected |
|---|---|---|
| 1 | PET with cap (+ label) | Detect cap / label |
| 2 | Cap off, ring on neck | Detect ring (when ring-trained) |
| 3 | Bare bottle | No parts |
| 4 | Empty frame / hand | No false fire |
| 5 | Odd lighting / distance | Still usable |

---

## Dataset notes (v4 — 2026-08-26)

| Source | Used? | Notes |
|---|---|---|
| `PET-bottle-with-cap-and-label` | yes | cap + label |
| `PET-bottle` | yes | cap/label rows |
| `Bottle-label` | yes | label only |
| `Bottle-lying` | yes | cap only |
| `owner-live-old/` | yes | legacy booth captures, cap/label |
| `owner-live/` | yes | **new 2026-08-25 webcam set — first real ring OBB** |
| `PET-cap-ring` | **no** | mixed cap/ring auto-labels |

`owner-live/` is offline-augmented by `scripts/augment_owner_live.py`
(8 geometric + 4 photometric deterministic variants, `_augNN` suffix).
Dedupe keeps augmented siblings (exact cross-source dupes only); grouped split
keeps a photo + its variants in the same split. Ring is still scarce (2 unique
shots) so `test/` is cap/label-only until more ring is captured.

---

## Historical M2-Only Jetson Notes (Do Not Use)

Standalone M2 inference without Ultralytics:

```text
jetson/infer_obb_onnx.py
jetson/README.md
```

Target: ONNX FP32 @416, `onnxruntime` CPU on Nano.

---

## Historical Rebuild Troubleshooting

| Problem | Fix |
|---|---|
| `STALE EXPORT - skipping` | Re-run `scripts/export_onnx.py` from current `best.pt` |
| Low FPS | CPU demo is slow by design; reduce `--fps` or use GPU machine for dev only |
| No ring detections | Expected if trained with `-AllowNoRing`; add ring data and retrain |
| Gate never shows REJECT | Lower `--m2-conf 0.4` or check M1 is calling PET (not aluminum) |

## Historical Training Script Notes (Do Not Use For V6)

**Historical training entry point:**
```powershell
powershell -ExecutionPolicy Bypass -File scriptsun_model2_rebuild_training.ps1
```
Fine-tune from `runs/m2v3_seed42_n640/weights/best.pt` (100 epochs, deg 90,
lr0 0.001) -> `runs/m2_orient_seed42_n640/`. Pipeline: preflight (GPU required)
-> normalize/dedupe/appearance-sim/split -> audits + **ring gate** (hard-stops
if class 2 ring is missing from any split) -> eval sets -> smoke -> fine-tune
-> gate compare -> export ONNX only on PASS. Flags: `-Smoke` (validate only),
`-EvalOnly` (re-eval existing weights).

`run_model2_training.ps1` is the OLD full-train script (200 epochs from
`yolov8n-obb.pt`, with `-AllowNoRing`). Keep for reference / full retrains only.

Data comes from `..\dataset\sources\` (shared folder at Trash-detection
level). Verified ring data (owner-live) is mandatory before the rebuild passes
stage 3.
