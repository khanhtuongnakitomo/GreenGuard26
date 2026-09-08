# Model 1 training

This tree is for reviewed data preparation, training, evaluation, and export.
It is not a live Windows launcher. The Windows runtime is
`../../pc-demo/`; its current PC package is the two-class HBB detector
described by `../../pc-demo/models/manifest.json`.

## Rebuild gate

The strict rebuild workflow remains fail-closed until a reviewer-approved,
grouped dataset manifest exists at the configured location. Do not infer label
quality or production suitability from raw captures, generated images, or a
candidate export. Preserve the active package and reject candidate hashes
until parity, locked-test, negative-surface, and runtime checks are reviewed.

The current rebuild context and runbook are owner-controlled working material.
They may contain historical evidence and are intentionally not part of this
Windows runtime cleanup.

## Safe workflow

1. Review provenance and labels before generating variants.
2. Split by source/group before augmentation and keep validation/holdout
   untouched.
3. Train and evaluate a candidate without changing active runtime files.
4. Export required deployment sizes only after evaluation gates pass.
5. Compare candidate hashes and runtime parity against active artifacts.
6. Run the explicit activation stage only after recording the previous active
   M1 hash; the owner-authorized override records an `*_ACTIVE_OVERRIDE`
   status when measured gates fail and provides a rollback snapshot.

Do not lower runtime decision policy from unlabeled evidence. Run the actual PC
and Jetson contract checks after any authorized model change.
