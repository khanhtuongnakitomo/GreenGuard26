# GreenGuard PC demo

Windows Ultralytics reference runtime. Independent of `training/` and
`jetson-runtime/`.

## Setup

```powershell
cd Trash-detection\pc-demo
powershell -ExecutionPolicy Bypass -File setup.ps1
```

Creates `.venv`, installs `requirements.txt`, packages ONNX via
`..\scripts\package_models.py --target pc`, runs pytest, and a one-frame headless
smoke test.

Or from `Trash-detection/`:

```powershell
powershell -ExecutionPolicy Bypass -File setup.ps1
```

## Run

The supported launchers are at the `Trash-detection/` root:

```powershell
.\demo_model1.bat --source 0 --auto-start
.\demo_model2.bat --source 0 --auto-start
.\full_demo.bat --source 0 --auto-start
```

The `--mode` values are `model1`, `model2`, and `full`. Model 1 is a single
three-class detector; PP cup is filtered and never shown. Model 1 uses a low
inference floor (`0.05`) to retain candidates, then requires `0.65` confidence
after visibility and area filtering before the candidate enters the workflow.

Useful flags: `--headless`, `--save <dir>`, `--max-frames N`, `--m1-conf`, `--m2-conf`,
`--fps`. `--m1-conf` overrides the inference floor only; it does not lower the
decision floor in the locked config.

## Layout

- `config/default.json` — locked gate defaults
- `models/` — ONNX + `manifest.json`
- `src/app.py` — entrypoint
- `src/pipeline.py` — Ultralytics M1/M2
- `src/gate.py` — temporal PET gate
- `src/ui.py` — OpenCV overlays

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```
