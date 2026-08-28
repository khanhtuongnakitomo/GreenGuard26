#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
ENGINES="$ROOT/models/engines"
mkdir -p "$ENGINES"
WORKSPACE="${WORKSPACE_MB:-512}"

if ! command -v trtexec >/dev/null 2>&1; then
  echo "ERROR: trtexec not found. Install JetPack TensorRT tools." >&2
  exit 1
fi

build_one() {
  local onnx="$1"
  local engine="$2"
  if [[ ! -f "$onnx" ]]; then
    echo "ERROR: missing ONNX $onnx" >&2
    exit 1
  fi
  echo "building $engine from $onnx (FP16, workspace=${WORKSPACE}MB)"
  if ! trtexec --onnx="$onnx" --saveEngine="$engine" --fp16 --workspace="$WORKSPACE"; then
    echo "ERROR: failed to build $engine" >&2
    exit 1
  fi
}

build_one "$ROOT/models/m1_detect_416.onnx" "$ENGINES/m1_detect_416.engine"
build_one "$ROOT/models/m2_obb_416.onnx" "$ENGINES/m2_obb_416.engine"

python3 - <<'PY'
import hashlib
import json
import os
import subprocess
import time

root = os.path.dirname(os.path.abspath(__file__))
engines = os.path.join(root, "models", "engines")
models = os.path.join(root, "models")
onnx_map = {
    "m1_detect_416.engine": "m1_detect_416.onnx",
    "m2_obb_416.engine": "m2_obb_416.onnx",
}


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


manifest = {
    "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "precision": "fp16",
    "workspace_mb": int(os.environ.get("WORKSPACE_MB", "512")),
    "engines": [],
}
for name in sorted(os.listdir(engines)):
    if not name.endswith(".engine"):
        continue
    path = os.path.join(engines, name)
    onnx_name = onnx_map.get(name)
    onnx_path = os.path.join(models, onnx_name) if onnx_name else None
    entry = {
        "filename": name,
        "sha256": sha256(path),
        "bytes": os.path.getsize(path),
        "onnx": onnx_name,
        "onnx_sha256": sha256(onnx_path) if onnx_path and os.path.isfile(onnx_path) else None,
    }
    manifest["engines"].append(entry)
try:
    with open("/etc/nv_tegra_release") as handle:
        manifest["l4t"] = handle.read().strip()
except Exception:
    manifest["l4t"] = "unknown"
try:
    manifest["tensorrt"] = subprocess.check_output(
        ["dpkg-query", "-W", "-f=${Version}", "tensorrt"]
    ).decode().strip()
except Exception:
    try:
        import tensorrt as trt

        manifest["tensorrt"] = trt.__version__
    except Exception:
        manifest["tensorrt"] = "unknown"
out = os.path.join(engines, "engine_manifest.json")
with open(out, "w") as handle:
    json.dump(manifest, handle, indent=2)
print("wrote %s" % out)
PY

echo "Engine build complete. Benchmark examples:"
echo "  trtexec --loadEngine=$ENGINES/m1_detect_416.engine"
echo "  trtexec --loadEngine=$ENGINES/m2_obb_416.engine"
