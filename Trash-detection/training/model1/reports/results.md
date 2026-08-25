# Results — GreenGuard Model 1 rebuild (OBB, 4 classes)

All numbers measured on 2026-08-22 from files on disk; evidence paths inline.
Model: YOLOv8n-obb, trained per kit Phase G (150 ep, imgsz 640, AdamW, 2 seeds).
Canonical classes: 0=bottle 1=cap 2=wrapper 3=aluminum. Dataset: 7,486 images
after normalize+dedupe (5 sources, see dataset/stats.md), grouped 70/20/10 split.

## 1. Training (val split, best.pt, imgsz 640) — logs/eval_val.log

| Class | seed42 mAP50 | seed7 mAP50 | seed7 mAP50-95 | gap (pts) |
|---|---|---|---|---|
| bottle | 0.8443 | **0.8532** | 0.7030 | 0.89 |
| cap | 0.6291 | **0.6379** | 0.4314 | 0.88 |
| wrapper | 0.6973 | **0.6927** | 0.5310 | 0.46 |
| aluminum | 0.9779 | **0.9778** | 0.9000 | 0.01 |
| overall | 0.7871 | **0.7904** | 0.6413 | 0.33 |

Seed stability: PASS (all ≤ 3.0 pts). G3 targets: aluminum PASS; bottle/cap/
wrapper BELOW (owner chose to accept — reports/GATE-3.md, root cause =
partial annotation across merged public sources).

**Deploy candidate: seed7_n640/weights/best.pt** (better overall).

## 2. Deploy-size accuracy (val split, seed7) — reports/GATE-4.md

| Variant | bottle | cap | wrapper | aluminum | overall |
|---|---|---|---|---|---|
| .pt @640 | 0.8532 | 0.6379 | 0.6927 | 0.9778 | 0.7904 |
| .pt @416 | 0.8268 | 0.5488 | 0.6287 | 0.9696 | 0.7435 |
| onnx @416 | 0.8160 | 0.5358 | 0.6248 | 0.9667 | 0.7358 |
| .pt @320 | 0.7747 | 0.4486 | 0.5569 | 0.9348 | 0.6788 |
| onnx @320 | 0.7655 | 0.4363 | 0.5603 | 0.8973 | 0.6648 |

- ONNX conversion loss ≤ 1.4 pts overall — artifacts faithful.
- Resolution dominates: 416 loses ~4.7 pts vs 640; 320 loses ~11.2.
- **Recommended deploy input: 416.**
- INT8 (LiteRT): NOT MEASURED (Windows cannot export LiteRT; Colab kit ready at
  export/colab_kit/).

## 3. Test / locked evaluation (G5)

NOT RUN YET — dataset/test_locked (750 images, sha256 MANIFEST) stays sealed
until the deployment variant is chosen and Phase K on-device validation is done.

## 4. Artifacts

- weights: runs/seed42_n640/weights/best.pt, runs/seed7_n640/weights/best.pt
- exports: export/onnx_320/, export/onnx_416/ (model.onnx + labels.txt)
- pending: export/litert_* (Colab kit at export/colab_kit/)
- gates: reports/GATE-0..4.md (G0–G3, G4-partial as of this file)
