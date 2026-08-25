"""TensorRT engine backend (Python 3.6, optional PyCUDA)."""
import hashlib
import json
import os

from backends.base import InferenceBackend


def _sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_engine_manifest(engines_dir):
    path = os.path.join(engines_dir, "engine_manifest.json")
    if not os.path.isfile(path):
        return None
    with open(path, "r") as handle:
        return json.load(handle)


def engine_is_valid(engine_path, onnx_path):
    """Refuse missing, foreign, or stale engines (ONNX hash / TRT/L4T mismatch)."""
    if not os.path.isfile(engine_path):
        return False
    engines_dir = os.path.dirname(engine_path)
    manifest = load_engine_manifest(engines_dir)
    if not manifest:
        return False
    name = os.path.basename(engine_path)
    entry = None
    for item in manifest.get("engines", []):
        if item.get("filename") == name:
            entry = item
            break
    if entry is None:
        return False
    if entry.get("sha256") != _sha256_file(engine_path):
        return False
    if onnx_path and os.path.isfile(onnx_path):
        expected = entry.get("onnx_sha256")
        if expected and expected != _sha256_file(onnx_path):
            return False
    return True


class TensorRTBackend(InferenceBackend):
    def __init__(self, engine_path, onnx_path=None):
        import tensorrt as trt
        import pycuda.autoinit  # noqa: F401
        import pycuda.driver as cuda

        if not engine_is_valid(engine_path, onnx_path):
            raise RuntimeError(
                "engine missing, stale, or foreign: %s (rebuild with ./build_engines.sh)"
                % engine_path
            )

        self.cuda = cuda
        logger = trt.Logger(trt.Logger.WARNING)
        with open(engine_path, "rb") as handle:
            runtime = trt.Runtime(logger)
            self.engine = runtime.deserialize_cuda_engine(handle.read())
        if self.engine is None:
            raise RuntimeError("failed to deserialize engine: %s" % engine_path)
        self.context = self.engine.create_execution_context()
        self.bindings = []
        self.host_inputs = []
        self.host_outputs = []
        self.device_inputs = []
        self.device_outputs = []
        self.output_shapes = []
        self.stream = cuda.Stream()
        for i in range(self.engine.num_bindings):
            shape = tuple(self.engine.get_binding_shape(i))
            size = trt.volume(shape)
            dtype = trt.nptype(self.engine.get_binding_dtype(i))
            host = cuda.pagelocked_empty(size, dtype)
            device = cuda.mem_alloc(host.nbytes)
            self.bindings.append(int(device))
            if self.engine.binding_is_input(i):
                self.host_inputs.append(host)
                self.device_inputs.append(device)
            else:
                self.host_outputs.append(host)
                self.device_outputs.append(device)
                self.output_shapes.append(shape)

    def run(self, blob):
        import numpy as np

        np.copyto(self.host_inputs[0], np.ascontiguousarray(blob).ravel())
        self.cuda.memcpy_htod_async(self.device_inputs[0], self.host_inputs[0], self.stream)
        self.context.execute_async_v2(bindings=self.bindings, stream_handle=self.stream.handle)
        self.cuda.memcpy_dtoh_async(self.host_outputs[0], self.device_outputs[0], self.stream)
        self.stream.synchronize()
        shape = self.output_shapes[0] if self.output_shapes else (blob.shape[0], -1)
        return np.array(self.host_outputs[0]).reshape(shape)

    def close(self):
        self.context = None
        self.engine = None
