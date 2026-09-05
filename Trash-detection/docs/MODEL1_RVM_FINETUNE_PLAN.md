# Model 1 RVM specialization — execution contract and result

Date: 2026-09-06. Status: EXECUTED CANDIDATE; production promotion was not authorized.
Executor after approval: GPT-5.6 Luna, reasoning High.
Branch: `plan/model1-rvm-finetune`, created from `f70f4e50`.

## Owner amendment — 2026-09-06

The owner authorized execution and narrowed the Model 1 contract to exactly two
outputs: `metal_can` (class 0) and `pet_bottle` (class 1). PP cups are not a
candidate class, are not emitted by the candidate head, and are never forwarded
by the public workflow. This amendment supersedes the earlier three-class and
“plan only” wording below. The existing production packages remain unchanged;
the work below produced a candidate only and still requires the acceptance gates
in Section 9 before any deployment or merge.

Because the live machine labels are Model 2 part OBBs rather than whole-object
HBBs, the executed workflow generated a clearly marked, provenance-preserving
candidate manifest: direct can conversion, conservative PET part unions, and a
high-confidence detector fallback. A reviewed manifest remains the preferred
source and overrides the derived one. Derived labels are evidence for this
experiment, not an assertion that the source annotations are ground truth.

Execution result: run `m1rvm_20260906_seed42_n640_two_class_v7` completed under
the report-only watcher, exported valid two-class 640/416 ONNX candidates, and
failed the acceptance gates because can and PET recall/precision were not good
enough. It is therefore `FAILED_ACCEPTANCE` / `production_ready=false` and was
not copied into any production directory.

## 1. Owner objective and authorization

Improve whole-object aluminum-can versus PET-bottle detection in the fixed RVM camera, particularly reflective steel, specular glare, transparent PET, bright backlighting, and dim exposure. Make real machine images the dominant training signal; expand training with controlled augmentation and suitable legacy replay. Preserve production routing while evaluating a two-class candidate head.

The owner subsequently authorized the bounded candidate workflow on this branch,
including implementation, fine-tuning, evaluation, and candidate export. That
authorization did not approve production replacement, merge, or modification of
unrelated processes. No production artifact was changed.

No workflow can guarantee no crash. The required outcome is bounded failure recovery, durable progress, and an honest morning result even if a run cannot complete. Do not loosen acceptance gates to make a run appear successful.

## 2. Verified starting facts and unresolved inputs

- Live root: `Trash-detection/training/model1/dataset/incoming/live-machine-dataset`.
- GG1 contains 56 extracted JPGs and 56 annotation TXT files. GG2 contains 55 of each: 111 extracted images total. Archives are also present; their additional/duplicate contents have not been audited or extracted.
- All 178 nonempty annotation rows inspected have nine fields, consistent with OBB class plus four vertices, not five-field HBB labels.
- GG1 manifest: `0=cap, 1=label, 2=ring, 3=can`. Row counts: 48 cap, 14 label, 13 ring, 8 can.
- GG2 manifest: `0=label, 1=cap, 2=ring`. Row counts: 23 label, 55 cap, 17 ring.
- These are primarily Model 2 part annotations. Counts above are annotation counts, NOT independently confirmed whole-object image counts. There is no PET whole-object class in either manifest. Do not repurpose cap/label/ring boxes as bottle boxes or automatically infer bottle class from a part label.
- Two representative real frames were viewed: a labelled transparent PET and a clear unlabelled PET, in reflective steel with bright lower backlighting, tilted horizontal objects, and large exposure differences. This is not a completed review of all 111 images or proof of balanced lighting/classes.
- Active Model 1 checkpoint: `training/model1/imported/bki_dt3_three_class/best.pt` (paths in this document relative to Trash-detection when starting with training/). Its SHA-256 was verified as `145C7F829FC7DC450CB2A9490E585FFC0763B054B3CD3F26E3F2EE24F28F2957`.
- Task: `detect`; production checkpoint is three-class, while the candidate head
  is explicitly rebuilt as `0=metal_can, 1=pet_bottle`. Determine the actual
  backbone from the loaded checkpoint; do not infer YOLO architecture from
  directory names or switch architectures silently.
