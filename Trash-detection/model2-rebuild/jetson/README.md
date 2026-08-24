# Model 2 on Jetson Nano B01

Target: YOLOv8n-OBB **ONNX FP32 @416**, standalone (M2 only). Do **not** install
Ultralytics on the Nano (JetPack 4.6 / Python 3.6 cannot run this stack).

## Artifacts (from the PC after training)

Copy the folder produced by `scripts/export_onnx.py`:

```
export/onnx_416/model.onnx
export/onnx_416/labels.txt   # cap, label, ring
```

onto the Nano, e.g. `~/greenguard/m2/`.

## Runtime options

### A. onnxruntime (simplest)

```bash
# on Nano (JetPack 4.6 example — pin wheels to your JP version)
pip3 install numpy onnxruntime
# OpenCV: sudo apt install python3-opencv   OR pip3 install opencv-python-headless

cd ~/greenguard/m2
python3 infer_obb_onnx.py --model model.onnx --source 0 --conf 0.5
# FPS bench (100 frames, no display if headless — use --save / --max-frames):
python3 infer_obb_onnx.py --model model.onnx --source 0 --bench 100 --max-frames 100
```

Target: **≥ 5 FPS** @416. Record the printed mean infer FPS (NOT MEASURED until device run).

### B. TensorRT (faster, preferred for Nano)

Build the engine **on the device** (engines are not portable across GPUs/JetPack):

```bash
# if trtexec is on PATH (TensorRT samples)
/usr/src/tensorrt/bin/trtexec \
  --onnx=model.onnx \
  --saveEngine=model_fp16.engine \
  --fp16 \
  --workspace=1024
```

Maxwell (Nano) gains little from FP16 tensor cores; if FP16 is unstable, use FP32.
Wire the engine through TensorRT Python API or `onnxruntime` TensorRT EP later;
`infer_obb_onnx.py` stays the ORT reference decoder for OBB polygons.

## Notes

- Static ONNX graphs only accept the exported imgsz (416). Do not call with 640.
- Cap / ring are small objects — do not drop below 416 for production without
  re-measuring mAP (`scripts/eval_deploy_size.py` on the PC).
- Full M1+M2 gate on Nano is **out of scope** for this phase (4 GB RAM).
