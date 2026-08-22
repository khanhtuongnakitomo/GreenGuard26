# Annotation Guideline (v3 — 2026-08-22)

Rebuild Model 1 — 4 classes, **YOLOv8 OBB format**, tamper-ring handling deferred
(out of scope this round). Every annotator reads this before their first image.

> v3 changes (owner decision 2026-08-22): canonical classes renamed/reordered to
> `0=bottle, 1=cap, 2=wrapper, 3=aluminum`; format switched to YOLOv8-OBB;
> `bottle` is now the **whole visible bottle INCLUDING the cap** — this matches
> the convention of all three provided datasets (verified geometrically: 82.5%
> of cap boxes sit in the top 25% of their bottle box).

## 1. Canonical class definitions

| ID | Class | Definition |
|---|---|---|
| 0 | `bottle` | the whole visible PET bottle — body, neck, **and cap** when present. One box per bottle, any state (intact, crushed). |
| 1 | `cap` | the bottle cap only — tight box around the visible cap (drawn additionally when the cap is on; also for loose caps lying in the frame). |
| 2 | `wrapper` | the printed label wrap **actually visible** on the bottle — the printed sleeve, not the whole bottle. Peeled/torn: box only the still-attached printed portion. No printed wrap discernible → no instance. |
| 3 | `aluminum` | the whole aluminum can, one box, any state (intact, crushed, dented). |

## 2. Box mechanics

- Axis-aligned rectangles, tight to the visible extent, no padding margin.
- One box per instance; never fragment one object into multiple boxes.
- Overlapping boxes between classes (cap over bottle, label over bottle) are expected
  and correct.
- Anything < 50% visible (occluded by flap/hand): omit that instance. At ~50%: box it.

## 3. Edge cases (binding interpretations)

| Situation | Ruling |
|---|---|
| Cap on the bottle | `bottle` box covers the whole bottle incl. cap; `cap` box drawn additionally over the cap |
| Cap off | no cap box; `bottle` box normally |
| Loose cap on the bin floor | box it (`cap`) |
| Cap half unscrewed (tilted, still threaded) | box the cap as-is |
| Label covers ~entire bottle | `label` box ≈ printed wrap extent — fine, both boxes exist |
| Transparent/clear printed label | if discernible, box it; if invisible, no instance |
| Crushed bottle, cap buried | box `cap` only if ≥ 50% discernible; else omit |
| Multiple bottles/cans in frame | box every instance independently |
| Can behind a bottle, 30% visible | omit the can |
| Specular highlight on can | still one `can` box; do not split around it |
| Bottle partially out of frame | box the visible portion |

## 4. Format & tools

- **YOLOv8 OBB txt**: one file per image, lines
  `class_id x1 y1 x2 y2 x3 y3 x4 y4` (4 corner points, clockwise), all coordinates
  normalized to [0,1]. Class IDs fixed: 0=bottle, 1=cap, 2=wrapper, 3=aluminum.
- Axis-aligned boxes are represented as corner quads with 0° rotation — legal OBB.
- Approved tools: Roboflow (web, polygon tool → YOLOv8-OBB export) or Label Studio.

## 5. QA (lightweight — dataset is expected pre-annotated)

1. Automated validation: every label file 5 fields, values in [0,1], class ∈ {0..3};
   malformed files quarantined with a report.
2. Render 20 random images with boxes for visual sign-off (gate check).
3. Auto-flags for human confirmation: cap boxes with unusual aspect/height outliers
   vs image-scale median; `label` boxes whose area > 90% of the paired `bottle` box.

## 6. Deferred (explicitly out of scope this round)

- **Tamper/sealant ring**: no ring rule, no ring-specific boxes, no ring-only test
  category, no ring false-positive metric. Cap boxes simply cover the cap only
  (tight box, §1) — whatever sits below the cap's bottom edge is not part of the
  cap box. Ring-focused evaluation may be added in a future round; this deferral
  will be stated in `reports/model-card.md` as a known limitation.
