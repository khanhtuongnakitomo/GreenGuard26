# Final status: `FAILED_ACCEPTANCE`

- Candidate location: `Trash-detection/training/model1/export/candidates/m1rebuild_20260907_seed42_yolo11s_v4/m1_rebuild_640.onnx`
- Candidate test command: `powershell -ExecutionPolicy Bypass -File Trash-detection/training/model1/scripts/run_m1_rebuild.ps1 -Verify -RunId m1rebuild_20260907_seed42_yolo11s_v4`
- Completed epochs: `95/100`; training resumed from the valid epoch-74 checkpoint after the interrupted shutdown and stopped by Ultralytics patience. The best checkpoint was observed at epoch 75.
- Training supervisor elapsed time: `18,857.4 seconds` (`5h 14m 17s`), with zero recovery attempts. Evaluation, export, and verification completed afterward.
- Acceptance result: the candidate remains candidate-only and was not activated. Publication is blocked because `origin/main` advanced after the local run started; the local commit and remote head are recorded below.

## Acceptance evidence

Evaluation used 1,362 untouched holdout images and selected confidence `0.84` from the 1,220-image calibration partition. The minimum accepted area remained `0.02`.

| class | candidate precision | candidate recall | AP50 | AP50-95 | baseline precision | baseline recall | candidate TP/FP/FN |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| metal_can | 97.81% | 82.46% | 91.82% | 80.60% | 74.81% | 61.23% | 268 / 6 / 57 |
| pet_bottle | 99.41% | 53.43% | 81.48% | 58.51% | 99.06% | 5.58% | 1,005 / 6 / 876 |

Approximate Wilson 95% intervals are 95.31–98.99% for can precision, 77.95–86.21% for can recall, 98.71–99.73% for PET precision, and 51.17–55.67% for PET recall.

The candidate failed because can precision was below 98%, can recall was below 90%, PET recall was below 90%, and the stress suite contained wrong-class confusions. It did improve both classes' recall relative to the unchanged baseline. The five reviewed empty-machine frames had zero accepted detections, but five frames are insufficient to establish an operational false-positive rate.

Stress-suite recall and wrong-class results:

| case | can recall | PET recall | wrong-class confusions |
| --- | ---: | ---: | ---: |
| exposure 0.25 | 79.69% | 47.58% | 5 |
| exposure 0.45 | 81.85% | 51.46% | 4 |
| exposure 1.00 | 82.46% | 53.43% | 3 |
| exposure 1.60 | 79.38% | 42.74% | 13 |
| exposure 2.00 | 74.46% | 33.97% | 14 |
| blur 7x7 | 80.62% | 48.70% | 5 |
| bounded glare | 81.85% | 53.16% | 5 |

## Export and runtime verification

- ONNX output layout: `[1, 6, 8400]`, static FP32 at 640, batch one, without embedded NMS.
- Class metadata: passed; `0=metal_can`, `1=pet_bottle`.
- Rejected v7 hash protection: passed; the candidate is not one of the rejected v7 artifacts.
- PyTorch/ONNX parity: failed on the sampled machine capture case `007059_WIN_20260828_14_17_40_Pro.jpg`; ordinary samples matched closely, but the machine case had unmatched predictions and exceeded the confidence-difference limit.
- CPU benchmark: median `75.19 ms`, p95 `80.51 ms`, measured full-workflow rate `13.32 FPS`; the 5 FPS target was met.
- Active Model 1 remained SHA-256 `5069bfae324db8c1aef1fbce4b68aaad217a80a95a6f6b83eacfa60cdb620038`.
- Active Model 2 remained SHA-256 `d4c5f235fbb78e3a8451de695480400a916ffec235a518af47fd5b448c6eb999`.
- `production_touched=false`; the candidate configuration preserves the existing seven-observation/quorum workflow and unchanged Model 2 path.

## Dataset and presentation counts

- Source audit inventory: 23,628 images scanned from the selected Model 1 and whole-bottle Model 2 roots.
- Prior combined raw inventory: 22,624 Model 1 images plus 9,328 Model 2 images = 31,952 files; 26,951 distinct byte hashes across both folders.
- Audit target-level pool: 13,776 image records, comprising 13,771 eligible records and 5 reviewed negatives.
- Frozen generated base records: 7,064.
- Split: 3,656 train originals, 2,046 validation records, and 1,362 holdout records.
- Validation subdivision: 826 selection records and 1,220 confidence-calibration records.
- Frozen base instances: 3,248 metal-can instances and 7,865 PET instances.
- Negative images: 5 reviewed empty-machine images, all reserved in the holdout for this run.
- Dynamic augmentation: 3,656 unique training originals and 3,656 source presentations per epoch; augmentation creates no additional independent source images.

## Evidence still missing or invalidated

- No owner camera acceptance session was performed. The required fresh sessions with at least ten cans and ten PET bottles in normal, bright, and dim conditions remain outstanding.
- The five empty-machine scenes are not enough for an operational false-positive estimate, and no broader empty-machine capture group was measured.
- The 16 eligible `dataset-live` can frames were split across train, validation, and holdout in the frozen v4 manifest because the machine-sequence grouping correction was made after this run was prepared. The implementation now keeps the machine sequence atomic and reserves it for holdout, but this candidate must not be treated as independent machine evidence.
- The 111 part-only machine-label images remain excluded because they do not contain reviewed whole-object boxes.
- Dataset-1 numeric can classes 3 and 4 were visually reviewed after the v4 audit was frozen, so those 53 unique source images and 92 can instances are not represented in this candidate. A fresh audit/prepare/train run is required to include them.
- Dataset-1 classes 0–2, dataset-6 ambiguous metal/food-tin rows, unreviewed empty labels, and component-only cap/label/ring rows remain excluded or quarantined.
- The lighting suite is synthetic exposure/blur/glare only. Real camera darkness, saturation, reflections, hands, PP cups, and machinery were not independently measured; the synthetic stress suite already produced wrong-class confusions.

## Reproduction and morning guide

The complete testing and rollback guide is in `Trash-detection/training/model1/M1_REBUILD_RUNBOOK.md`. It contains commands to verify candidate hashes and class metadata, run a saved image, run the real camera, run the candidate M1 plus unchanged M2 workflow, compare the candidate with the baseline on the same clip, and return to `--config default`.

The candidate configuration is intentionally available for diagnostics but remains `FAILED_ACCEPTANCE`; selecting it does not activate it or change the active model files. Do not promote it until a future candidate passes offline gates, parity, and the fresh owner camera session.

## Publication

- Verified pushed commit: `NOT_PUSHED — origin/main advanced to f8810a8265e8b6b1a37156b2c9b8a8333bf23adf; no force-push or implicit merge was performed`
- Local publication commit: `c184f5c4b2a75b6f5f6ddf9ddc98f0c23d02bff4`
- Source reports: `Trash-detection/training/model1/logs/rebuild/m1rebuild_20260907_seed42_yolo11s_v4/`
- Frozen manifest: `Trash-detection/training/model1/dataset/generated/m1rebuild_20260907_seed42_yolo11s_v4/manifest.json` (local evidence; bulk generated data is not intended for Git)
- Local checkpoint: `Trash-detection/training/model1/runs/m1rebuild_20260907_seed42_yolo11s_v4_batch16/weights/best.pt`, SHA-256 `5c29271a4e7393e522d11344f9c6ff51a7d052d8234c6394a64d8765a0a60dc7`
- Candidate ONNX SHA-256: `cf7baf1c4a917c7f8ecbd1e30bf92ca5e3a38869b99ccbfb6b94a0b95111eb24`
