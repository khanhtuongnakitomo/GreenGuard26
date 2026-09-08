# Training trees

Training and evaluation are internal research surfaces:

- `model1/` — Model 1 data review, training, evaluation, and export
- `model2/` — cap/label/ring Model 2 training and candidate evaluation

Neither runtime imports these directories. After an explicitly reviewed and
accepted export, use the deterministic packaging utility from
`Trash-detection`:

```powershell
python scripts\package_models.py --target all
```

Training does not authorize promotion. Preserve grouped splits, locked tests,
candidate isolation, model hashes, and rollback evidence. Long training and
promotion require separate owner authorization. Use the component README for
the current workflow; archived notes are historical evidence only.
