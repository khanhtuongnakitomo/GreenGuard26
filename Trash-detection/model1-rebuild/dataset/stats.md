# Dataset statistics — Model 1 rebuild (OBB, canonical 0=bottle 1=cap 2=wrapper 3=aluminum)

Updated 2026-08-22 after full 5-source ingest + normalization + dedupe.
Evidence: `logs/inspect_incoming.json`, `logs/normalize_report.json`,
`logs/dedupe_report.json`, `logs/dedupe_run.txt`.

## 1. Sources (5, all Roboflow Universe, all exported as YOLOv8-OBB)

| Source | Origin | Images | License | Provides |
|---|---|---|---|---|
| `dataset-1` | workspace101/aluminum-cans | 3,306 | CC BY 4.0 | aluminum only |
| `dataset-2` | mohammed-essam-iz1ve/bottle-cap-label-detection v3 | 1,558 | CC BY 4.0 | cap, wrapper |
| `dataset-3` | patriks-workspace-bwlpe/plastic-bottle-detection v5 | 1,632 | MIT | bottle, cap, wrapper, (liquid dropped) |
| `dataset-4` | roboflow-kkrep/plastic-bottle-and-can v3 | 6,059 | Public Domain | bottle, aluminum |
| `dataset-5` | water-bottle-dataset/water-bottle-pyqmv (complete re-download) | 722 | CC BY 4.0 | bottle (state boxes), few cap/wrapper |

Notes:
- dataset-1 has numeric class names `0`,`1`,`2` besides `can`,`cans` — **verified by
  rendering + vision check that all five are aluminum cans** (intact/crushed); numeric
  names are export artifacts. All → `aluminum`.
- dataset-5 classes 0–4 are whole-bottle *state* boxes (verified: box covers whole
  bottle incl. cap) → `bottle`.
- dataset-3 `liquid` dropped (4,745 rows, out of scope).
- Export-time augmentation (×3 versions) present in dataset-2 (flip/rot/brightness)
  and dataset-3 (exposure) — handled by dedupe + split grouping.

## 2. Normalization (Phase C)

| Metric | Value |
|---|---|
| Images kept (pre-dedupe) | 12,623 |
| Images dropped (empty labels after filtering) | 949 |
| Label rows dropped (liquid) | 4,745 |
| Lines clamped into [0,1] | 1,299 (rotation drift; max +0.23/−0.19) |
| Lines quarantined | 0 |

Instances pre-dedupe: bottle 13,895 · cap 6,311 · wrapper 6,203 · aluminum 8,086.

## 3. Dedupe (Phase D, pHash 64-bit, hamming ≤ 8)

| Metric | Value |
|---|---|
| Duplicate pairs found | 14,240 |
| Clusters ≥ 2 | 2,062 |
| Images moved to `audits/duplicates/` (kept for audit, nothing deleted) | 5,137 |
| **Images after dedupe** | **7,486** |
| Near-duplicate pairs remaining in kept set | 0 (by construction: every pair ≤8 collapsed to one image) |
| Cross-source overlap confirmed | dataset-1 ↔ dataset-4 share original photos (e.g. `00ake`, `0a93` stems) |

Keep-priority on collision (documented choice): dataset-3 > dataset-2 > dataset-5 >
dataset-4 > dataset-1 (part-annotated curated sources win over bulk sources).

## 4. Final volume vs targets (gate G1)

| Class | Instances | Target | Status |
|---|---|---|---|
| `bottle` (0) | 8,111 | ≥ 1,500 | PASS |
| `cap` (1) | 2,045 | ≥ 1,200 | PASS |
| `wrapper` (2) | 1,910 | ≥ 1,200 | PASS |
| `aluminum` (3) | 5,304 | ≥ 1,200 | PASS |
| Total images | 7,486 | ≥ 1,500 | PASS |

## 5. Visual QA

20 random kept images rendered with canonical boxes → `dataset/audits/qa_render_20/`
(+ LISTING.txt). For Tường's G1 visual sign-off.

## 6. For Phase F (split)

Group key for leakage-safe 70/20/10 split: `(source, original-stem-before-".rf.")`
— Roboflow-augmented siblings of one source photo share the stem prefix and must
not span splits. sources.csv has 7,486 rows (image → source → origin split).

## 7. Class balance remark

cap (2,045) and wrapper (1,910) are 4× rarer than bottle/aluminum — all above
minimum, but per-class weighting at training time is worth considering; document
if used.

## 8. Splits (Phase F — logs/split_report.json)

Grouped by (source, original-stem-before-".rf."), deterministic seed 42.
**0 of 5,068 groups span splits** (leakage-safe). Ratio 69.97 / 20.01 / 10.02 %.

| Class | train | val | test |
|---|---|---|---|
| bottle | 5,565 | 1,694 | 852 |
| cap | 1,343 | 472 | 230 |
| wrapper | 1,194 | 458 | 258 |
| aluminum | 3,564 | 1,062 | 678 |
| **images** | **5,238** | **1,498** | **750** |

Test split copied to `dataset/test_locked/` with sha256 MANIFEST (1,500 lines) +
read-only — locked one-time G5 evaluation set.

## 9. Training readiness (smoke)

`scripts/train.py` smoke-validated 2026-08-22: 1 epoch / 3% fraction / 320px ran
train + val + save end-to-end (logs/smoke_test.log; smoke run dir removed to
avoid confusion with real runs). Full config: yolov8n-obb.pt, 150 epochs,
patience 30, imgsz 640, batch 16, AdamW, deterministic, flipud 0.0, mosaic 1.0,
closeMosaic 10. User runs via `scripts/run_training.ps1`.
