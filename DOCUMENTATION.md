# GreenGuard26 documentation map

Use implementation and these current contracts as the source of truth.

## Detection work

1. `AGENT_HANDOFF.md` — current operating context and ownership boundaries.
2. `Trash-detection/docs/MODEL_CONTRACT.md` — active model hashes and
   decision/machine contracts.
3. `Trash-detection/docs/ARCHITECTURE.md` — runtime boundaries and shared flow.
4. `Trash-detection/README.md` — operator launchers and quick start.
5. `Trash-detection/pc-demo/README.md` — Windows runtime and machine mode.

## Component references

- Jetson deployment: `Trash-detection/jetson-runtime/README.md` and
  `DEVICE_VALIDATION.md`.
- Model 1 training: `Trash-detection/training/model1/README.md`.
- Model 2 training: `Trash-detection/training/model2/README.md`.
- Training overview: `Trash-detection/training/README.md`.
- Runtime validation: `Trash-detection/validation/README.md`.

Training and validation are not Windows operator entrypoints. Archived research
notes may describe historical experiments; they do not override checked-in
runtime code, configuration, or the contracts above.
