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

The `--mode` values are `model1`, `model2`, and `full`. The active Model 1
detector has two classes: aluminum beverage can and PET bottle. It uses a low
inference floor (`0.05`) to retain candidates, then requires `0.84` confidence
after area filtering before the candidate enters the workflow.

Useful flags: `--headless`, `--save <dir>`, `--max-frames N`, `--m1-conf`, `--m2-conf`,
`--fps`. `--m1-conf` overrides the inference floor only; it does not lower the
decision floor in the locked config.

`m1-conf` is the candidate-generation floor. The public M1 decision floor is
configured independently as `m1.detector.decision_conf` (0.84 for the currently
activated candidate). Unknown classes are filtered before top-1 selection.

For camera evidence, run the repository launcher
`..\diagnose_model1_rvm.bat`. It writes immutable session directories under
`validation/rvm-sessions/` (when requested), and records raw detections,
rejection reasons, camera metadata, model/config hashes, and separate
original/overlay frames. Use `src\analyze_m1_rvm.py` to sweep thresholds; the
analyzer never rewrites production configuration.

## Layout

- `config/default.json` — locked gate defaults
- `models/` — ONNX + `manifest.json`
- `src/app.py` — entrypoint
- `src/pipeline.py` — Ultralytics M1/M2
- `src/gate.py` — model result types and model-only helpers
- `src/decision_core.py` — canonical exact-seven observation workflow shared by
  the PC full mode and the Windows RVM shell
- `src/ui.py` — OpenCV overlays

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

Full mode uses exactly seven Model 1 observations. Four aluminum observations
emit signal `0`; four PET observations enter the existing Model 2 warmup and
then exactly seven quality observations. Four clean observations emit `1`, and
four violation observations emit `2`. Missing/unknown observations abstain.
The final signal is emitted once per item and eight clear frames are required
before re-arming. Physical-machine control is outside this repository.
