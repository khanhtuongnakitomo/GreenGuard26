r"""Jetson Nano B01 — YOLOv8-OBB ONNX inference (no Ultralytics).

Dependencies on device: opencv-python (or cv2 from apt), numpy, onnxruntime
(or onnxruntime-gpu / TensorRT EP if available).

Usage on Nano:
  python3 infer_obb_onnx.py --model model.onnx --source 0 --conf 0.5
  python3 infer_obb_onnx.py --model model.onnx --source frame.jpg --save out.jpg

Reads static imgsz from the ONNX graph. Decodes YOLOv8-OBB output
(cx, cy, w, h, angle_rad, class scores) and draws rotated polygons.
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

NAMES = ["cap", "label", "ring"]
COLORS = [(0, 0, 255), (0, 255, 255), (255, 0, 255)]


def letterbox(im: np.ndarray, new_shape: int) -> tuple[np.ndarray, float, tuple[float, float]]:
    h, w = im.shape[:2]
    r = min(new_shape / h, new_shape / w)
    nh, nw = int(round(h * r)), int(round(w * r))
    resized = cv2.resize(im, (nw, nh), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((new_shape, new_shape, 3), 114, dtype=np.uint8)
    top = (new_shape - nh) // 2
    left = (new_shape - nw) // 2
    canvas[top:top + nh, left:left + nw] = resized
    return canvas, r, (left, top)


def xywhr_to_poly(cx: float, cy: float, w: float, h: float, angle: float) -> np.ndarray:
    """Return 4x2 polygon in image coords (angle radians, OpenCV convention)."""
    cos_a, sin_a = np.cos(angle), np.sin(angle)
    dx, dy = w / 2.0, h / 2.0
    corners = np.array([[-dx, -dy], [dx, -dy], [dx, dy], [-dx, dy]], dtype=np.float32)
    rot = np.array([[cos_a, -sin_a], [sin_a, cos_a]], dtype=np.float32)
    return corners @ rot.T + np.array([cx, cy], dtype=np.float32)


def nms_obb(polys: np.ndarray, scores: np.ndarray, iou_thr: float = 0.45) -> list[int]:
    """Greedy NMS using polygon IoU via cv2.rotatedRectangleIntersection approx (AABB IoU)."""
    if len(scores) == 0:
        return []
    order = scores.argsort()[::-1]
    keep: list[int] = []
    boxes = np.array([cv2.boundingRect(p.astype(np.float32)) for p in polys], dtype=np.float32)
    # x,y,w,h -> x1,y1,x2,y2
    x1, y1 = boxes[:, 0], boxes[:, 1]
    x2, y2 = boxes[:, 0] + boxes[:, 2], boxes[:, 1] + boxes[:, 3]
    areas = boxes[:, 2] * boxes[:, 3]
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        if order.size == 1:
            break
        rest = order[1:]
        xx1 = np.maximum(x1[i], x1[rest])
        yy1 = np.maximum(y1[i], y1[rest])
        xx2 = np.minimum(x2[i], x2[rest])
        yy2 = np.minimum(y2[i], y2[rest])
        inter = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
        iou = inter / (areas[i] + areas[rest] - inter + 1e-6)
        order = rest[iou <= iou_thr]
    return keep


def parse_output(out: np.ndarray, conf: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Accept (1, 5+nc, N) or (1, N, 5+nc) or squeezed 2D."""
    x = np.squeeze(out)
    if x.ndim != 2:
        raise ValueError(f"unexpected ONNX output shape {out.shape}")
    # Prefer channels-first if first dim is small (5+nc)
    if x.shape[0] < x.shape[1] and x.shape[0] <= 64:
        x = x.T  # -> (N, 5+nc)
    nc = x.shape[1] - 5
    if nc < 1:
        raise ValueError(f"cannot parse OBB output with shape {x.shape}")
    xywhr = x[:, :5]
    cls_scores = x[:, 5:]
    cls_ids = cls_scores.argmax(axis=1)
    scores = cls_scores.max(axis=1)
    mask = scores >= conf
    return xywhr[mask], scores[mask], cls_ids[mask]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="path to model.onnx")
    ap.add_argument("--source", default="0")
    ap.add_argument("--conf", type=float, default=0.5)
    ap.add_argument("--iou", type=float, default=0.45)
    ap.add_argument("--save", default=None)
    ap.add_argument("--max-frames", type=int, default=0)
    ap.add_argument("--bench", type=int, default=0, help="if >0, time this many frames and exit")
    args = ap.parse_args()

    sess = ort.InferenceSession(args.model, providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0]
    imgsz = int(inp.shape[2]) if isinstance(inp.shape[2], int) else 416
    in_name = inp.name
    print(f"[jetson] model={args.model} imgsz={imgsz} input={in_name}")

    src = int(args.source) if str(args.source).isdigit() else args.source
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"ERROR: cannot open source {src!r}")
        return 1

    n = 0
    t_infer = 0.0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        n += 1
        lb, ratio, (pad_x, pad_y) = letterbox(frame, imgsz)
        blob = lb[:, :, ::-1].transpose(2, 0, 1).astype(np.float32) / 255.0
        blob = np.expand_dims(blob, 0)

        t0 = time.perf_counter()
        outs = sess.run(None, {in_name: blob})
        t_infer += time.perf_counter() - t0
        xywhr, scores, cls_ids = parse_output(outs[0], args.conf)

        polys = []
        for row in xywhr:
            cx, cy, w, h, ang = map(float, row)
            # undo letterbox
            cx = (cx - pad_x) / ratio
            cy = (cy - pad_y) / ratio
            w, h = w / ratio, h / ratio
            polys.append(xywhr_to_poly(cx, cy, w, h, ang))
        polys_arr = np.array(polys, dtype=np.float32) if polys else np.zeros((0, 4, 2), np.float32)
        keep = nms_obb(polys_arr, scores, args.iou) if len(scores) else []

        for i in keep:
            poly = polys_arr[i].astype(np.int32)
            ci = int(cls_ids[i])
            color = COLORS[ci % len(COLORS)]
            cv2.polylines(frame, [poly], True, color, 2)
            label = f"{NAMES[ci] if ci < len(NAMES) else ci} {scores[i]*100:.0f}%"
            x, y = int(poly[:, 0].min()), int(poly[:, 1].min())
            cv2.putText(frame, label, (x, max(20, y - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

        fps = n / max(t_infer, 1e-6)
        cv2.putText(frame, f"frame {n} | infer {fps:.1f} FPS", (10, frame.shape[0] - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

        if args.save and (args.max_frames == 1 or not str(args.source).isdigit()):
            Path(args.save).parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(args.save, frame)
            print(f"saved {args.save}")
            break

        cv2.imshow("Model2 OBB (q=quit)", frame)
        if (cv2.waitKey(1) & 0xFF) == ord("q"):
            break
        if args.max_frames and n >= args.max_frames:
            break
        if args.bench and n >= args.bench:
            break

    cap.release()
    cv2.destroyAllWindows()
    if n:
        print(f"[bench] {n} frames, mean infer FPS={n / max(t_infer, 1e-6):.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
