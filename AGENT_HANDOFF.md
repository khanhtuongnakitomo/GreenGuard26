# GreenGuard26 — Agent Handoff

**Repo:** `https://github.com/khanhtuongnakitomo/GreenGuard26`  
**Current detection work branch:** `feature/detection-runtime-reorg` (from `main` @ `6dbd33a`)  
**Do not push/commit unless the owner asks.**

## What to run today

| Goal | Path |
|---|---|
| Windows booth demo | `Trash-detection/pc-demo/` (`setup.ps1`, `run_demo.bat`) |
| Jetson Nano B01 deploy | Copy **only** `Trash-detection/jetson-runtime/` to Ubuntu |
| Retrain / export | `Trash-detection/training/model1` and `training/model2` |
| Parity fixtures | `Trash-detection/validation/` |

Root wrappers: `Trash-detection/setup.ps1`, `Trash-detection/run_demo.bat` → `pc-demo/`.

## Locked product behavior (6dbd33a)

```text
frame → M1 det@416 → top-1 (min area 0.02) → crop+10% → cls@224
  → can: show aluminum, skip M2
  → pet: M2 full frame → centers in PET poly → one per class
         warmup 0.5s → vote 4/7 → hold 1.5s → ACCEPT/REJECT
```

No QR, points, backend, counting, or online learning in either runtime.

## Models

Packaged by `Trash-detection/scripts/package_models.py`:

- PC: M1 det 416, cls 224, M2 640
- Jetson: M1 det 416, cls 224, M2 416

OBB layout: `[cx,cy,w,h, class_probs..., angle]` — do not double-sigmoid.
Do not use `training/model2/jetson/infer_obb_onnx.py` (wrong channel order / AABB NMS).

## Jetson constraints

- JetPack **4.6.6**, TensorRT **8.2**, Python **3.6** sources only
- Build engines on-device: `./build_engines.sh`
- TensorRT primary; optional `ORT_WHEEL=...` for ONNX Runtime CPU
- Device checklist: `jetson-runtime/DEVICE_VALIDATION.md`

## Docs

- `Trash-detection/docs/ARCHITECTURE.md`
- `Trash-detection/docs/MODEL_CONTRACT.md`
- `Trash-detection/README.md`

## Out of scope / stale

Older `Model1/` / `Model2/` folders and prior kiosk QR/session docs describe a
different product path. Prefer the detection layout above for CV work.
