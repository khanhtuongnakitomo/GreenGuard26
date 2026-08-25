"""Load jetson-runtime configuration (Python 3.6 compatible)."""
import json
import os


def app_root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_config(name="default"):
    path = os.path.join(app_root(), "config", "%s.json" % name)
    if not os.path.isfile(path):
        raise IOError("config not found: %s" % path)
    with open(path, "r") as handle:
        cfg = json.load(handle)
    cfg["_root"] = app_root()
    return cfg


def resolve_path(rel):
    root = app_root()
    candidate = os.path.join(root, rel)
    if os.path.isfile(candidate):
        return candidate
    if os.path.isfile(rel):
        return rel
    return candidate


def load_manifest():
    path = os.path.join(app_root(), "models", "manifest.json")
    if not os.path.isfile(path):
        return {}
    with open(path, "r") as handle:
        return json.load(handle)


def validate_manifest(manifest):
    if not manifest:
        raise RuntimeError(
            "models/manifest.json is missing. Run ./setup.sh or package on PC first."
        )
    root = app_root()
    for entry in manifest.get("models", []):
        path = os.path.join(root, entry["path"])
        if not os.path.isfile(path):
            raise RuntimeError("missing packaged model: %s" % path)
