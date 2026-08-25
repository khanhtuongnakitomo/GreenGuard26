r"""Single-instance post-processing (shared by M1/M2 demos, PC + Jetson).

M1: exactly ONE winning object overall — highest combined score
    (detector_conf x classifier_top1); invalid/empty -> no box.
M2: at most ONE detection per class (cap, label, ring).

Tie-breaking is deterministic: confidence, then box area, then original index.
"""
from __future__ import annotations

import numpy as np


def box_area(poly: np.ndarray) -> float:
    p = np.asarray(poly, dtype=np.float64).reshape(4, 2)
    return 0.5 * abs(np.dot(p[:, 0], np.roll(p[:, 1], 1))
                     - np.dot(p[:, 1], np.roll(p[:, 0], 1)))


def pick_top1(polys, clss, confs, valid_classes, extra=None):
    """One winner overall from OBB candidates.

    polys: (N,4,2); clss: (N,) int; confs: (N,) float
    valid_classes: iterable of allowed class ids
    extra: optional (N,) per-candidate multiplier (e.g. classifier top1 conf)
    Returns index into original arrays or None. Deterministic:
    score = conf * extra; ties -> larger area -> lower original index.
    """
    if len(polys) == 0:
        return None
    valid = set(valid_classes)
    best_i, best_key = None, None
    for i in range(len(polys)):
        c = int(clss[i])
        if c not in valid:
            continue
        score = float(confs[i]) * (float(extra[i]) if extra is not None else 1.0)
        key = (score, box_area(polys[i]), -i)
        if best_key is None or key > best_key:
            best_key, best_i = key, i
    return best_i


def pick_top1_per_class(polys, clss, confs, classes):
    """Dict {class_id: index} with the single best candidate per class.

    Deterministic: confidence, then area, then original index.
    """
    out = {}
    for c in classes:
        idx = [i for i in range(len(polys)) if int(clss[i]) == c]
        if not idx:
            continue
        out[c] = max(idx, key=lambda i: (float(confs[i]), box_area(polys[i]), -i))
    return out


def center_in_poly(center: tuple[float, float], poly: np.ndarray) -> bool:
    """Point-in-convex-quad test (ray casting)."""
    import cv2
    return cv2.pointPolygonTest(poly.astype(np.float32), center, False) >= 0
