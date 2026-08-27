# GATE-2 — Splits & locked test set

> **HISTORICAL EVIDENCE.** This dated Model 1 report is not current product
> behavior or an instruction for new work. Start with `DOCUMENTATION.md`.

**Status: AWAITING HUMAN SIGN-OFF (Tường)** — 2026-08-22, after Phase F.
(Simplified scope per v2 plan: owner-provided pre-annotated data — no
inter-annotator agreement test; validity + split integrity + locked test only.)

## Checks

| # | Check | Pass condition | Measured | Evidence | Result |
|---|---|---|---|---|---|
| 1 | Label files 100% valid (9-field OBB, [0,1] after clamp, class ∈ 0..3) | 100% | 0 malformed / 7,486 files | logs/normalize_report.txt | PASS |
| 2 | Split ratio 70/20/10 | train 5,238 / val 1,498 / test 750 (69.97/20.01/10.02%) | — | logs/split_report.json | PASS |
| 3 | Grouped split — no (source, original-photo) group spans two splits | 0 | **0 of 5,068 groups** | logs/split_report.json | PASS |
| 4 | Every class present in every split | yes | see table below | logs/split_report.json | PASS |
| 5 | Locked test set with sha256 MANIFEST | exists | 1,500 files hashed (750 img + 750 lbl) | dataset/test_locked/MANIFEST.txt | PASS |
| 6 | Training pipeline smoke-validated | runs end-to-end | 1 epoch / 3% data / 320px → train+val+save OK (metrics meaningless by design; run dir deleted, log kept) | logs/smoke_test.log | PASS |
| 7 | dataset.yaml correct class order 0..3 | yes | bottle, cap, wrapper, aluminum | dataset/dataset.yaml | PASS |

## Instances per split (from logs/split_report.json)

| Class | train | val | test |
|---|---|---|---|
| bottle | 5,565 | 1,694 | 852 |
| cap | 1,343 | 472 | 230 |
| wrapper | 1,194 | 458 | 258 |
| aluminum | 3,564 | 1,062 | 678 |

## Notes

- Test split (750 images) copied to `dataset/test_locked/` + MANIFEST sha256 +
  read-only attributes — this is the one-time G5 evaluation set.
- Roboflow-augmented siblings share the group key (source, stem-before-".rf."),
  so ×3 export variants never span train/val/test.
- Training config locked in `scripts/train.py` (kit Phase G, OBB-adapted).

## Sign-off

> Approved / rejected by Tường — date — notes: ________
