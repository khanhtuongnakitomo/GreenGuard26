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
  → filter pp_cup, then top-1 visible class (min area ≥ 2% of frame,
       PC decision confidence ≥ 0.65; see MODEL_CONTRACT.md for the Jetson difference)
  → shared ExactWindowVoter collects exactly 7 M1 observations
       → ≥4 aluminum: final signal 0; Model 2 is skipped
       → ≥4 PET: 0.5s warmup, then Model 2 starts
  → M2 OBB on the full frame
       → keep centers inside the tracked/smoothed PET polygon
       → one highest-confidence box per class (cap, label, ring)
       → exactly 7 M2 observations: ≥4 clean => signal 1, ≥4 violation => signal 2
  → no quorum emits no signal; one stdout line max per item; 8 clear frames re-arm
```

## Module split

Shared idea across both runtimes:

- `app.py` — camera loop, CLI, START/PAUSE
- `pipeline.py` — model inference only
- `gate.py` — inference result types and model-only temporal helpers
- `decision_core.py` — canonical exact 7/4 M1+M2 workflow shared by PC full
  mode and the Windows detection shell
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

## Windows detection boundary

`windows-demo/` is a detection-only shell around the same
`pc-demo/src/decision_core.py` state machine. It emits exactly one flushed ASCII
stdout line (`0`, `1`, or `2`) on the exact result frame and sends diagnostics
to stderr. It contains no machine communication, firmware, acknowledgements,
emergency controls, reset, motor sequencing, or control configuration. A
separate mechanical codebase owns all physical routing and safety behavior.
