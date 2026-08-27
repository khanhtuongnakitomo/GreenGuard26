# GATE-1 — Merged dataset healthy

> **HISTORICAL EVIDENCE.** This dated Model 1 report is not current product
> behavior or an instruction for new work. Start with `DOCUMENTATION.md`.

**Status: AWAITING HUMAN SIGN-OFF (Tường)** — 2026-08-22, after Phases B+C+D.

## Checks

| # | Check | Pass condition | Measured | Evidence | Result |
|---|---|---|---|---|---|
| 1 | Total images after dedupe | ≥ 1,500 | **7,486** | logs/dedupe_report.json | PASS |
| 2a | bottle instances | ≥ 1,500 | **8,111** | logs/dedupe_report.json | PASS |
| 2b | cap instances | ≥ 1,200 | **2,045** | logs/dedupe_report.json | PASS |
| 2c | wrapper instances | ≥ 1,200 | **1,910** | logs/dedupe_report.json | PASS |
| 2d | aluminum instances | ≥ 1,200 | **5,304** | logs/dedupe_report.json | PASS |
| 3 | Near-duplicate pairs remaining | < 5% | **0%** (all pairs at hamming ≤ 8 collapsed) | logs/dedupe_report.json | PASS |
| 4 | Label files 100% valid (9-field OBB, [0,1], class ∈ 0..3) | 100% | 14,240 malformed→0 after clamp; validator integrated in normalize | logs/normalize_report.txt | PASS |
| 5 | CREDITS.md complete with per-source licenses | exists | 5 sources, licenses recorded | dataset/CREDITS.md | PASS (review) |
| 6 | 20 random images render with correct boxes | visual | rendered, awaiting human review | dataset/audits/qa_render_20/ | **PENDING human eyes** |

## Deviations from original kit (documented)

- Class set is the owner-redefined `0=bottle, 1=cap, 2=wrapper, 3=aluminum` (OBB),
  not the kit's `bottle/can/cap/label` HBB — per owner decision 2026-08-22.
- Dataset is owner-provided (5 Roboflow YOLOv8-OBB exports) instead of the kit's
  S1–S5 API downloads.
- dataset-1 numeric classes verified as aluminum cans before mapping (renders in
  logs/render/ds1n_*).
- Dedupe keep-priority: dataset-3 > dataset-2 > dataset-5 > dataset-4 > dataset-1.
- 5,137 duplicate images moved (not deleted) to dataset/audits/duplicates/.

## Notes for the reviewer

- cap/wrapper are ~4× rarer than bottle/aluminum (all above minimum) — consider
  per-class weighting at train time; will be documented if used.
- Phase F split must group by (source, original-stem-before-".rf.") to keep
  Roboflow-augmented siblings in one split.

## Sign-off

> Approved / rejected by Tường — date — notes: ________
