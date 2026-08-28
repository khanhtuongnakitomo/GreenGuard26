"""OBB decoder shape and NMS tests."""
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))

from postprocess import decode_detect, decode_obb, parse_detect_output, parse_obb_output  # noqa: E402


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


def test_detect_parser_and_pp_filter():
    # channels-first detect output: [1, 4+nc, anchors]. PP has the highest raw score,
    # but the runtime allowlist must remove it before selection.
    out = np.zeros((1, 7, 2), dtype=np.float32)
    out[0, :4, 0] = [100, 100, 40, 40]
    out[0, 4:, 0] = [0.90, 0.10, 0.99]
    out[0, :4, 1] = [120, 100, 40, 40]
    out[0, 4:, 1] = [0.80, 0.95, 0.01]
    xywh, scores, cls_ids = parse_detect_output(out, 3)
    assert xywh.shape == (2, 4)
    assert cls_ids.tolist() == [2, 1]
    dets = decode_detect(out, ["metal_can", "pet_bottle", "pp_cup"], 0.05, 1.0, (0, 0), {0, 1})
    assert len(dets) == 1
    assert dets[0].class_id == 1