- PC uses `m1_detect_640.onnx`; Nano B01 uses `m1_detect_416.onnx`. PC inference floor 0.05, decision floor 0.65, minimum area 0.02. PP cup is ignored before selecting the highest-confidence visible object. The current Nano lacks the separate PC decision floor; leave that independent issue explicit.
- Legacy model1 `scripts/train.py` is a TWO-class OBB trainer with workers=4; `dataset/dataset.yaml` also points to the older Detection-rebuild tree. Neither is the correct entry point for this HBB fine-tune.
- GPU inspected: RTX 3060, 12 GB VRAM. Available memory is transient and must be checked again before execution.

Primary blocker: reviewed whole-object HBB annotations and sufficient independent can/PET/negative capture groups are not yet established. Preparation can progress, but unattended training must fail preflight if these inputs remain missing.

## 3. Files to implement after approval

Under `Trash-detection/training/model1/` create:

- `config/m1_rvm_finetune.yaml`: immutable run settings, sources, class maps, split rules, augmentation, time/retry budgets and acceptance gates.
- `scripts/m1_rvm_common.py`: canonical records, path resolution, hashing, checkpoint/label validation, atomic status writing.
- `scripts/audit_m1_rvm.py`: extracted/archive inventory without modifying inputs; pair checks, duplicate groups, coverage, annotation-review exports.
- `scripts/prepare_m1_rvm.py`: reviewed HBB ingestion, frozen group split, bounded augmentation, legacy replay, provenance manifest.
- `scripts/train_m1_rvm.py`: separate HBB trainer using the supplied checkpoint and configuration.
- `scripts/evaluate_m1_rvm.py`: baseline/candidate inference and deployment-threshold scoring, regression/confusion/stress reports.
- `scripts/export_m1_rvm.py`: candidate-only ONNX and model contracts at 640/416.
- `scripts/run_m1_rvm_finetune.ps1`: phase runner with distinct audit, prepare, smoke and full modes.
- `scripts/watch_m1_rvm.py`: local supervisor independent of agent availability, process identity, heartbeat, bounded recovery.
- `tests/test_m1_rvm_workflow.py`: meaningful leakage, remap, geometry, failure, recovery and export-contract tests.
- A small update to the model1 README describing the new HBB workflow and artifact locations.

Use run ID `m1rvm_<actual-start-date>_seed42_n640`; never overwrite an earlier run. Generated data, status, exports and reports go under ignored run-specific locations: `dataset/generated/<run>/`, `logs/rvm/<run>/`, `runs/<run>/`, `export/candidates/<run>/`. Verify ignore rules before writing. Keep reviewed authoritative labels and source manifests in a separate auditable annotation package; archive/hash them with the run. Git ignore is not a backup strategy.

Reuse and adapt existing manifest/hash, candidate, pytest and report patterns. Inspect Model 2 utilities before reusing functions: their class/OBB assumptions are incompatible with M1. Do not change shared M2 code or reuse its hardcoded watcher output paths.

## 4. Phase A — establish valid data before overnight operation

1. Record Git HEAD/status, configuration digest, Python/Ultralytics/PyTorch/CUDA versions, GPU, free disk/RAM, and checkpoint hash. Snapshot hashes of both active M1 and M2 packages and manifests, plus locked-test source manifests. Refuse unrelated dirty changes that overlap planned files.
2. Inventory images and ZIP member lists read-only. Distinguish extracted images from archive duplicates using content hashes; never count ZIP copies as new data. If approved preparation extracts archives, enforce safe relative member paths into a new staging location and deduplicate. Audit every source label schema and class map independently.
3. Build a full contact-sheet review and annotation queue. Whole-object HBB labels must enclose visible physical can/bottle/cup extents; do not annotate reflected duplicates in the steel as separate inserted objects. Mark extreme occlusion/uncertain material for review. Annotate every relevant real object in accepted training frames.
4. For production-quality data, model-assisted boxes are proposals and a
   reviewer must approve/correct classes and geometry before ingestion. The
   authorized v7 candidate additionally permitted a conservative, explicitly
   marked fallback so the run could be measured; teacher confidence and part
   unions remain non-ground-truth evidence and block promotion. Review all can
   class-3 records too.
