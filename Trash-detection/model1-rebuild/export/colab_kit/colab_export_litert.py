# GreenGuard Model 1 rebuild — Colab LiteRT (TFLite) export for the OBB model.
# WHY THIS EXISTS: Ultralytics 8.4.126 can export LiteRT/TFLite ONLY on Linux x86
# or macOS (hard platform assert). The build machine is Windows, so the 4 TFLite
# variants (int8/fp32 × 320/416) are produced here instead.
#
# HOW TO RUN (Google Colab, free CPU runtime is enough, ~10 min):
#   1. Upload 2 files to Colab (left sidebar -> Files):
#        - runs/seed7_n640/weights/best.pt        (from your machine)
#        - export/colab_kit/calib200.zip          (this kit)
#   2. Paste this whole file into ONE cell and run it.
#   3. It prints download links for 4 .tflite files at the end — download them
#      into:  model1-rebuild/export/litert_int8_320/ , litert_int8_416/ ,
#             litert_fp32_320/ , litert_fp32_416/
#
# CALIBRATION NOTE: the kit wanted 200 in-machine capture photos for INT8
# calibration; none exist (input D-2 was never provided). We calibrate with 200
# random TRAIN images instead — documented deviation, see reports/GATE-4.md.
# FP16 does not exist in the new LiteRT export API (int8 / w8a16 / w8a32 / fp32).

!pip install -q ultralytics

import shutil
from pathlib import Path
from ultralytics import YOLO

shutil.unpack_archive("calib200.zip", ".")

VARIANTS = [
    ("litert_int8_320", 320, 8),     # (name, imgsz, quantize)
    ("litert_int8_416", 416, 8),
    ("litert_fp32_320", 320, None),
    ("litert_fp32_416", 416, None),
]

for name, imgsz, quant in VARIANTS:
    print(f"\n===== {name} =====")
    model = YOLO("best.pt")
    kwargs = dict(format="litert", imgsz=imgsz, data="calib200/data.yaml",
                  name=name, exist_ok=True)
    if quant:
        kwargs["quantize"] = quant
    out = model.export(**kwargs)
    print(f"exported -> {out}")

from google.colab import files
for p in sorted(Path(".").glob("**/*.tflite")):
    print("downloading:", p)
    files.download(str(p))
