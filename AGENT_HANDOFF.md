# GreenGuard26 agent handoff

## Current Windows entrypoints

The only operator BAT launchers at `Trash-detection/` are:

| Launcher | Purpose |
|---|---|
| `demo_model1.bat` | paused diagnostic Model 1 view |
| `demo_model2.bat` | paused diagnostic Model 2 view |
| `full_demo.bat` | paused diagnostic M1 -> M2 view |
| `full-workflow-machine.bat` | fixed-camera machine workflow |

The first three call `pc-demo/src/app.py` and have Run/Pause/Switch Camera plus
diagnostic overlays. The machine launcher calls `pc-demo/src/machine_app.py`,
uses camera 1 only, starts with `WAITING TO START`, and has no diagnostic
overlays or camera switch.

## Active workflow

```text
camera -> M1 -> exactly 7 observations / quorum 4
  aluminum -> CANS
  PET -> 0.5 s warmup -> M2 -> exactly 7 observations / quorum 4
       cap/label/ring >= 0.50 -> bad; missing -> abstain
       4 bad -> BAD; 4 clean -> GOOD; no quorum -> no command
result held 1.5 s -> REMOVE OBJECT -> 8 clear M1 frames -> re-arm
```

Canonical internal result values remain 0/1/2. Only the machine transport maps
result names to raw bytes: CANS/ALUMINUM_CAN `1`, GOOD/PET_CLEAN `2`, and
BAD/PET_REJECT `3`. Serial is 115200, one byte, flush, no newline, ACK, retry,
or extra command data. Explicit COM configuration wins; otherwise exactly one
USB serial device is required and zero/multiple devices use terminal fallback.

Pause stops inference. An unfinished vote is invalidated; if an item had
started, resume requires the item to clear. A result already sent remains held
until removal. Camera failure is fail-closed and cannot infer or command.

## Verification boundaries

Run from `Trash-detection/pc-demo`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

The five known active Model 1 parity/filter failures are retained as explicit
known failures; do not weaken, skip, regenerate, or rewrite them. New machine,
launcher, transport, UI, and M2/Jetson-preservation checks must pass. Offline
tests do not prove physical camera-1 or USB-controller behavior; report those
checks as `NOT_MEASURED` when hardware is unavailable.

`jetson-runtime/` and the training trees remain independent. Do not change
training data, candidate models, or the external
`D:\Code\Project\bki\RVM-Full-Workflow-Demo` as part of Windows runtime work.
