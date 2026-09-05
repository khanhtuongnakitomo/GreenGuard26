# Model 1 RVM fine-tune result

Run: `m1rvm_20260906_seed42_n640_two_class_v7`  
Branch: `plan/model1-rvm-finetune`  
Date: 2026-09-06  
State: `FAILED_ACCEPTANCE` (`production_ready=false`)

## Contract

The candidate has exactly two detection classes:

| ID | Class |
|---:|---|
| 0 | `metal_can` |
| 1 | `pet_bottle` |

PP cups are not present in the candidate label map or output head. The current
public workflow already ignores PP cups before selecting a visible result, and
no production runtime/model file was changed by this run.

## Data and preparation

- Live-machine source: 111 images, treated as immutable.
- Conservative derived live records: 80 object rows (8 can, 72 PET), with 31
  frames skipped because no sufficiently reliable whole-object box could be
  derived.
- Legacy derived records: 1,144 object rows.
- Combined manifest: 1,224 object rows (456 can, 768 PET).
- Materialized dataset: 2,884 train images, 191 validation images, 57 test
  images; 245 test instances.
- Split groups were kept intact. Can coverage was distributed across three
  independent groups; PET coverage across nine groups.
- Source labels were not edited. Derived records retain source path/hash,
  derivation method, dataset kind, lighting and sequence/session provenance.

The live annotations are Model 2 part OBBs, not reviewed whole-object HBBs.
The run therefore remains an exploratory candidate: direct can conversion,
conservative PET part unions and a high-confidence legacy-detector fallback are
not a substitute for reviewed whole-object machine labels.

## Training and export

- Imported checkpoint was unchanged: SHA-256
  `145C7F829FC7DC450CB2A9490E585FFC0763B054B3CD3F26E3F2EE24F28F2957`.
- Training completed normally under the report-only watcher at epoch 19 after
  patience stopping; no OOM retry, hang kill or crash recovery was needed.
- Candidate checkpoint:
  `training/model1/runs/m1rvm_20260906_seed42_n640_two_class_v7/weights/best.pt`
- Candidate checkpoint SHA-256:
  `6f519367def2ef7d78ba7e77c947f18f7c5df795a743f5df1800a2123f6e66db`
- 640 ONNX output shape: `[1, 6, 8400]`; SHA-256
  `2485795BCED1E0696FAD523BC11EC3C92F2FFE5D353E94CA8D951DEDC4307CC8`.
- 416 ONNX output shape: `[1, 6, 3549]`; SHA-256
  `223033D49809B870EEBDB66F5885AC547A7C850CA1D4A4C995AC87F2FA927701`.
- Both exports use input shape `[1, 3, S, S]` and six output channels
  (`4 box channels + 2 class channels`).

## Acceptance evidence

On the frozen candidate test split, the candidate measured:

| Class | Precision | Recall | AP50 | AP50-95 |
|---|---:|---:|---:|---:|
| `metal_can` | 0.0502 | 0.2500 | 0.0264 | 0.0156 |
| `pet_bottle` | 0.6678 | 0.2658 | 0.2778 | 0.1519 |
| Overall | 0.3590 | 0.2579 | 0.1521 | 0.0837 |

These results fail the required per-class precision/recall and real-machine
stress/empty/temporal gates. The baseline comparison was diagnostic only: the
active baseline is a three-class model evaluated against the candidate two-class
labels, so it is not a production promotion proof. No candidate was copied into
`pc-demo/models`, `jetson-runtime/models`, or any other active package.

## Next safe action

Capture and review more real machine examples, especially complete can bodies
and complete PET bottles in bright reflective and dim conditions. Produce a
reviewed two-class HBB manifest with whole-object geometry, then rerun the same
grouped split and acceptance procedure. Keep this candidate for inspection, but
do not merge, deploy or route it to the RVM until all real-data gates pass.

Detailed machine-readable evidence is under the ignored run directory:
`training/model1/logs/rvm/m1rvm_20260906_seed42_n640_two_class_v7/`.
