"""OBB decoder shape and NMS tests."""
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))

from postprocess import decode_obb, parse_obb_output  # noqa: E402


def test_parse_channels_first():
    nc = 2
    rows = 10
    data = np.random.rand(5 + nc, rows).astype(np.float32)
    xywhr, scores, cls_ids = parse_obb_output(data, nc)
    assert xywhr.shape[0] == rows
    assert scores.shape[0] == rows


def test_decode_empty():
    # channels-first OBB: [1, 5+nc, anchors] with nc=2 → 7 channels
    out = np.zeros((1, 7, 8), dtype=np.float32)
    dets = decode_obb(out, ["a", "b"], conf=0.5, ratio=1.0, pad=(0, 0))
    assert dets == []
