# GreenGuard Windows detection demo

This source-checkout Windows shell is a strict detection producer around the
canonical `pc-demo/src` Model 1, Model 2, and decision workflow. It has no
machine-control capability. The builder copies only detection runtime files,
locked ONNX artifacts, labels, configuration, launchers, checks, and docs.

## Decision contract

The full workflow consumes exactly seven Model 1 observations and requires a
4/7 quorum. Aluminum emits `0`; PET enters Model 2 after the configured warmup.
Model 2 then consumes exactly seven good/bad/abstain observations, where good
emits `1` and bad emits `2`. PP, unknown, and missing observations abstain. A
no-quorum window emits nothing. One result is emitted per item and eight clear
frames are required before re-arming.

`WorkflowStep.signal` is `None` except on the exact decision frame. The demo
writes exactly one flushed ASCII stdout line (`0`, `1`, or `2`) per result.
Diagnostics are written to stderr after startup so stdout is safe for a
line-oriented consumer.

## Build and run

The portable profile requires staged Python 3.11 x64 and offline wheels under
`portable-runtime/`; it never downloads during a build:

```powershell
python scripts\build_windows_demo.py build --profile portable --zip
python scripts\build_windows_demo.py check --require-offline
python scripts\build_windows_demo.py headless-smoke
```

The explicit development fallback is:

```powershell
python scripts\build_windows_demo.py build --profile online-source --allow-dirty
```

Run from this source folder with `run_demo.bat --source 0`, or pass a quoted
video-file path. `--headless` sends frame status to stderr. `--help` is the one
mode that uses normal argparse stdout. Old machine-control CLI options are not
recognized.

See [CONTEXT.md](CONTEXT.md) for ownership and [RUN_WINDOWS_DEMO.md](RUN_WINDOWS_DEMO.md)
for source, portable, integration, troubleshooting, and termination guidance.
