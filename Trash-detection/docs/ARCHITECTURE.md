# Architecture

## Runtimes

| Runtime | Role | Inference |
|---|---|---|
| `pc-demo/` | Windows reference / booth PC | Ultralytics YOLO around ONNX (CPU) |
| `jetson-runtime/` | Jetson Nano B01 deployment unit | TensorRT primary, ONNX Runtime CPU optional |
| `training/` | Train / export / research only | Ultralytics + PyTorch |

PC and Jetson do **not** import each other or `training/`. Model files are duplicated
intentionally; `scripts/package_models.py` keeps SHA-256 manifests in sync.

## Pipeline

```text
CameraFrame
  → M1 HBB detector (640 PC / 416 Jetson): metal_can | pet_bottle | pp_cup
  → filter pp_cup, then top-1 visible class (min area ≥ 2% of frame)
  → can: display aluminum, skip M2
  → pet: M2 OBB on full frame
       → keep centers inside smoothed PET polygon
       → one highest-confidence box per class (cap, label, ring)
       → 0.5s warmup → 4-of-7 vote → 1.5s verdict hold
```

## Module split

Shared idea across both runtimes:

- `app.py` — camera loop, CLI, START/PAUSE
- `pipeline.py` — model inference only
- `gate.py` — temporal state (warmup / vote / hold / miss)
- `ui.py` — drawing helpers

Jetson adds:

- `preprocess.py` / `postprocess.py` — letterbox + exact OBB decode
- `backends/` — TensorRT and ONNX Runtime
- `camera.py` — latest-frame queue (size 1)

## Controls

- On-screen START / PAUSE
- `S` / Space start, `P` pause, `Q` quit
- `--source`, `--fps`, `--m1-conf`, `--m2-conf`, `--headless`, `--save`, `--max-frames`

## Deployment note (Jetson)

`jetson-runtime/` is the exact folder copied to Ubuntu. Scripts resolve paths from
their own file location. No symlinks. No Ultralytics/PyTorch on device.
