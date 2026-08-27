# GATE-4 — Edge deployment (off-device portion)

> **HISTORICAL EVIDENCE.** This dated Model 1 report is not current product
> behavior or an instruction for new work. Start with `DOCUMENTATION.md`.

**Status: PARTIAL — awaiting human decisions** — 2026-08-22, after Phases H + I.
On-device FPS + live smoke test (Phase K) still pending — they complete this gate.

## Platform blocker discovered (documented, not improvised around)

Ultralytics 8.4.126 restricts LiteRT/TFLite export to **Linux x86 / macOS**
(`assert MACOS or (LINUX and not ARM64)`). The build machine is Windows →
TFLite variants cannot be produced locally. Also: the new unified LiteRT format
replaced `tflite` and **no longer offers FP16** (only int8 / w8a16 / w8a32 / fp32).

Consequences for the kit's "TFLite INT8+FP16 × 320+416" matrix:
- Produced locally instead: **ONNX FP32 @320 and @416** (fully supported, OBB-safe).
- TFLite/LiteRT variants: prepared as a ready-to-run Colab kit
  (`export/colab_kit/` — best.pt + calib200.zip + one-cell script) for the owner
  to run on a free Colab CPU runtime (~10 min).
- FP16 variants are impossible in the new API → replaced by FP32 (on Jetson Nano
  Maxwell, FP16 has no tensor-core advantage anyway; FP32 vs INT8 are the
  meaningful options there).

## Measured — off-device validation (val split, 1,498 images, seed7 best.pt)

### Deploy-size baselines and format losses (mAP@50)

| Variant | bottle | cap | wrapper | aluminum | overall |
|---|---|---|---|---|---|
| .pt @640 (ref, G3) | 0.8532 | 0.6379 | 0.6927 | 0.9778 | 0.7904 |
| .pt @320 | 0.7747 | 0.4486 | 0.5569 | 0.9348 | 0.6788 |
| .pt @416 | 0.8268 | 0.5488 | 0.6287 | 0.9696 | 0.7435 |
| onnx @320 | 0.7655 | 0.4363 | 0.5603 | 0.8973 | 0.6648 |
| onnx @416 | 0.8160 | 0.5358 | 0.6248 | 0.9667 | 0.7358 |

- **ONNX conversion loss (vs .pt at same size): ≤ 1.4 pts overall** (≤ 1.3 per
  class except aluminum@320 −3.7) → export artifacts are faithful.
- **Resolution is the dominant cost**: 640→320 ≈ −11.2 pts overall; 640→416 ≈
  −4.7 pts. `cap` suffers most (small object). **416 is clearly the better
  deploy size.**
- INT8 numbers: NOT MEASURED yet — requires the Colab export; will be appended.

## Checks

| # | Check | Result |
|---|---|---|
| 1 | Exported variants exist + smoke-load | ONNX 320/416 ✅ (labels.txt included); LiteRT pending Colab |
| 2 | Off-device accuracy drop documented | ✅ table above (evidence: logs, this report) |
| 3 | INT8-vs-FP32 drop < 2 pts for chosen variant | PENDING Colab artifacts |
| 4 | Live FPS on Jetson ≥ production baseline | PENDING Phase K |
| 5 | Label order matches dataset.yaml | ✅ 0=bottle 1=cap 2=wrapper 3=aluminum (labels.txt shipped per variant) |

## Deployment-format decision needed (owner)

The old `inference_tflite.py` post-processing (detect-style `[1, 4+nc, anchors]`
cx/cy/w/h) **cannot parse OBB output anyway** — Jetson-side code changes
regardless of container format. Options:
- **A. ONNX on Jetson** (onnxruntime, or TensorRT engine built on-device) —
  recommended: fastest path on Nano, artifacts already exist and are validated.
- **B. LiteRT/TFLite via Colab** — keeps tflite_runtime familiarity; needs the
  Colab run + accuracy re-check after INT8.

## Sign-off

> Decision (A / B / both) + date — Tường: ________
