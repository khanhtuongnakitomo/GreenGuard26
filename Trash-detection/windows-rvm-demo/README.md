# Windows RVM demo source

This source is the Windows-specific kiosk shell around the canonical
`pc-demo/src` Model 1, Model 2, and `decision_core.py` runtime. The builder
copies those shared files, the locked `main` ONNX artifacts, and tracked
firmware/provenance into an ignored distribution folder.

## Decision contract

The full workflow consumes exactly seven Model 1 observations and requires
four votes. Aluminum emits `0`; PET enters Model 2 after the configured warmup.
Model 2 then consumes exactly seven good/bad/abstain observations, where good
emits `1` and bad emits `2`. No quorum emits no signal. One signal is allowed
per item and eight consecutive clear frames re-arm the workflow.

## Build and run

The primary `portable` profile requires a staged Windows x64 Python 3.11
runtime and local wheels under `portable-runtime/`; it never downloads during
the build. Run from `Trash-detection`:

```powershell
python scripts\build_windows_rvm_demo.py build --profile portable --allow-dirty --zip
```

If the staged runtime is unavailable, the command fails closed. The explicit
development fallback is:

```powershell
python scripts\build_windows_rvm_demo.py build --profile online-source --allow-dirty
```

That output is labelled `ONLINE-SOURCE FALLBACK`, may require system Python and
internet access, and is not a movable offline release. Generated `dist/` files
are ignored.

Serial is disabled by default. After camera-only validation, manually flash
`firmware/rvm-v2/RVMRun_v2.ino` and use `--enable-serial --serial-port COMx`.
The controller requires the exact `RVM-V2` handshake, signals `0`/`1`/`2`, and
`ACK:<signal>` followed by `DONE:<signal>`. Emergency stop uses `!`; the
legacy firmware must not be used with the v2 desktop transport. Install the
correct USB serial driver for the RVM controller before connecting it. An
emergency stop is latched in both desktop and firmware state; press `R` only
after the operator has confirmed the machine is safe. Eight clear frames are
still required before a new item can be processed.

The kiosk keys are `S` (system on), `P` (pause), `E` (emergency stop), and `R`
(explicit emergency reset).