5. Emit YOLO detect rows `class cx cy width height` normalized to [0,1], finite and positive, from reviewed whole-object boxes. Convert legacy OBB to enclosing HBB only for verified WHOLE-object OBB annotations with known maps. Invalid source coordinates require quarantine, not silent clipping. Clipping during a documented geometric augmentation is a separate controlled operation.
6. True negative labels may be empty only after explicit review confirms no can/PET/cup. Missing labels are not negative labels. Preserve labelled PP cups as class 2, not empty scenes, because confusing them with PET must be tested.
7. Collect additional real captures if coverage is deficient. Target at least 3 independent sessions per target class, ideally 20+ different physical examples per class, with labelled/unlabelled/crushed PET and plain/printed/dented cans; capture shiny/bright, normal and dim cases. Include empty machine, reflections, hands/partial insertion and PP cups. These are collection targets, not counts currently available.
8. Preflight minimum for a trainable experiment: reviewed can and PET examples in train/validation/holdout with at least 3 independent object/session groups per class overall and no split lacking a class; reviewed negative groups in each split. If impossible, finish audit/preparation artifacts and stop as NEEDS_DATA. Synthetic variants cannot satisfy these independent-group requirements.

All ambiguous material, missing boxes, label approvals or coverage blockers must be resolved while the owner is awake if an overnight training run is expected. Do not ask questions unattended and then guess the answer.

## 5. Phase B — split before augmentation and establish baseline

- Group by physical item identity plus capture session/sequence, exact image hash and conservative near-duplicate similarity. Timestamp gaps are aids, not proof that the bottle changed. Merge groups when uncertain. Keep the same physical item and its near-adjacent frames in one split even if file paths differ.
- Proposed split is 70/15/15 by groups, balancing can/PET/negative coverage and real lighting conditions where possible. Existing GG1/GG2 labels do not establish sufficient independent sessions; report feasibility instead of forcing those percentages.
- Freeze validation/holdout image IDs, reviewed labels, hashes and group membership before generating variants. Never train on backgrounds, crops, histogram targets, synthetic derivatives or teacher outputs sourced from evaluation frames. Use only training originals to estimate augmentation appearance.
- Keep existing locked tests immutable. Audit whether their two-class OBB labels represent whole objects. If needed, create an external HBB evaluation view with explicit `bottle -> 1`, `aluminum -> 0` mapping and unchanged source files; do not score current three-class predictions against an unconverted legacy class order.
- Inventory available legacy whole-object datasets and their permissions/provenance. Select class-balanced, source-diverse training replay with matching semantics; exclude any duplicates/siblings of all evaluation sets. Do not blindly use M1's old partially-labelled sources.
- Run active PC ONNX baseline on reviewed machine validation, then reserve final holdout for the final candidate comparison. Record per-class recall/precision, can-to-PET and PET-to-can errors, background false positives, area-filter drops, confidence-threshold drops, and localization failures. Run a diagnostic threshold curve without modifying production settings. This distinguishes domain failure from an overly restrictive decision floor.

## 6. Phase C — controlled dataset expansion

Goal: approximately 70% of training sampling exposure from real-machine originals/variants and 30% from audited legacy replay. Report sampling exposure, unique originals, independent groups and materialized variants separately. Limit class imbalance through group-aware sampling; many photos of one bottle must not dominate.

For each machine TRAIN original, retain the original and create at most ten deterministic variants, each generated directly from that original (never augment an augmented image):

1. Dim exposure/gamma: brightness multiplier 0.55–0.85, gamma 1.15–1.65, mild sensor noise.
2. Bright exposure: multiplier 1.10–1.40, modest highlight roll-off/clipping, preserving recognizability.
3. Local glare: smooth low-opacity highlight/veiling field and mild contrast loss, consistent with reflective steel. Keep at least 70% of the annotated object visually informative; reject severe obliteration.
4. Cool/warm white balance plus mild contrast/saturation variation: channel gains 0.90–1.10, saturation 0.70–1.10.
5. Camera degradation: JPEG quality 65–95, mild noise (roughly 1–6/255), directional motion blur kernel 3–5 px at native image size, or slight defocus.
6. Small geometry with mild exposure variation: rotation within +/-7 degrees, translation within 3%, scale 0.90–1.10 and very mild perspective. Transform all four HBB corners, re-enclose and clip; reject if remaining box visibility <80% or dimensions degenerate. Preserve actual sensor framing/aspect ratio before letterboxing.

