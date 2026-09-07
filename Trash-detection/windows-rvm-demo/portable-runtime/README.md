# Portable runtime staging

The `portable` builder profile requires a staged Windows x64 Python 3.11
runtime at `portable-runtime/python/` (containing `python.exe`) and a local
wheelhouse at `portable-runtime/wheels/`. The wheelhouse must satisfy
`requirements.lock` and contain a `MANIFEST.json` listing every wheel and its
SHA-256. The builder verifies that content manifest before installing and runs
`pip check` inside the embedded interpreter to validate the installed
dependency closure.

The repository intentionally does not commit a Python runtime or large wheel
files. If those two staged inputs are absent, `build --profile portable`
fails closed. `--profile online-source` is an explicitly labelled fallback
that produces source and model files only and may require system Python and
internet access during setup; it must not be described as an offline bundle.
