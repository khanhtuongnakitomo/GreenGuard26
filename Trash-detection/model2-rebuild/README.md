# Model 2 v3 — cap / label / sealant-ring (YOLOv8n-OBB → Jetson Nano B01)

Standalone part detector for GreenGuard. Classes: `0=cap  1=label  2=ring`.
Trains on PC (RTX 3060); deploys as **ONNX FP32 @416** on Jetson Nano B01.

## Dataset verdict (v3 rebuild)

| Source | Used? | Why |
|---|---|---|
| `PET-bottle-with-cap-and-label` | yes | Real cap + label OBB |
| `PET-bottle` | yes | Harvest `1=cap`, `2=label` (drop bottle/liquid) — audit confirmed part boxes |
| `PET-cap-ring` | **no** | Instant auto-label mixes cap and ring → teaches “cap = ring” |
| `water-bottle-with-cap-and-wrapper` | **no** | Audit: bottlecap≈2, wrapper≈5 mostly whole-body |
| `owner-live/` | **required before full train** | Your true ring + webcam/Jetson photos |

**DATA_GAP until you add data:** put a YOLOv8-OBB export under
`..\dataset\sources\owner-live\` with `data.yaml` names `cap/label/ring`, plus
`train/images` + `train/labels` (and ideally `valid/`). Targets from the plan:
≥400 unique true-ring (uncapped, ring on neck) and ≥300 live-camera photos
including bare-bottle negatives (empty label files OK).

## One-command train

**Cap/label-first** (ring data later — class `2=ring` stays in schema, not learned yet):

```powershell
cd D:\Code\Project\bki\Detection-rebuild\model2-rebuild
powershell -ExecutionPolicy Bypass -File scripts\run_model2_training.ps1 -AllowNoRing
```

**Full 3-class** (after true-ring is in `owner-live/`):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_model2_training.ps1
```

Pipeline: normalize → dedupe → grouped split → train (**200 ep**, patience 50,
imgsz **640**, batch 24, seed 42, ~3–3.5 h on 3060) → eval @640 + @416.

Smoke only (proves launcher; does **not** replace the 4h train):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_model2_training.ps1 -Smoke
```

Weights land at `runs\m2v3_seed42_n640\weights\best.pt` (old `m2_seed42_n640`
kept as archive).

## Test on laptop (Model 2 only)

```powershell
cd D:\Code\Project\bki\Detection-rebuild\model2-rebuild
.\run_m2_demo.bat
# options: --fps 10 --conf 0.4 --source video.mp4 --save logs\m2_demo
```

Two-model gate (Model 1 + Model 2): `.\run_gate_demo.bat`

## After training — export for Nano

```powershell
..\model1-rebuild\.venv\Scripts\python.exe scripts\export_onnx.py
```

Copy `export\onnx_416\` to the Nano. See [`jetson/README.md`](jetson/README.md).

## Live 5-case check (PC, after train)

| # | Item | Expected |
|---|---|---|
| 1 | PET with cap (+ label) | detect cap / label |
| 2 | Cap off, ring on neck | detect ring |
| 3 | Bare bottle | no part detections |
| 4 | Empty / hand | no false fire |
| 5 | Odd lighting / distance | still usable |

Gate demo with Model 1 remains available via `run_gate_demo.bat` (M1+M2); Nano
phase is **M2-only**.

## Snapshot demo (no live inference)

`run_m2_demo.bat` runs `scripts/demo_live.py` as a **snapshot compare** tool:
clean camera preview (no model calls), **H** freezes + detects once and shows
ORIGINAL | DETECTED side-by-side (pairs saved to `logs/m2_captures/`),
**H** again = new capture, **Q** quits. `--source photo.jpg` skips preview.