Use a documented gamma convention; report actual output luminance and clipped-pixel distributions rather than trusting parameter names. Inspect stratified rendered image+box samples for both classes and every transform. Proposed ranges are starting bounds; narrow them if train-frame statistics show unrealistic results. Record every rejected variant and seed. Apply zero geometric transforms to empty fixed-camera backgrounds by default.

For legacy TRAIN originals, create at most two direct variants by default. Legacy
images containing a can may receive up to eight direct variants to counter the
small verified can pool, while group-level splits and source provenance remain
unchanged. Keep an untouched replay portion to resist forgetting. Simple color
transfer cannot reproduce RVM geometry or transparent PET optics: do not claim
domain equivalence. Do not paste rectangular cutouts or invent segmentation
masks. Background compositing is deferred unless reviewed object masks and
TRAIN-only empty backgrounds are available.

Disable mosaic, MixUp and copy-paste for this first experiment. Disable vertical/horizontal flips initially because the camera geometry and lighting are fixed. Keep online geometry/HSV near zero when offline augmentation already supplies variation. Cap materialized dataset at 3,000 images initially, reducing legacy sampling to preserve 70/30 exposure rather than inflating the tiny live set to meet a count. Final count is computed only after audit/split; do not promise thousands of independent examples.

## 7. Phase D — training configuration and resource budget

- Start from the verified imported M1 checkpoint, task=detect, and rebuild the
  candidate head for exactly `metal_can`/`pet_bottle`. Preserve the backbone and
  detection task; no OBB model, classifier stage, or new pretrained download.
- Default image size 640, seed 42, workers=0, disk cache only after disk-space estimate, AMP enabled only after smoke validation, optimizer AdamW, initial LR 0.0001, weight decay 0.0005, warmup 3 epochs, cosine LR, batch 8 initially on RTX 3060 12 GB.
- Max 60 epochs, early-stop patience 12, checkpoint each epoch. Do not tune against final holdout. Use validation to select best checkpoint; report actual architecture, parameters, batch, LR and all library-resolved settings.
- No multi-scale, mosaic, mixup or copy-paste; flips zero. Use deterministic=True if supported by the verified environment. If unsupported deterministic operations fail, record the incompatibility and stop or apply an explicitly documented minimal fix before launch; never claim reproducibility solely from seed.
- First run import/config/label tests, then a one-epoch 640 smoke using both classes and negatives. Smoke must have finite losses and metrics and produce a reloadable checkpoint. Smoke is separate from the full run and cannot be selected as final model.
- Budget: at most 8 hours for the approved execution window, including implementation/preparation. Reserve at least 90 minutes for evaluation/export/reporting. Full trainer budget at most 5 hours and limited further by remaining time after measured smoke throughput. If preflight/implementation consumes the window, report READY_TO_TRAIN or BLOCKED instead of starting an unfinishable run.
- This is one candidate experiment, not an unattended hyperparameter sweep. If it fails acceptance, report the failure and preserve evidence; do not train repeatedly on holdout feedback.

## 8. Overnight supervision, persistence and recovery

Implement and test supervision BEFORE the full run. It must keep working if the agent hits a usage limit or disconnects. Launch a local runner/supervisor with hidden windows and durable stdout/stderr logs. Store PID plus process start time, executable and run directory to prevent PID-reuse mistakes. One GPU trainer for this run at a time; if another training job owns the GPU, wait within the budget or stop as RESOURCE_BUSY.

