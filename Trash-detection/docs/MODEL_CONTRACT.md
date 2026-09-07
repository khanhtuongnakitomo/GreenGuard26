# Model contract

Committed deployment ONNX files (packaged into `pc-demo/models` and
`jetson-runtime/models` by `scripts/package_models.py`):

| Role | Source export | Packaged name | Input | Output | Classes |
|---|---|---|---|---|---|
| M1 detector | `training/model1/export/detect_640` / `detect_416` | `m1_detect_640.onnx` / `m1_detect_416.onnx` | `[1,3,640,640]` / `[1,3,416,416]` | `[1,7,8400]` / `[1,7,3549]` | metal_can, pet_bottle, pp_cup |
| M2 OBB (PC) | `training/model2/export/onnx_640` | `m2_obb_640.onnx` | `[1,3,640,640]` | `[1,8,8400]` | cap, label, ring |
| M2 OBB (Jetson) | `training/model2/export/onnx_416` | `m2_obb_416.onnx` | `[1,3,416,416]` | `[1,8,3549]` | cap, label, ring |

M1 is a single-stage HBB detector. Class IDs 0 and 1 map to the visible
aluminum-can and PET-bottle verdicts. Class ID 2 (`pp_cup`) is intentionally
ignored before top-1 selection and is never shown or sent to Model 2.

## Windows detection contract

The integrated Windows PC line keeps the known-good Model 1 artifact. Model 1
SHA-256 is `5069BFAE324DB8C1AEF1FBCE4B68AAAD217A80A95A6F6B83EACFA60CDB620038`.
The promoted revamped Model 2 package is `2DF4F8F9F7D941998029E65809EB53BBF401199EB4D0A8489E7B259503AD1449`
on PC and `FDA4C7986ADCE3262686842DC751AFBEAE14BD6C059C794926E3A5872BE62FA7`
on Jetson. The original Model 2 hash remains available in the rollback
manifest as the known-good pre-revamp baseline.

Model 1 has two confidence floors:

- `infer_conf=0.05` generates diagnostic candidates.
- `decision_conf=0.65` is the public acceptance floor until owner camera-only
  evidence supports a separate calibration.

Filtering is ordered as ignored/unknown class suppression, minimum area, then
decision confidence. Only accepted `pet_bottle` frames may call Model 2.
`pp_cup` can remain in the internal three-class ONNX shape, but it is never
displayed, routed, or forwarded. The rejected v7 candidate hashes are listed
in `validation/contracts/rejected_models.json` and packaging refuses them.

## Output layouts

M1 HBB channels are `[cx, cy, w, h, class_probs...]`; do not apply a second
sigmoid. The class score is the maximum class probability.

Channels-first or transposed to rows. For `nc` classes:

```text
[cx, cy, w, h, class_probs..., angle]
```

Do **not** apply a second sigmoid. Class score = max class probability; class id =
argmax. Angle is radians for polygon reconstruction.

## Preprocessing

- **HBB and OBB:** Ultralytics letterbox fill 114, BGR→RGB, CHW float32, `/255`

The PC M1 pipeline keeps two confidence values deliberately: `infer_conf=0.05` is the
candidate-generation floor, while `decision_conf=0.65` is the public workflow
acceptance floor after class visibility and minimum-area filtering. A low-score
candidate must not be shown, passed to the PET gate, or invoke Model 2.

## Nano B01 confidence difference

The inspected `jetson-runtime/config/default.json` and `src/pipeline.py` use
`conf=0.05` without the PC's separate decision floor. The runtime tests record
this existing behavior with synthetic low-confidence detections. Do not treat
passing host decoder tests as PC/Jetson decision parity. Aligning this behavior
requires a separate change, blank/low-confidence/PP regression fixtures, and
on-device smoke and soak checks; the September web refactor changes no models,
thresholds, or detection code.

## Gate defaults (PC decision floor; other values shared)

| Setting | Value |
|---|---|
| M1 inference conf | 0.05 |
| M1 decision conf | 0.65 until camera-only calibration |
| Min area fraction | 0.02 |
| M2 infer conf | 0.10 |
| M2 violation conf | 0.50 |
| Warmup | 0.5 s |
| M1 material vote | exactly 7 observations; 4 of 7 quorum |
| M2 quality vote | exactly 7 observations after warmup; 4 of 7 quorum |
| Verdict hold | 1.5 s |
| Clear frames to re-arm | 8 consecutive missing M1 tracks |
| PET polygon EMA alpha | 0.35 |
| Target FPS | 5 |

## Public decision signals

The workflow returns only these final detection signals:

| Signal | Meaning |
|---:|---|
| `0` | aluminum can |
| `1` | good PET |
| `2` | bad PET |

PP cups, unknown classes, and missing tracks are abstentions. A quorum is not
resolved early: all seven observations are consumed. Missing Model 2 tracking
is also an abstention and is never counted as good PET. A no-quorum window
emits no signal and the item must clear before a new window can open.

The Windows demo maps these values to one stdout line per completed item:
`0\n`, `1\n`, or `2\n` in ASCII. The line is flushed immediately and appears
only on the exact decision frame; result-hold and re-arm frames are silent.
Process exit status is application status, not classification value `0`.

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
