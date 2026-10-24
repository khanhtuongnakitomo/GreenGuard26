# GreenGuard Trash-detection

Project-wide context: [GreenGuard master context](../GREENGUARD_MASTER_CONTEXT.md).

Windows detection has one runtime under `pc-demo/`. The diagnostic and demo-day
launchers share the same inference and canonical workflow modules. The machine
launcher adds the fixed-camera RVM boundary, while candidate and comparison
launchers remain isolated from production configuration.

## Operator launchers

These are the operator launchers at this directory root:

```powershell
.\demo_model1.bat
.\demo_model1_candidate.bat
.\demo-model1-b.bat
.\compare_model1.bat
.\demo_model2.bat
.\full_demo.bat
.\full_demo_model1_b.bat
.\full-workflow-machine.bat
.\demo-day.bat terminal
.\Demo-day-run.bat
```

`demo_model1.bat`, `demo_model1_candidate.bat`, `demo-model1-b.bat`, and
`demo_model2.bat` start
paused and retain diagnostic camera view, detections, confidence, Run/Pause,
and Switch Camera controls. `demo-model1-b.bat` is a second standalone Model 1
tester that loads the packaged challenger through `m1_candidate.json`; it is
not connected to Model 2, serial output, or the full workflow. `full_demo.bat`
provides the active Model 1 + Model 2 parallel preview. `full_demo_model1_b.bat`
runs the same preview with the visible `CANDIDATE — FAILED PARITY / NOT ACTIVE`
warning. Both preview launchers display results and `SIGNAL 0/1/2 — NOT SENT`;
they never send REST, Dashboard, serial, or hardware output. `compare_model1.bat` shows active
and challenger Model 1 on the same captured frame with independent seven-frame
votes. `S`/Space runs, `P` pauses, `C` switches camera, and `Q`/Esc exits.
Diagnostic launchers do not initialize serial. The candidate launchers display
`CANDIDATE — NOT ACTIVE` and never change the active model.

The parallel preview collects exactly seven synchronized frames. Model 1 needs
four accepted votes; aluminum previews signal `0` and clean PET previews signal
`1`. Any Model 2 threshold hit immediately previews `BAD PET` / signal `2`
without waiting for a Model 1 PET vote. Cap and label use `0.50`; ring uses
`0.30`.

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
M1: exactly 4 confirmations, quorum 4
  aluminum -> ALUMINUM_CAN (canonical internal 0)
  PET -> 0.5 s warmup -> M2: exactly 4 confirmations, quorum 4
       clean -> PET_CLEAN (canonical internal 1)
       defect -> PET_REJECT (canonical internal 2)
```

Missing observations abstain. M2 cap or label confidence at or above `0.50`,
or ring confidence at or above `0.20`, is a defect. Results are held for `1.5`
seconds, then the item must clear for eight consecutive M1 frames before
re-arming. No quorum produces no
command.

The machine transport maps result names only at its final boundary:
`CANS`/`ALUMINUM_CAN` -> raw byte `1`, `GOOD`/`PET_CLEAN` -> raw byte `2`, and
`BAD`/`PET_REJECT` -> raw byte `3`. Serial is 115200 baud, one flushed ASCII
byte, no newline, acknowledgement, retry, or extra bytes. Terminal fallback
writes exactly one line to stdout; diagnostics go to stderr.

## Laptop demo with live dashboard telemetry

`demo-day.bat` is the detection launcher. Start `..\Dashboard\run-dashboard.bat`
first; it starts or reuses the local Dashboard backend and frontend and opens
the live Dashboard. Demo-day then calls `full_demo.bat` with Dashboard
publishing enabled and optionally sends the controller signal through the
terminal or ESP. GreenPoint is not part of this laptop-demo path.

The launcher defaults to the seeded local machine:

```text
DASHBOARD_API_URL=http://127.0.0.1:3003
DASHBOARD_WEB_URL=http://127.0.0.1:8081
DASHBOARD_MACHINE_CODE=0001
```

Set those environment variables before launching when using different local
ports or a different machine code. Dashboard service windows remain visible for
monitoring, with logs copied to `%TEMP%\greenguard-dashboard-local`. Demo-day
checks `/health` before opening the camera and posts exactly one
`/api/dashboard/detections` event for each completed full-demo result:
`ALUMINUM_CAN -> aluminum`, `PET_CLEAN -> pet_clean`, and
`PET_REJECT -> pet_bad`. Aluminum and good-PET confidence use the winning Model
1 average; immediate bad-PET confidence uses the strongest Model 2 hit. Result
hold frames and no-quorum windows produce no extra REST event.

Use `..\Dashboard\run-dashboard.bat repair` if the frontend dependencies are
broken. Demo-day output modes are `demo-day.bat terminal` or
`demo-day.bat esp COM7`; with no mode, the launcher shows a menu. Controller
signals are ASCII `1` for aluminum, `2` for good PET, and `3` for bad PET. ESP
mode requires an explicit port or exactly one USB serial device and fails closed
on communication errors.

The Dashboard stores every detection in MongoDB and groups events for machine
`0001` into one collecting session. Every new item resets a 10-second inactivity
timer. When it expires, the session is closed, point totals are calculated
(`pet_clean=10`, `pet_bad=5`, `aluminum=8`), and a QR payload is generated. The
live Dashboard polls once per second and shows the detection log, grouped item
list, total object count, total points, and QR code. Manual Demo-Day sessions use
GreenPoint points of `pet_clean=10`, `pet_bad=5`, and `aluminum=8`; they are
finalized with `F` and shown with `Q`.

## Boundaries

- `pc-demo/` is the only Windows inference runtime.
- `jetson-runtime/` remains an independent Jetson Nano B01 deployment unit.
- `training/` contains research and candidate exports only.
- `validation/` contains deterministic contracts and parity fixtures.
- `scripts/package_models.py` is the model packaging utility.

Offline tests do not prove physical camera-1, USB, or lower-controller
behavior. Report those checks as `NOT_MEASURED` when hardware is unavailable.
