# ARCHIVED — do not deploy

This folder is historical research for M2-only Nano experiments.

**Use `Trash-detection/jetson-runtime/` instead** (full M1→classifier→M2 gate,
correct OBB channel order, polygon NMS, TensorRT engines built on-device).

The decoder in `infer_obb_onnx.py` assumes the wrong channel layout and uses
approximate AABB NMS. It must not be used for production.

---

# Model 2 on Jetson Nano B01 (legacy notes)

Target was YOLOv8n-OBB ONNX FP32 @416, M2 only. Prefer the new `jetson-runtime/`
bundle for all deployment work.
