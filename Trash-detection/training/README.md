# Training trees

Research and export live under:

- `training/model1/` — formerly `model1-rebuild` (PET/aluminum OBB + classifier)
- `training/model2/` — formerly `model2-rebuild` (cap/label/ring OBB)

Runtimes **must not** import from here. After export, package into demos:

```powershell
cd Trash-detection
python scripts\package_models.py --target all
```

## Venv note

A Windows `.venv` that lived under the old folder path may break after the move.
Recreate if needed:

```powershell
cd training\model1
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
```

Model 2 scripts expect `..\model1\.venv`.

## Legacy Jetson notes

`training/model2/jetson/` is archived research (wrong OBB channel order / AABB NMS).
Do **not** deploy it. Use `../../jetson-runtime/` instead.
