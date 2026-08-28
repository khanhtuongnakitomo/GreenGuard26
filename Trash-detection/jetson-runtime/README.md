# GreenGuard Jetson runtime

Self-contained detection bundle for **Jetson Nano B01** (JetPack 4.6.6 /
L4T R32.7.6 / CUDA 10.2 / TensorRT 8.2). Copy this folder to the Nano Ubuntu
filesystem; it does not need the Git repo, `training/`, or `pc-demo/`.

No Ultralytics. No PyTorch. Python 3.6-compatible sources.

## Transfer and run

On the PC, copy `Trash-detection/jetson-runtime/` to the Nano (USB, SCP, etc.).

On the Nano:

```bash
mv jetson-runtime ~/greenguard
cd ~/greenguard
chmod +x setup.sh build_engines.sh run.sh
./setup.sh --check
./build_engines.sh
./run.sh --backend tensorrt --source 0
```

Optional ONNX Runtime CPU fallback when TensorRT engines are missing:

```bash
ORT_WHEEL=/path/to/onnxruntime_*.whl ./setup.sh
./run.sh --backend onnx --source 0
```

CSI example (set in `config/default.json` under `camera.gstreamer` or pass a
pipeline via source tooling).

## Scripts

| Script | Purpose |
|---|---|
| `setup.sh` | Idempotent env / manifest checks; optional ORT wheel |
| `check_environment.py` | JetPack / OpenCV / NumPy / TensorRT / ORT probe |
| `build_engines.sh` | Build two FP16 engines with `trtexec` + engine manifest |
| `run.sh` | Launch `src/app.py` |

Engines live in `models/engines/` (gitignored). Runtime refuses stale or foreign
engines (SHA-256 + source ONNX hash in `engine_manifest.json`).

## Models

- `m1_detect_416.onnx`
- `m2_obb_416.onnx`

## Device validation checklist

See [DEVICE_VALIDATION.md](DEVICE_VALIDATION.md).

## Tests (can run on PC for import/decode)

```bash
python3 -m pytest tests -q
```
