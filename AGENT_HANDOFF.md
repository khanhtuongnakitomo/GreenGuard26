# GreenGuard26 — Agent Handoff

**Repo:** `https://github.com/khanhtuongnakitomo/GreenGuard26`
**Latest Model 2 line:** v6 in-machine domain (current best). See "Model 2 versions" below.
**Do not push/commit unless the owner asks.**

## What to run today

| Goal | Path |
|---|---|
| Windows booth demo | `Trash-detection/pc-demo/` (`setup.ps1`, `run_demo.bat`) |
| Quick Model 2-only webcam test | `Trash-detection/training/model2/run_m2_demo.bat` |
| Jetson Nano B01 deploy | Copy **only** `Trash-detection/jetson-runtime/` to Ubuntu |
| Retrain / export | `Trash-detection/training/model1` and `training/model2` |
| Parity fixtures | `Trash-detection/validation/` |

Root wrappers: `Trash-detection/setup.ps1`, `Trash-detection/run_demo.bat` → `pc-demo/`.

## Current runtime behavior (verified from source/configuration, September 2026)

```text
frame → single-stage M1 HBB detector → ignore pp_cup → top-1 visible object
  → can: display aluminum, skip M2
  → pet: M2 full frame → centers inside PET polygon → one per class
         warmup 0.5s → vote 4/7 → hold 1.5s → ACCEPT/REJECT
```

PC uses M1 640 with a 0.05 candidate floor and a separate 0.65 decision floor.
The inspected Nano B01 runtime uses M1 416 and a 0.05 inference floor; it does
not yet implement the PC decision-floor check. Treat this as an unresolved
cross-runtime difference, not proof of device parity. See
`Trash-detection/docs/MODEL_CONTRACT.md` before changing thresholds.

Neither runtime includes the older crop/classifier stage. No QR, points,
backend, counting, or online learning is implemented in these two runtimes.
Separate workflow bundles outside this repository have their own contracts.

---

## Model 2 versions (cap / label / ring OBB)

| Ver | Branch | Run | imgsz | Locked-test mAP50 (cap/label/overall) | Notes |
|---|---|---|---|---|---|
| v4 | (merged) | `m2v4_caplabel_seed42_n640` | 640 | 0.778 / 0.923 / 0.752 (val) | old baseline |
| v5 | `feature/m2v5-allangle` | `m2v5_allangle_seed42_n768` | 768 | 0.842 / 0.821 / 0.554 | all-angle/all-light, 150 ep / 6.6h |
| **v6** | `feature/m2v6-inmachine-domain` | `m2v6_inmachine_seed42_n640` | 640 | **0.919 / 0.831 / 0.583** | in-machine domain, 25 ep / 2.1h cap |

Locked test = 222 images, identical for v5 vs v6 (comparison of record). **v6 beats
v5 on every metric in ~1/3 the training time.** v4 backup at
`training/model2/export/onnx_640_v4_backup/` (local, untracked).

### What v6 changed (the point of this chat)

v5 failed on the real booth camera: dark/bright lighting and tilted/off-center
bottles. v6 fixes this by **transferring every training source into the measured
in-machine domain** instead of generic augmentation:

- Reference: 40 frames in `training/model2/dataset/incoming/InMachine/`
  (1280x720). Measured: camera below/side looking up; bottle long axis
  ~**-25.8 deg** (and flipped ~155 deg); cap at upper-right; cool steel light,
  brightness mean 85.6, **no bright/bonus-light frames existed** (had to be
  synthesized).
- `training/model2/scripts/augment_inmachine.py` — OBB-aware `_imNN` variants:
  angle retargeting to {-32,-25,-18,148,155,162} deg, upward keystone, off-center
  placement, 16:9 crop, + dim / **bonus-light overexposure** / veiling glare /
  cool WB / webcam-artifact (JPEG, noise, motion-blur-along-axis) lighting.
  Deterministic, idempotent, `--force`, `--dry-run`. Replaces generic `_aug`.
- Pool: 8,028 originals + 24,917 `_im` = 32,945 → SOURCE_CAP trim → 22,116 →
  dedupe (exact byte-dupes only) → 20,237 → split **train 18,037 / val 2,200
  (VAL_CAP) / test 222 (locked)**. Ring kept in train(30)+val(15).
- `train_m2_v6.py` — fine-tune from v5 best.pt, `workers=0` (Windows dataloader
  deadlock fix), `time=2.1` hard cap, `cache="disk"`, `multi_scale=False`,
  batch 24, lighter in-train aug (offline pass carries the domain). `--resume` OK.
- `watch_training.py` — 5-min reports + crash/hang/stall watchdog (vs the v5 hang).
- `run_m2_v6_training.ps1` — one-command pipeline (`-Smoke` for sanity).

### Models (current production = v6)

Packaged by `Trash-detection/scripts/package_models.py`:

- PC (`pc-demo/models`): M1 HBB det 640, **M2 v6 640** (`m2_obb_640.onnx`)
- Jetson (`jetson-runtime/models`): M1 HBB det 416, **M2 v6 416** (`m2_obb_416.onnx`)
- Training exports: `training/model2/export/onnx_{640,416,768}/model.onnx` (v6)

OBB layout: `[cx,cy,w,h, class_probs..., angle]` — do not double-sigmoid.
Do not use `training/model2/jetson/infer_obb_onnx.py` (wrong channel order / AABB NMS).

## Branches

V6 is merged into `main`. Check `git status` and `git branch -vv` for current
branch state; do not infer active or existing branches from this handoff.

## Jetson constraints

- JetPack **4.6.6**, TensorRT **8.2**, Python **3.6** sources only (Nano **B01**).
- Build engines on-device: `./build_engines.sh`
- TensorRT primary; optional `ORT_WHEEL=...` for ONNX Runtime CPU
- Device checklist: `jetson-runtime/DEVICE_VALIDATION.md`
- **Open task (deferred, needs owner go-ahead):** port `jetson-runtime` to
  **Orin Nano 8GB / JetPack 6 / TensorRT 10**. Current runtime scripts are
  B01-oriented; the v6 ONNX runs, but the scripts target JP4.6.6.

## Docs

Start with `DOCUMENTATION.md`. It defines the current reading order, component
documents, and historical material that must not be treated as active guidance.

## Out of scope / stale

Older `Model1/` / `Model2/` folders and prior kiosk QR/session docs describe a
different product path. Prefer the detection layout above for CV work.
