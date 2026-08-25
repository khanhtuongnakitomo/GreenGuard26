"""Letterbox preprocessing (Ultralytics-compatible, Python 3.6)."""
import cv2
import numpy as np


def letterbox(im, new_shape, color=(114, 114, 114)):
    h, w = im.shape[:2]
    ratio = min(float(new_shape) / h, float(new_shape) / w)
    nh, nw = int(round(h * ratio)), int(round(w * ratio))
    resized = cv2.resize(im, (nw, nh), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((new_shape, new_shape, 3), color, dtype=np.uint8)
    top = (new_shape - nh) // 2
    left = (new_shape - nw) // 2
    canvas[top : top + nh, left : left + nw] = resized
    return canvas, ratio, (left, top)


def blob_from_bgr(frame_bgr, imgsz):
    lb, ratio, pad = letterbox(frame_bgr, imgsz)
    blob = lb[:, :, ::-1].transpose(2, 0, 1).astype(np.float32) / 255.0
    return np.expand_dims(blob, 0), ratio, pad


def classifier_blob_from_bgr(frame_bgr, imgsz):
    h, w = frame_bgr.shape[:2]
    scale = float(imgsz) / min(h, w)
    nh, nw = int(round(h * scale)), int(round(w * scale))
    resized = cv2.resize(frame_bgr, (nw, nh), interpolation=cv2.INTER_LINEAR)
    y0 = max(0, (nh - imgsz) // 2)
    x0 = max(0, (nw - imgsz) // 2)
    crop = resized[y0 : y0 + imgsz, x0 : x0 + imgsz]
    if crop.shape[0] != imgsz or crop.shape[1] != imgsz:
        crop = cv2.resize(crop, (imgsz, imgsz), interpolation=cv2.INTER_LINEAR)
    blob = crop[:, :, ::-1].transpose(2, 0, 1).astype(np.float32) / 255.0
    return np.expand_dims(blob, 0)


def undo_letterbox_xy(x, y, ratio, pad):
    pad_x, pad_y = pad
    return (x - pad_x) / ratio, (y - pad_y) / ratio


def undo_letterbox_wh(w, h, ratio):
    return w / ratio, h / ratio
