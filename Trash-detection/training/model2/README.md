# Model 2 training

Model 2 is the PET-only cap/label/ring OBB detector. This directory contains
training and candidate evaluation only; Windows launchers use `../../pc-demo/`,
and Jetson deployment uses `../../jetson-runtime/`.

## Current candidate workflow

Use the current versioned scripts under `scripts/` for smoke, training,
evaluation, and candidate export. Preserve grouped splits, the locked test set,
clean negatives, ring evidence, and active PC/Jetson artifacts. Candidate
exports remain isolated until every configured gate passes and an owner
separately authorizes promotion.

The active runtime contract is three classes in canonical order: `cap`,
`label`, `ring`. The runtime applies a `0.50` confidence policy when
converting M2 observations into a bad/clean workflow observation; this policy
is not a training shortcut or a reason to alter the dataset.

## Packaging and validation

From `Trash-detection/` after explicit approval:

```powershell
python scripts\package_models.py --target pc
python scripts\package_models.py --target jetson
```

Check active hashes before and after packaging. PC and Jetson runtimes remain
independent, and PC ONNX tests do not prove Jetson device readiness. Physical
camera/USB validation is a separate hardware check.
