# GATE-3 — Training quality

**Status: PARTIAL FAIL — awaiting human decision** — 2026-08-22, after Phase G.
Evidence: `logs/train_seed42.log`, `logs/train_seed7.log`, `logs/eval_val.log`,
`runs/seed42_n640/results.csv`, `runs/seed7_n640/results.csv` (151 rows each =
full 150 epochs, no early stop).

## Measured (val, best.pt, mAP@50 / mAP@50-95)

| Class | seed42 | seed7 | target | verdict |
|---|---|---|---|---|
| bottle | 0.8443 / 0.6943 | 0.8532 / 0.7030 | ≥ 0.90 | BELOW (~5 pts) |
| cap | 0.6291 / 0.4261 | 0.6379 / 0.4314 | ≥ 0.80 | BELOW (~16 pts) |
| wrapper | 0.6973 / 0.5185 | 0.6927 / 0.5310 | ≥ 0.80 | BELOW (~10 pts) |
| aluminum | 0.9779 / 0.8956 | 0.9778 / 0.9000 | ≥ 0.90 | **PASS** |
| overall | 0.7871 / 0.6336 | 0.7904 / 0.6413 | — | — |

## Seed stability (gate ≤ 3.0 pts) — PASS, very strong

bottle 0.89 · cap 0.88 · wrapper 0.46 · aluminum 0.01 (points). Two independent
runs agree closely → results are reproducible, no leakage signature (E-4 not
indicated).

## Root-cause analysis (why cap/wrapper/bottle miss; escape E-3 "data first")

Partial annotation across merged sources. A class visible-but-unannotated in an
image is trained as background, actively suppressing that class:

| Source | Images (train) | Annotates | Punishes |
|---|---|---|---|
| dataset-4 | 4,244 | bottle + can only | **cap, wrapper** (bottles shown without part boxes) |
| dataset-2 | 1,438 | cap + label only | **bottle** (bottles shown, no bottle boxes) |
| dataset-5 | 497 | bottle (state boxes, few parts) | cap, wrapper (mostly unboxed) |
| dataset-1 | 2,892 | cans only | (no bottles shown — no part punishment) |
| dataset-3 | 1,416 | bottle+cap+label (all parts) | — |

- cap (2,045 inst) and wrapper (1,910 inst) are also the rarest classes AND are
  contradicted by ~4.7k images showing bottles without part boxes (dataset-4+5).
- bottle is contradicted by dataset-2's 1.4k images (bottles without bottle boxes).
- aluminum is the ONLY class whose every appearance is annotated → 0.98.

## Options for the owner (decision is Tường's — gate reinterpretation is human-only)

1. **Accept + proceed to Phase H export** with seed7 (best overall). bottle 0.85 /
   aluminum 0.98 are strong for sorting; cap/wrapper are auxiliary signals.
   Document targets as re-scoped to the owner-provided data reality.
2. **One targeted retrain experiment** (~2 h): drop dataset-2 (its 1.4k
   no-bottle-box images hurt bottle; dataset-3 alone still supplies 5,242 cap /
   4,750 wrapper instances) — tests how much bottle recovers.
3. **The real fix (kit D-2 route)**: annotate cap/wrapper (+bottle where missing)
   on a subset of dataset-4/dataset-5 images, or run the in-machine capture
   campaign with all-4-class annotation — then retrain.

Hyperparameter changes are explicitly LAST per escape E-3.

## Sign-off

> Decision (1 / 2 / 3 + notes) by Tường — date: ________
