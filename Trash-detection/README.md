# GreenGuard Trash-detection

Detection for the GreenGuard recycling kiosk: PET vs aluminum (Model 1), then
cap / label / ring gate on PET only (Model 2).

## Layout

```text
Trash-detection/
  setup.ps1 / run_demo.bat     # Windows wrappers → pc-demo/
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
.\run_demo.bat --source 0
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

1. M1 OBB detector @416 → top object by confidence (min area 2% of frame)
2. Axis-aligned crop + 10% margin → PET/can classifier @224
3. Can → display aluminum; skip M2
4. PET → M2 OBB on full frame; keep centers inside PET polygon; one box per class
5. Gate: 0.5s warmup, 4-of-7 vote, 1.5s verdict hold, miss hold 3 frames

## Packaging models after retrain

```powershell
cd Trash-detection
python scripts\package_models.py --target all
python scripts\package_models.py --target all --check
```

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/MODEL_CONTRACT.md](docs/MODEL_CONTRACT.md)
- [pc-demo/README.md](pc-demo/README.md)
- [jetson-runtime/README.md](jetson-runtime/README.md)
- [training/README.md](training/README.md)
- [validation/README.md](validation/README.md)

Legacy live launcher `run_live_demo.py` still works against `training/` for
parity checks; prefer `pc-demo/` for day-to-day PC demos.
