# Model 1 quick fine-tune report

Final status: `FAILED_ACCEPTANCE_ACTIVE_OVERRIDE`

The candidate is active because the requested always-replace policy permits a
structurally valid, runtime-loadable export even when measured quality gates
fail. It is not `PRODUCTION_READY` and still requires a fresh physical-camera
session.

## Artifact and rollback

- Active ONNX: `Trash-detection/pc-demo/models/m1_detect_640.onnx`
- Active SHA-256: `58e6d6d4492554913a4105ff2a3f7f961acf77f970016803561b7eed2b50a852`
- Previous active SHA-256: `4945d6a406bfbdb0ef58290c93e4f56af8797B21C957003ED15A6B172C94D8E6`
- Candidate: `Trash-detection/training/model1/export/candidates/m1quickft_20260909_seed42_r1/m1_machine_quick_640.onnx`
- Candidate SHA-256: `58e6d6d4492554913a4105ff2a3f7f961acf77f970016803561b7eed2b50a852`
- Rollback snapshot: `Trash-detection/training/model1/logs/rebuild/m1quickft_20260909_seed42_r1/activation_backup`
- Rollback: copy the snapshot `m1_detect_640.onnx`, `default.json`, and `manifest.json` back to their corresponding `pc-demo` paths.

The source checkpoint was `AF2B6D2B11565F42D0C5C33CDE8A0EF8236A1F8F46896DF5AA251F0AA80597E7`.
The corrected run used its weights with `resume=false`; the optimizer and epoch
state were not resumed. A first recovery attempt exposed and preserved a
runner bug where `pretrained=false` discarded the loaded checkpoint and created
random weights. That path was not activated. The corrected run used
`pretrained=true` while retaining `resume=false`.

## Data and training

- New-data audit: 37/37 admitted; 8 cans, 27 PET bottles, 2 negatives.
- Frozen replay records: 3,340 train, 8 selection, 2,071 calibration, 1,396 holdout.
- Replay role pool: 8 new-can, 21 new-PET, 16 old-machine-can, 78 old-machine-PET,
  1,858 generic-can, 1,355 generic-PET, and 4 negatives.
- Class instances across the frozen prepared manifest: 3,356 metal-can and
  7,115 PET-bottle boxes.
- Epoch sampler: 768 presentations with the configured 64/96/80/80/208/208/32
  role quotas; deterministic trace retained in the run log.
- Smoke: 1 epoch, batch 16, completed.
- Phase A: 4 epochs, batch 16, completed.
- Phase B: 16 epochs, batch 16, completed.
- Total recorded wall time from preflight start to activation: approximately
  52 minutes. The run did not use OOM recovery.

## Measured quality

Selected independent class thresholds from calibration were:

- `metal_can`: `0.81`
- `pet_bottle`: `0.72`

At those gates:

- New-data can: 1/8 accepted correctly; 0 wrong-class accepted.
- New-data PET: 10/27 accepted correctly; 0 wrong-class accepted.
- White-label PET holdout: 1/6 accepted correctly.
- New negatives: 0/2 accepted detections.
- Old holdout can: precision 99.67%, recall 89.22%, AP50 93.94%, AP50–95 83.80%.
- Old holdout PET: precision 97.73%, recall 75.41%, AP50 84.56%, AP50–95 63.71%.
- New can/PET workflow replay: only the green-PET group reached a 4-of-7
  PET quorum; can and clear-PET groups abstained. No early result was emitted.

The principal acceptance failures are new-machine confidence/domain coverage,
white-label PET generalization, PET precision/recall on the old holdout, and
ONNX parity. The compact selection partition contains only eight images and is
not sufficient to establish broad machine performance.

## ONNX and protected artifacts

- ONNX output: `[1,6,8400]`, static FP32, batch one, no embedded NMS, labels
  `metal_can`, `pet_bottle`.
- Runtime load: passed with ONNX Runtime CPUExecutionProvider.
- Parity: failed on 4/9 representatives. There were accepted-class mismatches
  where PyTorch abstained but ONNX accepted, and one matched PET case had IoU
  0.862 and confidence delta 0.0202. This is retained as a required follow-up.
- PC Model 2 unchanged: `2DF4C7986ADCE3262686842DC751AFBEAE14BD6C059C794926E3A5872BE62FA7`.
- Jetson Model 2 unchanged: `FDA4C7986ADCE3262686842DC751AFBEAE14BD6C059C794926E3A5872BE62FA7`.

## Verification

- Quick fine-tune and rebuild tests: 36 passed.
- PC suite: 43 passed and the same five pre-existing Model 1 parity failures
  remained. No additional PC failure appeared.
- Physical camera-1 test: `NOT_MEASURED`.
- Physical RVM USB routing: `NOT_MEASURED`.
- Starting commit: `5c9b1f5ed4026a9c6e35953083d4a04e03c780f7`.

Operator test command:

```powershell
D:\Code\Project\bki\GreenGuard26\Trash-detection\demo_model1.bat
```

Do not call this candidate production-ready until a fresh session tests at
least three distinct cans, three distinct PET bottles, and empty-machine
periods under normal, bright, and dim lighting, and the ONNX parity mismatch
has been resolved or explicitly accepted with evidence.
