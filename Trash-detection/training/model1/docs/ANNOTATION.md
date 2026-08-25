# Annotation Guideline (v4 — 2026-08-22, refactor v2)

Model 1 detects exactly **2 classes**, YOLOv8 OBB format.

> v4 changes (owner directive 2026-08-22 "refactor toàn bộ"): class set reduced
> from {bottle, cap, wrapper, aluminum} to **{bottle, aluminum}**; retrain from
> scratch on a re-standardized dataset; application is CPU-only (GPU reserved
> for training). v1/v3 history: 4-class OBB set (2026-08-22 earlier same day).

## 1. Canonical class definitions

| ID | Class | Definition |
|---|---|---|
| 0 | `bottle` | the whole visible PET bottle — body, neck, and cap when present. One box per bottle, any state (intact, crushed). |
| 1 | `aluminum` | the whole aluminum can, one box, any state (intact, crushed, dented). |

## 2. Box mechanics

- Oriented (rotated) rectangles, tight to the visible extent, 4 corner points,
  normalized [0,1]: `class x1 y1 x2 y2 x3 y3 x4 y4`. Axis-aligned boxes are
  corner quads at 0° — legal.
- One box per instance; overlapping/occluded instances still get their own boxes.
- Anything < 50% visible: omit; at ~50%: box it.

## 3. Explicitly NOT detected (background)

Cap, wrapper/label, tamper ring (never in scope this round), glass, cups, bags,
paper, hands. `cap`/`wrapper` annotation rows from v1 sources are dropped at
normalization (scripts/normalize_labels.py), and **dataset-2 is excluded
entirely** — it never annotated the bottle itself, which taught the v1 model
"bottle = background" (partial-annotation failure, see reports/GATE-3.md).

## 4. Data hygiene (enforced by the pipeline)

- pHash dedupe at hamming ≤ 8, keep-priority dataset-3 > dataset-5 > dataset-4
  > dataset-1 (part-annotated curated sources first).
- Grouped 70/20/10 split keyed by (source, original-stem-before-".rf.") so
  Roboflow-augmented siblings never span train/val/test.
- Test split locked with sha256 MANIFEST (dataset/test_locked/) — opened once
  at final evaluation.
