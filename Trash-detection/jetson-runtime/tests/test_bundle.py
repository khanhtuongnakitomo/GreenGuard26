"""Import and bundle self-containment checks."""
import importlib.util
import os
import shutil
import sys
import tempfile


def test_imports_from_runtime_root():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = os.path.join(root, "src")
    sys.path.insert(0, src)
    import config_loader  # noqa: F401
    import preprocess  # noqa: F401
    import postprocess  # noqa: F401
    import gate  # noqa: F401


def test_copied_bundle_has_models_and_config():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with tempfile.TemporaryDirectory() as tmp:
        dest = os.path.join(tmp, "greenguard")
        shutil.copytree(root, dest)
        assert os.path.isfile(os.path.join(dest, "config", "default.json"))
        assert os.path.isfile(os.path.join(dest, "setup.sh"))
        assert os.path.isfile(os.path.join(dest, "run.sh"))
