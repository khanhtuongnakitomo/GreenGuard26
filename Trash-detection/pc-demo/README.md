# GreenGuard PC runtime

This is the only Windows inference runtime. It contains the ONNX-backed Model
1 and Model 2 pipelines, shared `CanonicalWorkflow`, diagnostic UI, and the
fixed-camera machine adapter.

## Setup

```powershell
cd Trash-detection\pc-demo
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

The environment requires Ultralytics, OpenCV, ONNX Runtime, PyTorch, and
`pyserial>=3.5,<4`. Packaged models are checked against `models/manifest.json`.

## Diagnostic modes

From `Trash-detection/`, run:

```powershell
.\demo_model1.bat
.\demo_model1_candidate.bat
.\demo-model1-b.bat
.\compare_model1.bat
.\demo_model2.bat
.\full_demo.bat
```

These modes start paused. They show the diagnostic camera view, accepted
detections, confidence, and Run/Pause/Switch Camera controls. The candidate
launcher and `demo-model1-b.bat` load only `config/m1_candidate.json` and show
`CANDIDATE — NOT ACTIVE`. `demo-model1-b.bat` is a standalone second Model 1
tester; it does not construct Model 2 or enter the full workflow. The
comparison launcher sends each captured frame to both M1 models and keeps
independent seven-observation votes. Keys are
`S`/Space to run, `P` to pause, `C` to switch camera, and `Q`/Esc to exit.
The Model 1-only launchers and comparison launcher never construct Model 2 or a
serial transport. Existing `demo_model1.bat` continues to load the active
manifest and active Model 1.

Full mode uses the shared workflow: exactly seven M1 observations, 4/7
material quorum, PET-only Model 2 after a 0.5-second warmup, exactly seven M2
observations, 4/7 quality quorum, 1.5-second result hold, and eight clear
frames to re-arm. M1 candidate generation is configured separately from the
decision floor; do not use ad-hoc threshold overrides as a production policy.

## Fixed-camera machine mode

```powershell
.\full-workflow-machine.bat
```

`src/machine_app.py` opens camera index `1` only and fails closed with
`CAMERA 1 REQUIRED` if it cannot read that camera. It starts with detection
off. The machine UI contains only the live frame, state/result, and Run/Pause;
it never draws detection geometry, confidence, frame rate, counters, legends,
camera selection, or serial diagnostics.

`src/machine_workflow.py` wraps the shared canonical workflow and exposes one
result-name event per physical item. `src/serial_transport.py` rechecks the
configured COM port or unique USB serial device during idle and again at a
result. A serial write is one raw byte followed by flush. A failed write closes
the port and writes that result once to terminal output; it never retries.
Terminal fallback writes exactly one line (`1`, `2`, or `3`) to stdout and all
diagnostics go to stderr.

Machine policy: four aluminum observations produce `CANS`; four PET
observations enter the warmup and M2 window; cap/label/ring at least `0.50` is
bad; missing M1/M2 is abstention; four bad produces `BAD`; four clean produces
`GOOD`; and no quorum produces no command. The result is held for 1.5 seconds,
then removal and eight clear frames are required.

Configure the machine boundary in `config/default.json`:

```json
"machine": {
  "camera_index": 1,
  "serial": { "port": null, "baudrate": 115200 }
}
```

## Layout and tests

- `src/app.py` — diagnostic Model 1, Model 2, and full runtime
- `src/pipeline.py` — ONNX inference adapters
- `src/decision_core.py` — shared exact-window workflow
- `src/machine_app.py` — fixed-camera entrypoint
- `src/machine_workflow.py` — lifecycle and result-name boundary
- `src/machine_ui.py` — redacted machine renderer
- `src/serial_transport.py` — one-byte serial/terminal transport
- `src/ui.py` — diagnostic overlays and controls
- `src/compare_model1.py` — same-frame active/challenger Model 1 comparison

The candidate package is intentionally separate from `models/manifest.json`:
`models/m1_candidate_manifest.json` and `models/candidates/m1_efficient_current.onnx`
are used only by the candidate launcher. A structurally valid candidate still
requires fresh camera validation before promotion and is never activated by
the fine-tune runner.

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

Offline tests do not prove physical camera-1 or USB-controller behavior.
