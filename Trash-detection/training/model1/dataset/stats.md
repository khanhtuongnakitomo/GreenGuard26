# Dataset statistics — Model 1 rebuild v2 (OBB, 2 classes: 0=bottle 1=aluminum)

Regenerated 2026-08-22 (refactor v2: classes reduced, dataset re-standardized,
v1 4-class models archived under runs/v1_4class + export/v1_4class).
Evidence: `logs/normalize_report_v2.txt`, `logs/dedupe_run_v2.txt`,
`logs/split_run_v2.txt`, `logs/split_report.json`.

## 1. Sources in play (dataset-2 EXCLUDED)

| Source | Origin | License | Role |
|---|---|---|---|
| dataset-1 | workspace101/aluminum-cans (3,306 img) | CC BY 4.0 | aluminum (numeric class names verified = cans) |
| dataset-3 | patriks plastic-bottle-detection v5 (1,632 img) | MIT | bottle (cap/label/liquid rows dropped) |
| dataset-4 | roboflow plastic-bottle-and-can v3 (6,059 img) | Public Domain | bottle + aluminum |
| dataset-5 | water-bottle-pyqmv (722 img) | CC BY 4.0 | bottle (state boxes) |
| ~~dataset-2~~ | ~~bottle-cap-label-detection~~ | CC BY 4.0 | **EXCLUDED — no bottle boxes on 1.5k bottle photos → would teach "bottle = background"** |

Key property of v2: **every appearance of both classes is annotated in every
kept source** (the partial-annotation noise that hurt v1 is gone).

## 2. Pipeline numbers

| Stage | Value |
|---|---|
| Images after normalize (pre-dedupe) | 11,281 |
| Instances pre-dedupe | bottle 13,895 · aluminum 8,086 |
| Duplicate images moved (pHash ≤ 8) | 3,984 |
| **Images after dedupe** | **7,297** |
| **Instances after dedupe** | **bottle 8,111 · aluminum 5,315** |

## 3. Splits (grouped, seed 42; 0 spanning groups of 4,932)

| Split | images | bottle | aluminum |
|---|---|---|---|
| train | 5,106 | 5,948 | 3,756 |
| val | 1,460 | 1,490 | 1,079 |
| test (locked, MANIFEST 1,462 lines) | 731 | 673 | 480 |

## 4. Training plan v2 (anti-overfit, fast)

yolov8n-obb, 80 epochs (was 150), patience 20 (was 30), cosine LR, AdamW,
imgsz 640, batch 16, single seed 42, flipud 0, mosaic + closeMosaic 10.
Smoke test 1-epoch/3% PASS (logs/smoke_test_v2.log; exactly 2 classes in val).
