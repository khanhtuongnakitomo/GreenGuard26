# Model 1 activation override — 2026-09-08

## Status

`USER_AUTHORIZED_FAILED_CANDIDATE_ACTIVE_OVERRIDE`

The user explicitly requested that the previously exported Model 1 rebuild
candidate be placed at the active Model 1 path, despite its recorded
`FAILED_ACCEPTANCE` result. This is an activation override, not an assertion
that the model is production-ready and not a replacement for the historical
morning report.

## Active artifacts

The active PC 640 Model 1 artifact is now the v4 candidate:

- Active path: `Trash-detection/pc-demo/models/m1_detect_640.onnx`
- Candidate run: `m1rebuild_20260907_seed42_yolo11s_v4`
- Candidate source: `Trash-detection/training/model1/export/candidates/m1rebuild_20260907_seed42_yolo11s_v4/m1_rebuild_640.onnx`
- Active/candidate SHA-256: `cf7baf1c4a917c7f8ecbd1e30bf92ca5e3a38869b99ccbfb6b94a0b95111eb24`
- Classes: `0=metal_can`, `1=pet_bottle`
- Decision threshold: `0.84`
- Minimum area fraction: `0.02`

The canonical 640 training export and labels were synchronized with the same
candidate, and `pc-demo/models/manifest.json` was regenerated from those
sources. The default PC configuration now declares the two-class head and the
0.84 decision threshold.

At the time of the initial activation, Model 2 was not copied, retrained,
reconfigured, or repackaged. During the requested rebase, I retained the
remote branch's useful promoted machine-specific Model 2 package. That remote
integration is separate from the failed Model 1 activation, and it changes the
current Model 2 artifact from the pre-rebase baseline:

- Active Model 2 path: `Trash-detection/pc-demo/models/m2_obb_640.onnx`
- Current PC Model 2 SHA-256: `2df4f8f9f7d941998029e65809eb53bbf401199eb4d0a8489e7b259503ad1449`
- Current Jetson Model 2 SHA-256: `fda4c7986adce3262686842dc751afbeae14bd6c059c794926e3a5872be62fa7`
- Pre-rebase PC Model 2 baseline SHA-256: `d4c5f235fbb78e3a8451de695480400a916ffec235a518af47fd5b448c6eb999`
- The seven-observation, four-vote, PET-only Model 2, one-result-per-item, and
  eight-clear-frame re-arm contracts remain unchanged.

## Why the candidate is marked failed

The historical evaluation remains authoritative. On the untouched holdout at
the calibrated threshold, the candidate reported:

- `metal_can`: precision `97.81%`, recall `82.46%`
- `pet_bottle`: precision `99.41%`, recall `53.43%`
- Reserved empty-machine frames: zero accepted detections, but only five
  distinct frames were available.
- The lighting stress suite still contained confident wrong-class results.
- PyTorch/ONNX parity had an unresolved machine-image mismatch.

Therefore the active file is usable for immediate diagnostics and owner testing
only. Do not interpret this override as evidence that the offline acceptance
targets or all-condition reliability requirements passed.

Historical evidence:

- Morning report:
  `Trash-detection/training/model1/reports/M1_REBUILD_MORNING_REPORT_m1rebuild_20260907_seed42_yolo11s_v4.md`
- Candidate manifest:
  `Trash-detection/training/model1/export/candidates/m1rebuild_20260907_seed42_yolo11s_v4/candidate_manifest.json`

## Verification performed after activation

- PC package manifest check: passed after the rebase; both Model 1 and the
  promoted remote Model 2 hashes match their manifest entries.
- Post-rebase PC tests: `20 passed, 5 failed`. The five failures are the
  remote baseline-parity/blank-fixture assertions against the intentionally
  activated failed Model 1 candidate; they are preserved as visible warnings,
  not suppressed.
- Jetson/runtime tests: `8 passed`.
- Model 2 training workflow tests: `15 passed`.
- One-frame Model 1 inference on `Trash-detection/validation/fixtures/m1_reference.jpg`: passed.
- One-frame full-workflow initialization with the promoted remote Model 2:
  passed; the seven-observation workflow reported `M1 1/7`.

No new camera acceptance session was run. No new holdout evaluation was run.

## Rollback

The pre-activation artifacts are retained locally under the ignored run
directory:

`Trash-detection/training/model1/runs/m1_user_override_20260908_failed_v4/`

The directory contains the old active Model 1, old canonical 640 export,
old labels, old default PC configuration, and old PC model manifest. Restore
those files with `Copy-Item -Force`, then run the package check and PC tests.
If the activation commit has been published, a normal `git revert` of that
activation commit restores the tracked metadata and documentation changes.

## Publication note

This override is intentionally isolated from the unfinished v5 audit/rebuild;
that second run was stopped and produced no activation artifact. A normal push
must still be possible before this override can be considered published. If
the remote `main` has advanced, do not force-push; preserve the local commit
and reconcile the branch explicitly.
