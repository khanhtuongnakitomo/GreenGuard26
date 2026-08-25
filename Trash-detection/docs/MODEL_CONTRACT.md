# Model contract

Committed deployment ONNX files (packaged into `pc-demo/models` and
`jetson-runtime/models` by `scripts/package_models.py`):

| Role | Source export | Packaged name | Input | Output | Classes |
|---|---|---|---|---|---|
| M1 detector | `training/model1/export/onnx_416` | `m1_detector_416.onnx` | `[1,3,416,416]` | `[1,7,3549]` | bottle, aluminum |
| M1 classifier | `training/model1/export/cls_onnx_224` | `m1_classifier_224.onnx` | `[1,3,224,224]` | `[1,2]` | pet, can |
| M2 OBB (PC) | `training/model2/export/onnx_640` | `m2_obb_640.onnx` | `[1,3,640,640]` | `[1,8,8400]` | cap, label, ring |
| M2 OBB (Jetson) | `training/model2/export/onnx_416` | `m2_obb_416.onnx` | `[1,3,416,416]` | `[1,8,3549]` | cap, label, ring |

## OBB output layout

Channels-first or transposed to rows. For `nc` classes:

```text
[cx, cy, w, h, class_probs..., angle]
```

Do **not** apply a second sigmoid. Class score = max class probability; class id =
argmax. Angle is radians for polygon reconstruction.

## Preprocessing

- **OBB:** Ultralytics letterbox fill 114, BGR→RGB, CHW float32, `/255`
- **Classifier:** resize shortest edge to 224, center crop 224, BGR→RGB, CHW float32,
  `/255` (mean 0, std 1)

## Gate defaults

| Setting | Value |
|---|---|
| M1 det conf | 0.05 |
| Min area fraction | 0.02 |
| Crop margin | 0.10 |
| Classifier vote window | 7 |
| M2 infer conf | 0.10 |
| M2 violation conf | 0.50 |
| Warmup | 0.5 s |
| Vote | 4 of 7 |
| Verdict hold | 1.5 s |
| Miss hold | 3 frames |
| PET polygon EMA alpha | 0.35 |
| Target FPS | 5 |

## Parity tolerances (validation)

| Check | Rule |
|---|---|
| Class ID / verdict | Exact |
| Confidence | within `1e-4` of Ultralytics baseline (PC) |
| Polygon IoU | ≥ 0.90 (PC) / ≥ 0.85 (Jetson TRT vs baseline) |
| Gate decisions | Exact on synthetic unit sequences |

Regenerate baseline:

```powershell
cd Trash-detection
.\pc-demo\.venv\Scripts\python.exe validation\generate_reference.py
```
