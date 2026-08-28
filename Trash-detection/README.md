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
