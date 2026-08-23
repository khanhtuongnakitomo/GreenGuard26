# Model 2 — cap / label / sealant-ring detector (YOLOv8n-OBB, 3 classes)

GreenGuard gating stage: Model 1 (already trained, detects PET bottle) triggers
Model 2 on the bottle crop; Model 2 decides **PET ACCEPT** (none of the three
found) or **PET REJECT** (cap, label, or sealant ring found).

Classes (canonical): `0=cap  1=label  2=ring` — YOLOv8 OBB format.

## Data

- `dataset/incoming/cap-label/dataset-2` — mohammed-essam bottle-cap-label-detection
  v3 (1,558 imgs, CC BY 4.0), OBB: cap + label. **Already in place.**
- `dataset/incoming/ring-dataset/` — owner-downloads from Roboflow
  (**export format: YOLOv8 Oriented Bounding Boxes**, with train/valid/test).
  Mixed box/polygon annotations on Roboflow are normalized to OBB by the export.

## One-command build (after ring data is in place)

```powershell
cd D:\Code\Project\bki\Detection-rebuild\model2-rebuild
powershell -ExecutionPolicy Bypass -File scripts\run_model2_training.ps1
```

Chains: normalize → dedupe (pHash ≤8) → grouped split 70/20/10 → train
(50 epochs, patience 15, cosine LR, batch 24, seed 42 — ~40–60 min on RTX 3060)
→ val eval (targets: cap/label/ring ≥ 0.80 each).

## Validation results (2026-08-23)

Model 2 val (442 imgs): **cap mAP50 0.919 · label 0.951 · ring 0.892** (targets
0.80 — all PASS; overall 0.920). End-to-end gate verified on a held-out ring
frame: M1 bottle 0.91 → GATE ON → M2 ring 0.85 → **PET REJECT**. Close-ups with
no bottle box keep the gate OFF (by design — M1 must confirm PET first).

## Validation workflow for the team

### 1. Automated re-checks (optional, from model2-rebuild/)

```powershell
# per-class metrics on val
..\model1-rebuild\.venv\Scripts\python.exe scripts\eval_val.py
# end-to-end gate on a held-out image (prints verdict, saves annotated frame)
..\model1-rebuild\.venv\Scripts\python.exe scripts\pipeline_demo.py --source dataset\splits\test\images\ring-dataset_23_X002_C172_0929_0_jpg.rf.5f04f6c85e5530fcbe4e32f3a9b4186c.jpg --save logs\gate_test --max-frames 1
```

### 2. Live test matrix (webcam, run_gate_demo.bat)

| # | Item in front of camera | Expected on screen |
|---|---|---|
| 1 | PET bottle WITH cap (and label) | blue bottle box + banner đỏ `PET REJECT — cap ..%, label ..%` |
| 2 | PET bottle, cap removed, RING still on neck | `PET REJECT — ring ..%` |
| 3 | PET bottle completely bare (no cap/label/ring) | `PET ACCEPT` |
| 4 | Aluminum can | green `non-PET` legend, NO banner |
| 5 | Empty frame / hand only | `no bottle in frame` |

Tuning: `--m1-conf` (default 0.5, gate trigger), `--m2-conf` (default 0.5,
REJECT sensitivity), `--fps` (default 5). CPU-only by design.
