# Model 2 rebuild — cap / label / sealant-ring (YOLOv8n-OBB)

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
cd GreenGuard26\Trash-detection\model1-rebuild
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

No separate venv needed in `model2-rebuild/`.

---

## Demo — Model 2 only

```powershell
cd GreenGuard26\Trash-detection\model2-rebuild
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
cd GreenGuard26\Trash-detection\model2-rebuild
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
- Any cap/label/ring ≥ `--m2-conf` → **PET REJECT** (3-of-5 frame vote).
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
| `runs/m2v3_seed42_n640/weights/best.pt` | PyTorch reference weights |

Labels: `export/onnx_*/labels.txt` → `cap`, `label`, `ring`.

---

## Retrain (optional)

Dataset lives under `Detection-rebuild/dataset/` on the training workstation
(not fully in Git). On a machine with sources prepared:

**Cap/label-first** (ring class in schema, not learned until you add ring data):

```powershell
cd GreenGuard26\Trash-detection\model2-rebuild
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
..\model1-rebuild\.venv\Scripts\python.exe scripts\export_onnx.py
..\model1-rebuild\.venv\Scripts\python.exe scripts\export_onnx.py --imgsz 640
..\model1-rebuild\.venv\Scripts\python.exe scripts\export_onnx.py --imgsz 416
```

Copy `export/onnx_416/` to the Nano. See [jetson/README.md](jetson/README.md).

### Eval

```powershell
..\model1-rebuild\.venv\Scripts\python.exe scripts\eval_deploy_size.py
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

## Dataset notes (v3)

| Source | Used? |
|---|---|
| `PET-bottle-with-cap-and-label` | yes |
| `PET-bottle` | yes (cap/label rows) |
| `PET-cap-ring` | **no** (mixed cap/ring labels) |
| `owner-live/` | add for ring + webcam domain |

---

## Jetson Nano B01

Standalone M2 inference without Ultralytics:

```text
jetson/infer_obb_onnx.py
jetson/README.md
```

Target: ONNX FP32 @416, `onnxruntime` CPU on Nano.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `STALE EXPORT - skipping` | Re-run `scripts/export_onnx.py` from current `best.pt` |
| Low FPS | CPU demo is slow by design; reduce `--fps` or use GPU machine for dev only |
| No ring detections | Expected if trained with `-AllowNoRing`; add ring data and retrain |
| Gate never shows REJECT | Lower `--m2-conf 0.4` or check M1 is calling PET (not aluminum) |

## Training (which script to use)

**Current training entry point:**
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
