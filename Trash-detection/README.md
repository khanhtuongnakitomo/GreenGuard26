# GreenGuard Trash-detection

Windows detection has one runtime under `pc-demo/`. The diagnostic launchers
share the same inference modules. The fixed-camera launcher adds the RVM
machine boundary, while the candidate and comparison launchers remain
isolated from production configuration.

## Operator launchers

These are the only operator launchers at this directory root:

```powershell
.\demo_model1.bat
.\demo_model1_candidate.bat
.\demo-model1-b.bat
.\compare_model1.bat
.\demo_model2.bat
.\full_demo.bat
.\full-workflow-machine.bat
```

`demo_model1.bat`, `demo_model1_candidate.bat`, `demo-model1-b.bat`, and
`demo_model2.bat` start
paused and retain diagnostic camera view, detections, confidence, Run/Pause,
and Switch Camera controls. `demo-model1-b.bat` is a second standalone Model 1
tester that loads the packaged challenger through `m1_candidate.json`; it is
not connected to Model 2, serial output, or the full workflow. `full_demo.bat`
provides the complete diagnostic workflow. `compare_model1.bat` shows active
and challenger Model 1 on the same captured frame with independent seven-frame
votes. `S`/Space runs, `P` pauses, `C` switches camera, and `Q`/Esc exits.
Diagnostic launchers do not initialize serial. The candidate launchers display
`CANDIDATE — NOT ACTIVE` and never change the active model.

The candidate package is produced by the machine-domain fine-tune runner. Its
long run is deliberately separate from the active runtime:

```powershell
powershell -ExecutionPolicy Bypass -File .\training\model1\scripts\run_m1_machine_efficient_finetune.ps1 `
  -RunId m1efficientft_20260909_seed42_r1 -WallMinutes 480 -TargetMinutes 420 `
  -PackageCandidate -Publish
```

The run targets seven hours and has an eight-hour hard limit, including a
protected verification and publication tail. Generated datasets, checkpoints,
caches, and full logs remain local; only the compact candidate package and
report are publishable.

The machine launcher opens camera `1` only and starts in `WAITING TO START`.
Its UI contains only the live camera, state/result, and Run/Pause. It accepts no
source or camera-switch option. Configure an explicit COM port in
`pc-demo/config/default.json`; otherwise one USB serial device is required and
zero/multiple devices use terminal fallback.

## Setup

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

Setup installs the PC requirements, verifies packaged models, runs tests, and
performs an offline one-frame fixture smoke test.

## Runtime contract

```text
M1: exactly 7 observations, quorum 4
  aluminum -> ALUMINUM_CAN (canonical internal 0)
  PET -> 0.5 s warmup -> M2: exactly 7 observations, quorum 4
       clean -> PET_CLEAN (canonical internal 1)
       defect -> PET_REJECT (canonical internal 2)
```

Missing observations abstain. M2 cap, label, or ring confidence at or above
`0.50` is a defect. Results are held for `1.5` seconds, then the item must
clear for eight consecutive M1 frames before re-arming. No quorum produces no
command.

The machine transport maps result names only at its final boundary:
`CANS`/`ALUMINUM_CAN` -> raw byte `1`, `GOOD`/`PET_CLEAN` -> raw byte `2`, and
`BAD`/`PET_REJECT` -> raw byte `3`. Serial is 115200 baud, one flushed ASCII
byte, no newline, acknowledgement, retry, or extra bytes. Terminal fallback
writes exactly one line to stdout; diagnostics go to stderr.

## Boundaries

- `pc-demo/` is the only Windows inference runtime.
- `jetson-runtime/` remains an independent Jetson Nano B01 deployment unit.
- `training/` contains research and candidate exports only.
- `validation/` contains deterministic contracts and parity fixtures.
- `scripts/package_models.py` is the model packaging utility.

Offline tests do not prove physical camera-1, USB, or lower-controller
behavior. Report those checks as `NOT_MEASURED` when hardware is unavailable.