- Poll locally every 60 seconds; write heartbeat/status atomically at least every minute. Track phase, PID identity, epoch, results.csv row count AND mtime, log bytes/mtime, checkpoint mtime, GPU utilization/memory/temperature, free disk and elapsed budget.
- Allow first-epoch/cache initialization grace of max(20 minutes, 3 times the measured smoke/first-epoch duration). A frozen metric is not a stalled process. Suspect hang only after no progress in all progress signals for max(15 minutes, 3 recent median epoch durations), then confirm across three polls. GPU-idle alone is not sufficient.
- Default suspected-hang behavior is report-only: mark HANG_SUSPECTED, preserve diagnostics and avoid launching another trainer while the first is alive. Optional kill-on-confirmed-hang requires explicit owner opt-in before bedtime and must target only the verified process tree for this run. Do not infer this opt-in from general overnight approval.
- For an exited CUDA OOM, permit one retry at batch 4, then one at batch 2, only after confirming the prior process exited. Load a valid last checkpoint as warm-start when changing batch; distinguish warm-start from optimizer-state resume. Do not silently change image size or model architecture. Maximum two training restarts across all failure types.
- For a transient exited process with valid last checkpoint, unchanged config/environment and remaining budget, permit one exact resume. Verify whether the installed trainer actually honors overridden resume settings. A corrupt checkpoint must be preserved and reported; use the preceding validated periodic checkpoint only with explicit provenance. Never restart silently from scratch late in the night.
- For NaN losses, malformed labels, inconsistent class maps, invalid paths or out-of-disk: stop and report with the offending record and logs. Do not fabricate label repairs, auto-delete datasets, upgrade packages mid-run, lower gates, or switch training sources.
- Detect normal patience/time-limited termination using exit code, final trainer status and checkpoint reload, not merely fewer than 60 epochs. Mark interrupted/incomplete phases honestly.
- Before unattended launch, verify AC power and sufficient free disk for generated images, cache and checkpoint budget plus 10 GB margin. Use a scoped Windows keep-awake request while the runner lives; release it on exit. Do not change permanent power settings. Screen lock is acceptable; sleep/hibernation pauses compute.
- Agent communication should stay quiet while progress is healthy, notify meaningful completion/failure/action needed, and never depend on rapid agent polling. Test watcher restart against an already-growing CSV, OOM restart budget, PID reuse, missing GPU telemetry, graceful completion and simulated stall with fake processes before the long job.

## 9. Phase E — evaluation and candidate acceptance

Evaluate the unchanged baseline and final selected candidate with the SAME preprocessing, canonical labels, split, IoU matching and thresholds. Report raw detection at 0.05 and public workflow at 0.65 after 2% area/PP filtering; match HBB predictions to ground truth one-to-one at IoU >=0.50. Distinguish misses, wrong material and incorrect localization. AP50/AP50-95 alone are insufficient.

Proposed gates for owner review (freeze before execution):

- On untouched real machine holdout: each target class precision and recall >=0.90; macro recall improves >=0.05 absolute over baseline unless baseline already >=0.95, in which case require no regression; neither class recall/precision may regress >0.02 absolute.
- Can/PET cross-confusion <=2% of ground-truth target objects, with numerator/denominator and errors listed. For small sets, report exact counts and confidence intervals; one error can exceed the target.
- Real bright and dim slices: per-class recall >=0.85 where at least 10 independent examples from >=2 groups exist. If coverage is insufficient, mark gate UNVERIFIED and promotion blocked, not passed on synthetic images.
- Empty-machine false positives at public threshold <=1% on >=100 real reviewed frames from >=3 capture sessions; report group correlation and interval. Fewer samples can support exploration but cannot establish this gate. No PP-to-PET/can visible routing in reviewed PP regression fixtures; PP coverage absent means UNVERIFIED.
- Audited legacy regression set: per-class AP50 and public recall decrease <=0.02 absolute. If no trustworthy legacy set is available, explicitly block a generalization claim.
- Synthetic stress suites (derived from evaluation originals only after freezing them and never fed to training): recall drop <=0.10 relative to corresponding originals, report per transform; synthetic robustness is supplementary to real bright/dim evidence.
- Replayed real sequences where available: count stable correct decisions, false triggers, misses and time to correct decision; do not fabricate temporal evidence by repeating one still frame. Without real sequences, test routing synthetically and mark real temporal acceptance pending.

A failed or unverified gate leaves the candidate available for inspection but `production_ready=false`. Distinguish successful training, successful export and successful acceptance.

## 10. Phase F — export, parity and immutable production

