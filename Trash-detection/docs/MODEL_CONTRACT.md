# Model contract

Verify these active deployment artifacts before and after runtime refactors:

| Artifact | Input | Output | SHA-256 |
|---|---|---|---|
| PC M1 `pc-demo/models/m1_detect_640.onnx` | `[1,3,640,640]` | HBB detections | `CF7BAF1C4A917C7F8ECBD1E30BF92CA5E3A38869B99CCBFB6B94A0B95111EB24` |
| PC M2 `pc-demo/models/m2_obb_640.onnx` | `[1,3,640,640]` | `[cx,cy,w,h,class_probs...,angle]` | `2DF4F8F9F7D941998029E65809EB53BBF401199EB4D0A8489E7B259503AD1449` |
| Jetson M2 `jetson-runtime/models/m2_obb_416.onnx` | `[1,3,416,416]` | `[cx,cy,w,h,class_probs...,angle]` | `FDA4C7986ADCE3262686842DC751AFBEAE14BD6C059C794926E3A5872BE62FA7` |

The PC Model 1 public classes are `metal_can` and `pet_bottle`. Model 2
classes are `cap`, `label`, and `ring`. Parse ONNX Model 2 probabilities from
channels `4:4+class_count` and the final angle channel; do not apply another
sigmoid.

## Decision contract

- M1 candidate generation is separate from the decision floor.
- Accepted M1 material observations fill exactly seven frames; four are needed
  for a material quorum.
- Aluminum produces `ALUMINUM_CAN` and skips M2.
- PET waits `0.5` seconds, then consumes exactly seven M2 observations.
- Any cap, label, or ring confidence `>= 0.50` is a bad M2 observation.
- Missing M1/M2 is abstention. Four bad observations produce `PET_REJECT`;
  four clean observations produce `PET_CLEAN`; no quorum produces no result.
- A result is held for `1.5` seconds. One result event is allowed per item;
  eight consecutive clear M1 frames re-arm the workflow.

Canonical internal values remain `0`, `1`, and `2` for aluminum, clean PET, and
rejected PET. They are not wire bytes. The machine transport maps result names
at the final boundary to raw ASCII bytes `1`, `2`, and `3`, with no newline,
acknowledgement, retry, or extra byte.

## Machine camera and transport

The machine runtime is fixed to camera index `1`; backend fallback may reopen
that same index only. It has no source override or camera switch. It starts
stopped, fails closed as `CAMERA 1 REQUIRED`, and never infers or sends while
the camera is unavailable. An explicit configured COM port wins over discovery;
otherwise exactly one USB serial device is required. Zero or multiple devices
use terminal fallback. Idle selection and immediate pre-result selection are
rechecked. A failed serial write closes the port and performs one terminal
fallback without retry.
