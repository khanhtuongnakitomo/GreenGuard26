def detection_to_xyxy(detection, frame_shape):
    """Convert a Model 1 detection bbox to pixel xyxy.

    Model 1 TFLite uses normalized [ymin, xmin, ymax, xmax].
    Model 1 PyTorch webcam uses pixel [x1, y1, x2, y2].
    """
    height, width = frame_shape[:2]
    bbox = [float(value) for value in detection["bbox"]]
    if len(bbox) != 4:
        raise ValueError("Expected a 4-value bounding box")

    left, top, right, bottom = bbox
    if max(abs(value) for value in bbox) <= 1.5:
        ymin, xmin, ymax, xmax = bbox
        left = xmin * width
        top = ymin * height
        right = xmax * width
        bottom = ymax * height

    x1 = int(max(0, min(left, right)))
    y1 = int(max(0, min(top, bottom)))
    x2 = int(min(width - 1, max(left, right)))
    y2 = int(min(height - 1, max(top, bottom)))
    return x1, y1, x2, y2


def expand_xyxy(xyxy, frame_shape, margin=0.15):
    height, width = frame_shape[:2]
    x1, y1, x2, y2 = xyxy
    box_w = max(1, x2 - x1)
    box_h = max(1, y2 - y1)
    pad_x = int(box_w * margin)
    pad_y = int(box_h * margin)
    return (
        max(0, x1 - pad_x),
        max(0, y1 - pad_y),
        min(width, x2 + pad_x),
        min(height, y2 + pad_y),
    )


def crop_detection(frame, detection, margin=0.15):
    xyxy = expand_xyxy(detection_to_xyxy(detection, frame.shape), frame.shape, margin=margin)
    x1, y1, x2, y2 = xyxy
    if x2 <= x1 or y2 <= y1:
        return None, xyxy
    return frame[y1:y2, x1:x2].copy(), xyxy
