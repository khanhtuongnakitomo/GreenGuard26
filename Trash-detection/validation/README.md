# Validation

Shared fixtures and Ultralytics baseline contracts for PC and Jetson parity.

## Layout

```text
validation/
  fixtures/                 # JPEG images
  contracts/baseline.json   # Ultralytics reference outputs
  generate_reference.py
  tests/test_gate.py        # Synthetic gate unit tests
```

## Regenerate baseline

```powershell
cd Trash-detection
.\pc-demo\.venv\Scripts\python.exe validation\generate_reference.py
# or against packaged models:
.\pc-demo\.venv\Scripts\python.exe validation\generate_reference.py --models-root pc-demo\models
```

## Tolerances

| Check | Rule |
|---|---|
| Class ID | Exact |
| Confidence | within `1e-4` (PC Ultralytics) |
| Polygon IoU | ≥ 0.90 PC / ≥ 0.85 Jetson vs baseline |
| Gate (warmup / vote / hold) | Exact on synthetic cases |

## Fixture provenance

Images from `training/model1/dataset/audits/qa_render_20/` and related audits.
Add M2-positive live captures when available.