Export the selected checkpoint into the candidate directory only: fixed batch 1 ONNX FP32 at 640 and 416, using the same tested export options as current M1. Validate inputs `[1,3,S,S]`, two class channels and six output channels; compare output orientation explicitly rather than assuming it. Preserve class order and avoid double sigmoid.

Compare checkpoint and candidate ONNX predictions on all small reviewed validation sets plus blank/PET/can/PP/reflective fixtures: identical routing decisions, box IoU >=0.95 for matched objects, confidence difference <=0.001 away from threshold ties. Report borderline/NMS differences; do not relabel a failed parity run as passed. Measure warmup-separated PC p50/p95 inference over repeated fixed fixtures, require p95 <=1.10 times baseline on the same host and account for the 5 FPS full-workflow budget separately.

Use isolated candidate configuration and the existing supported PC app/launchers; preserve production default.json and Model 2 paths/settings. Run meaningful tests for low-confidence suppression, can skips M2, PET invokes M2, PP cannot dominate top-1, empty frame and missing-object behavior. Nano/Orin device FPS, TensorRT build, camera and physical routing remain target-device checks, not host claims.

Rehash active M1, active M2, manifests, locked source datasets and runtime defaults at completion. Any unexpected change is a task failure. Do not invoke package_models.py in write mode or promote_model1.py. Candidate export is not promotion. A separate approved deployment step will back up active artifacts, invalidate stale TensorRT engines and verify rollback.

## 11. Expected commands after implementation (not existing commands today)

From `D:\Code\Project\bki\GreenGuard26\Trash-detection\training\model1`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_m1_rvm_finetune.ps1 -AuditOnly
powershell -ExecutionPolicy Bypass -File scripts\run_m1_rvm_finetune.ps1 -PrepareOnly
powershell -ExecutionPolicy Bypass -File scripts\run_m1_rvm_finetune.ps1 -Smoke
powershell -ExecutionPolicy Bypass -File scripts\run_m1_rvm_finetune.ps1 -Overnight -MaxHours 8
```

The runner derives the immutable-source candidate manifest before preparation when
no reviewed manifest exists, then refuses training if the derived/reviewed
two-class manifest or frozen split fails validation. Audit/prepare/smoke modes
must not accidentally fall through into full training. Use the existing
`training/model1/.venv/Scripts/python.exe`; no environment installs or changes
without first establishing they are needed and recording the exact change.

## 12. Luna execution handoff and morning deliverable

After explicit approval: read this entire document and owner amendments, verify
the branch, implement the minimal workflow and tests, perform audit/preflight,
then execute only the phases whose inputs pass. Keep progress in local files.
Do not delegate or change production model automatically. If annotations/data are
missing, either stop before training (the production-safe path) or, only when
the owner has explicitly authorized an exploratory candidate as in v7, preserve
the derived-label provenance and keep promotion blocked. Respect the overall
deadline and bounded recovery limits.

Write `logs/rvm/<run>/MORNING_REPORT.md` plus machine-readable status with:

- Final state COMPLETE_CANDIDATE / FAILED_ACCEPTANCE / NEEDS_DATA / RESOURCE_BUSY / INTERRUPTED and the exact reason.
- Git commit, changed files, source/config/split/environment hashes, annotation provenance and quarantined records/reasons.
- Original and independent-group counts by class/split/lighting, negative coverage, generated variant counts, replay ratios and evidence that splits do not leak.
- Baseline versus candidate metrics and per-class confusion at the actual public threshold; every gate PASS/FAIL/UNVERIFIED, denominators and representative errors.
- Phase durations, epochs, best epoch, retries, monitoring events, last/best checkpoint paths, candidate hashes, export/parity/latency results and tests.
- Proof production M1/M2 and locked inputs remained unchanged; exact candidate webcam command; target-device follow-up and rollback plan for a separately approved promotion.
- If interrupted: next safe command, last completed phase and valid checkpoint, without claiming overnight success.

Before the owner goes to sleep, the full-run readiness checklist must already pass: reviewed whole-object annotations, sufficient group coverage, frozen splits, valid baseline checkpoint, smoke and supervisor tests, AC/keep-awake/disk checks, and remaining evaluation time. If readiness fails, the overnight deliverable is the blocker report, not an improvised training job.
