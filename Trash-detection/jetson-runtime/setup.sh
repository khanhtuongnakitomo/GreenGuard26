#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

CHECK_ONLY=0
if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=1
fi

python3 check_environment.py
python3 - <<'PY'
import hashlib
import json
import os
import sys

root = os.path.dirname(os.path.abspath(__file__))
manifest_path = os.path.join(root, "models", "manifest.json")
if not os.path.isfile(manifest_path):
    sys.exit("ERROR: missing models/manifest.json")
with open(manifest_path) as handle:
    manifest = json.load(handle)


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


ok = True
for entry in manifest.get("models", []):
    path = os.path.join(root, entry["path"])
    if not os.path.isfile(path):
        print("ERROR: missing model %s" % path)
        ok = False
        continue
    digest = sha256(path)
    if digest != entry.get("sha256"):
        print("ERROR: sha256 mismatch for %s" % path)
        ok = False
cfg = os.path.join(root, "config", "default.json")
if not os.path.isfile(cfg):
    print("ERROR: missing config/default.json")
    ok = False
sys.exit(0 if ok else 1)
PY

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  echo "setup --check OK"
  exit 0
fi

if [[ -n "${ORT_WHEEL:-}" ]]; then
  python3 -m pip install --user "$ORT_WHEEL"
fi

python3 -m pip install --user --upgrade pip || true
python3 -m pip install --user "numpy<1.20" "opencv-python" || true

if python3 -c "import onnxruntime" 2>/dev/null; then
  echo "onnxruntime available"
else
  echo "NOTE: onnxruntime optional; set ORT_WHEEL=/path/to/wheel for CPU fallback"
fi

echo "setup complete (TensorRT engines: run ./build_engines.sh on this Nano)"
