# GATE-0 — Guidelines approved

> **HISTORICAL EVIDENCE.** This dated Model 1 report is not current product
> behavior or an instruction for new work. Start with `DOCUMENTATION.md`.

> **Note 2026-08-22 (pre-sign-off revision):** guideline updated to v3 — canonical
> classes are now `0=bottle, 1=cap, 2=wrapper, 3=aluminum` (owner decision), format
> is YOLOv8-OBB, and `bottle` boxes now INCLUDE the cap (matches the convention of
> all three provided datasets, verified geometrically). Sign-off below applies to v3.

**Status: AWAITING HUMAN SIGN-OFF (Tường)** — created 2026-08-22, Phase A.

## Checks

| # | Check | Evidence | Result |
|---|---|---|---|
| 1 | Annotation guideline doc exists | `model1-rebuild/docs/ANNOTATION.md` | present (v2 simplified) |
| 2 | Class set explicit: 4 classes, IDs fixed 0=bottle, 1=can, 2=cap, 3=label | `docs/ANNOTATION.md` §1 | done |
| 3 | Edge-case table complete | `docs/ANNOTATION.md` §3 (11 rulings) | done |
| 4 | Tamper-ring scope: **deferred** per owner decision 2026-08-22 ("hiện tại không đả động gì tới cái vòng") — no ring rule, no ring metric; deferral recorded as known limitation | `docs/ANNOTATION.md` §6 | done |
| 5 | Human review | — | **PENDING** |

## Deviations from original kit (03-ANNOTATION-GUIDELINES.md)

1. Ring rule (§2 of the original) removed — deferred, not deleted: any future round
   must re-add it before ring-sensitive claims are made.
2. Inter-annotator agreement test (§6.2) and supervisor spot-check protocol (§6.3)
   dropped — dataset is owner-provided and expected pre-annotated; lightweight QA
   (§5) replaces them.
3. Hard-test composition table without ring-only category (40-image ring-only
   requirement removed with the ring scope).

## Sign-off

> Approved / rejected by Tường — date — notes: ________
