# GreenGuard26 Documentation Map

Use this file to choose documentation by task. Do not read every document in
the repository as project instructions: some files are component-specific,
historical evidence, model metadata, or generated logs.

## Read First For Detection Work

1. `AGENT_HANDOFF.md` - current operating context, active Model 2 line, and
   explicit owner-approval boundaries.
2. `Trash-detection/docs/MODEL_CONTRACT.md` - model inputs, OBB output layout,
   preprocessing, gate defaults, and validation tolerances.
3. `Trash-detection/docs/ARCHITECTURE.md` - runtime boundaries and the M1 to
   classifier to PET-only M2 flow.
4. `Trash-detection/README.md` - repository layout and top-level commands.

Code and checked-in runtime configuration are the source of truth when they
disagree with prose. Check `git status` and `git branch -vv` for branch state;
this document does not define the current branch.

## Read Only For The Component You Change

- PC runtime: `Trash-detection/pc-demo/README.md`
- Jetson deployment: `Trash-detection/jetson-runtime/README.md` and
  `Trash-detection/jetson-runtime/DEVICE_VALIDATION.md`
- Model 1 training: `Trash-detection/training/model1/README.md` and
  `Trash-detection/training/model1/docs/ANNOTATION.md`
- Model 2 training: `Trash-detection/training/model2/README.md`
- Runtime parity: `Trash-detection/validation/README.md`
- Dashboard work only: `Dashboard/README.md`, then the scoped instructions in
  `Dashboard/frontend/AGENTS.md` and `Dashboard/frontend/CLAUDE.md`

## Current Model 2 Training

Model 2 V6 is the current documented training line. From
`Trash-detection/training/model2/`, use:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_m2_v6_training.ps1 -Smoke
powershell -ExecutionPolicy Bypass -File scripts\run_m2_v6_training.ps1
```

The V6 script creates candidate ONNX exports. It does not authorize promotion
to the PC or Jetson runtime model directories.

## Historical Or Non-Instruction Material

- `Trash-detection/docs/archive/` is archived conversation and planning
  material. It is not a current implementation contract.
- `Trash-detection/training/model1/reports/` contains dated training evidence,
  not current product behavior or task instructions.
- `Trash-detection/training/model2/jetson/` is archived M2-only research. Use
  `Trash-detection/jetson-runtime/` for deployment.
- `labels.txt`, `requirements.txt`, `logs/`, and `dataset/audits/` are model
  metadata, dependencies, or generated evidence. Read them only when the task
  calls for them.

## Documentation Maintenance

When changing behavior, update the component README and this map only if the
reading order changes. Move superseded long-form notes into an archive and add
an archive banner; do not leave historical plans looking like active guidance.
