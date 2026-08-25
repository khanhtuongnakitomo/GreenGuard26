"""ONNX Runtime CPU fallback backend (Python 3.6)."""
import os

from backends.base import InferenceBackend


class OnnxBackend(InferenceBackend):
    def __init__(self, model_path, providers=None):
        import onnxruntime as ort

        if providers is None:
            providers = ["CPUExecutionProvider"]
        self.session = ort.InferenceSession(model_path, providers=providers)
        self.input_name = self.session.get_inputs()[0].name

    def run(self, blob):
        return self.session.run(None, {self.input_name: blob})[0]

    def close(self):
        self.session = None
