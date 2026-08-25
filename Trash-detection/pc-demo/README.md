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

```powershell
.\run_demo.bat --source 0
# or
.\run_demo.ps1 --source 0 --auto-start
```

Useful flags: `--headless`, `--save <dir>`, `--max-frames N`, `--m1-conf`, `--m2-conf`,
`--fps`.

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
