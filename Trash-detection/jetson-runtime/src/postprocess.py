"""OBB decode and polygon NMS (Python 3.6)."""
import cv2
import numpy as np

from preprocess import undo_letterbox_wh, undo_letterbox_xy

MAX_DET = 300


class ObbDetection(object):
    def __init__(self, class_id, class_name, confidence, polygon):
        self.class_id = class_id
        self.class_name = class_name
        self.confidence = confidence
        self.polygon = polygon


def box_area(poly):
    p = np.asarray(poly, dtype=np.float64).reshape(4, 2)
    return 0.5 * abs(
        np.dot(p[:, 0], np.roll(p[:, 1], 1)) - np.dot(p[:, 1], np.roll(p[:, 0], 1))
    )


def xywhr_to_poly(cx, cy, w, h, angle):
    cos_a, sin_a = np.cos(angle), np.sin(angle)
    dx, dy = w / 2.0, h / 2.0
    corners = np.array([[-dx, -dy], [dx, -dy], [dx, dy], [-dx, dy]], dtype=np.float32)
    rot = np.array([[cos_a, -sin_a], [sin_a, cos_a]], dtype=np.float32)
    return corners @ rot.T + np.array([cx, cy], dtype=np.float32)


def poly_iou(p1, p2):
    a1 = cv2.contourArea(p1.astype(np.float32))
    a2 = cv2.contourArea(p2.astype(np.float32))
    if a1 <= 0 or a2 <= 0:
        return 0.0
    ret, intersection = cv2.intersectConvexConvex(p1.astype(np.float32), p2.astype(np.float32))
    if ret <= 0 or intersection is None or len(intersection) < 3:
        return 0.0
    inter = cv2.contourArea(intersection.astype(np.float32))
    union = a1 + a2 - inter
    return float(inter / (union + 1e-6))


def parse_obb_output(out, num_classes):
    x = np.squeeze(out)
    if x.ndim != 2:
        raise ValueError("unexpected OBB output shape %s" % (out.shape,))
    if x.shape[0] < x.shape[1] and x.shape[0] <= 64:
        x = x.T
    nc = x.shape[1] - 5
    if nc != num_classes:
        raise ValueError("expected %d classes, got %d" % (num_classes, nc))
    xywh = x[:, :4]
    cls_scores = x[:, 4 : 4 + nc].astype(np.float64)
    angle = x[:, 4 + nc]
    xywhr = np.concatenate([xywh, angle.reshape(-1, 1)], axis=1)
    cls_ids = cls_scores.argmax(axis=1)
    scores = cls_scores.max(axis=1)
    return xywhr, scores, cls_ids


def nms_obb_class_aware(polys, scores, cls_ids, iou_thr=0.45):
    if len(scores) == 0:
        return []
    order = scores.argsort()[::-1]
    keep = []
    suppressed = np.zeros(len(scores), dtype=bool)
    while order.size > 0:
        i = int(order[0])
        if suppressed[i]:
            order = order[1:]
            continue
        keep.append(i)
        if order.size == 1:
            break
        rest = order[1:]
        new_rest = []
        for j in rest:
            j = int(j)
            if suppressed[j]:
                continue
            if int(cls_ids[i]) != int(cls_ids[j]):
                new_rest.append(j)
                continue
            if poly_iou(polys[i], polys[j]) > iou_thr:
                suppressed[j] = True
            else:
                new_rest.append(j)
        order = np.array(new_rest, dtype=np.int64)
    return keep


def decode_obb(out, labels, conf, ratio, pad, iou_thr=0.45, max_det=MAX_DET):
    xywhr, scores, cls_ids = parse_obb_output(out, len(labels))
    mask = scores >= conf
    xywhr, scores, cls_ids = xywhr[mask], scores[mask], cls_ids[mask]
    if len(scores) == 0:
        return []
    if len(scores) > max_det:
        top = np.argsort(scores)[::-1][:max_det]
        xywhr, scores, cls_ids = xywhr[top], scores[top], cls_ids[top]
    polys = []
    for row in xywhr:
        cx, cy, w, h, ang = map(float, row)
        cx, cy = undo_letterbox_xy(cx, cy, ratio, pad)
        w, h = undo_letterbox_wh(w, h, ratio)
        polys.append(xywhr_to_poly(cx, cy, w, h, ang))
    polys_arr = np.array(polys, dtype=np.float32)
    keep = nms_obb_class_aware(polys_arr, scores, cls_ids, iou_thr)
    dets = []
    for i in keep:
        ci = int(cls_ids[i])
        dets.append(
            ObbDetection(
                ci,
                labels[ci] if 0 <= ci < len(labels) else str(ci),
                float(scores[i]),
                polys_arr[i],
            )
        )
    return dets


def pick_top1_detector(dets, min_area_frac, frame_area):
    best = None
    best_conf = -1.0
    min_area = frame_area * min_area_frac
    for det in dets:
        area = box_area(det.polygon)
        if area < min_area:
            continue
        if det.confidence > best_conf:
            best_conf = det.confidence
            best = det
    return best


def pick_top1_per_class(dets, classes):
    out = {}
    for c in classes:
        pool = [d for d in dets if d.class_id == c]
        if not pool:
            continue
        out[c] = max(pool, key=lambda d: (d.confidence, box_area(d.polygon)))
    return out


def center_in_poly(center, poly):
    return cv2.pointPolygonTest(poly.astype(np.float32), center, False) >= 0
