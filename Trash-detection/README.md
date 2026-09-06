# GreenGuard Trash-detection

Detection for the GreenGuard recycling kiosk: PET vs aluminum (Model 1), then
cap / label / ring gate on PET only (Model 2).

## Layout

```text
Trash-detection/
  setup.ps1                    # environment setup
  demo_model1.bat              # public Model 1-only launcher
  demo_model2.bat              # public Model 2-only launcher
  full_demo.bat                # public M1 → M2 launcher
  pc-demo/                     # Windows Ultralytics reference runtime
  jetson-runtime/              # Self-contained Jetson Nano B01 copy folder
  training/model1|model2       # Research / training trees
  validation/                  # Fixtures + baseline contracts
  scripts/package_models.py    # Deterministic ONNX packaging
  scripts/build_windows_rvm_demo.py # Main-based reproducible Windows bundle
  windows-rvm-demo/             # Windows-specific workflow source
  docs/                        # Architecture + model contract
```

## Quick start (Windows PC)

```powershell
cd Trash-detection
powershell -ExecutionPolicy Bypass -File setup.ps1
.\full_demo.bat --source 0
```

Headless smoke:

```powershell
cd pc-demo
.\.venv\Scripts\python.exe src\app.py --headless --source ..\validation\fixtures\m1_reference.jpg --max-frames 1
```

## Jetson Nano B01

Copy **only** `jetson-runtime/` to the Nano (no repo clone required):

```bash
mv jetson-runtime ~/greenguard
cd ~/greenguard
chmod +x setup.sh build_engines.sh run.sh
./setup.sh --check
./build_engines.sh
./run.sh --backend tensorrt --source 0
```

Target stack: JetPack 4.6.6 / L4T R32.7.6 / TensorRT 8.2. Engines are built
on-device and never committed.

## Detection contract (locked)

1. M1 HBB detector @640 on PC / @416 on Jetson with `metal_can`, `pet_bottle`, and `pp_cup`
2. Only aluminum can and PET bottle are visible; PP cup is filtered before top-1 selection
3. Aluminum can → display aluminum and skip M2
4. PET bottle → M2 OBB on the full frame; keep centers inside the PET polygon; one box per class
5. Gate: 0.5s warmup, 4-of-7 vote, 1.5s verdict hold, miss hold 3 frames

The PC runtime now separates Model 1 candidate generation (`infer_conf=0.05`)
from public acceptance (`decision_conf=0.65`). Unknown and PP classes are
ignored before area/confidence gating. The first recovery validation is
camera-only and records evidence without importing or opening the serial
controller:

```powershell
.\diagnose_model1_rvm.bat --source 0 --session-id bright-01 --label metal_can --item-id can-01 --lighting bright --duration 10
```

Analyze one or more completed sessions without changing production settings:

```powershell
cd pc-demo
.\.venv\Scripts\python.exe src\analyze_m1_rvm.py --sessions ..\validation\rvm-sessions\bright-01 --output ..\validation\threshold-report.json
```

Build the Windows bundle from main's locked Model 1 and Model 2. The output is
ignored and may be regenerated:

```powershell
python scripts\build_windows_rvm_demo.py build
python scripts\build_windows_rvm_demo.py check
python scripts\build_windows_rvm_demo.py headless-smoke
```

The bundle defaults to serial disabled. Do not use `--enable-serial` until the
owner signs off the camera-only capture set.

The strict two-class replacement is guarded by
`training/model1/strict_two_class_config.json` and
`scripts/train_m1_strict.py`. With no reviewer-approved grouped manifest it
stops with `NEEDS_REVIEWED_DATA`; the derived v7 labels are never consumed and
the active runtime models are never overwritten.

## Packaging models after retrain

```powershell
cd Trash-detection
python scripts\package_models.py --target all
python scripts\package_models.py --target all --check
```

## Docs

- [../DOCUMENTATION.md](../DOCUMENTATION.md) - reading order and document authority
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/MODEL_CONTRACT.md](docs/MODEL_CONTRACT.md)
- [pc-demo/README.md](pc-demo/README.md)
- [jetson-runtime/README.md](jetson-runtime/README.md)
- [training/README.md](training/README.md)
- [validation/README.md](validation/README.md)

The three root BAT files are the only supported Windows live launchers. Training
and validation scripts remain internal tools and are not live entrypoints.
