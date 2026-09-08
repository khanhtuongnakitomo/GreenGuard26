# Model 1 retry status — `m1retry_20260908_seed42_yolo11s_r2`

## Final status

`NEEDS_REVIEW`

The corrected retry runner completed its source audit, generated the review
artifacts, and stopped before preparation, smoke training, GPU training,
export, and activation. No active model was replaced.

## Audit evidence

- 23,628 image files scanned; no source root was missing.
- 13,829 records are currently eligible: 13,824 positive records and five
  reviewed empty-machine negatives.
- Class instances: 3,340 `metal_can` and 18,763 `pet_bottle`.
- 150 exact/pixel duplicate images were excluded.
- 192 conflicting duplicate images were quarantined.
- 960 malformed-label images were quarantined.
- 436 empty-label images remain unreviewed.
- 2,070 perceptual matches are review proposals only; they were not merged
  into groups automatically.
- 111 `live-machine-dataset` frames require explicit whole-object annotation.

The existing `m1_rvm_derived.jsonl` file was not admitted. Its boxes are
derived from cap/label/ring unions and are not whole-bottle ground truth.

## Required next action

Review every machine frame and create the configured manifest:

`dataset/annotations/machine_m1_review.jsonl`

Use the generated template as the review queue:

`logs/rebuild/m1retry_20260908_seed42_yolo11s_r2/machine_m1_review_template.jsonl`

Each approved row must contain visually checked normalized whole-object HBBs
with `status: "approved"`, `labels`, and a reviewer identity. After review,
run the audit with a new run ID, then continue through `review`, `prepare`,
`freeze`, `smoke`, `screen-a`, `screen-b`, `train`, `evaluate`, `export`,
`verify`, and `activate`.

## Hash protection

- Active M1 before and after the run: `CF7BAF1C4A917C7F8ECBD1E30BF92CA5E3A38869B99CCBFB6B94A0B95111EB24`.
- Active PC M2: `2DF4F8F9F7D941998029E65809EB53BBF401199EB4D0A8489E7B259503AD1449`.
- Active Jetson M2: `FDA4C7986ADCE3262686842DC751AFBEAE14BD6C059C794926E3A5872BE62FA7`.

The five documented active-M1 parity failures remain unchanged: no new test
regression was introduced. Focused retry tests pass 24/24; the complete PC
and Model 1 suites pass 59 tests with only those five known failures.
